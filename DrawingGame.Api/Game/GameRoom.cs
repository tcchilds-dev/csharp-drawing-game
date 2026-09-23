using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

public class GameRoom
{
    private readonly TimeProvider _timeProvider;
    private readonly WordListManager _wordListManager;

    private Lock _gate = new();

    public string RoomId { get; }
    public Guid HostPlayerId { get; }

    // Each mutation increments the revision number, the client can use this to
    // ignore old updates arriving out of order. If their current revision number
    // is higher, then their version of the room is newer than the arriving one.
    public long Revision { get; set; } = 0;

    // Player ID -> Player
    public Dictionary<Guid, Player> Players { get; } = new();

    public GameSettings Settings { get; set; } = new();
    public GameState State { get; }
    public Canvas Canvas { get; } = new();
    public Chat Chat { get; } = new();

    public GameRoom(Player host, TimeProvider timeProvider, WordListManager wordListManager)
    {
        _timeProvider = timeProvider;
        _wordListManager = wordListManager;
        RoomId = RoomIdGenerator.Generate();
        Players.Add(host.PlayerId, host);
        HostPlayerId = host.PlayerId;
        State = new GameState(host);
    }

    public RoomEntryDto JoinRoom(string connectionId, string username)
    {
        lock (_gate)
        {
            if (Players.Count >= Settings.MaxPlayers)
            {
                throw new GameException("Room is full.");
            }

            var player = new Player(connectionId, username);

            if (!Players.TryAdd(player.PlayerId, player))
            {
                throw new InvalidOperationException("Failed to add player to game room.");
            }

            State.TurnOrder.Add(player.PlayerId);
            State.Scores.Add(player.PlayerId, 0);

            Revision++;
            return DtoConstructor.RoomEntryDto(this, player);
        }
    }

    public RoomDto LeaveRoom(Player player)
    {
        lock (_gate)
        {
            Players.Remove(player.PlayerId);

            if (Players.Count < 2)
            {
                StartPhase(GamePhase.Lobby, null);
            }

            return DtoConstructor.RoomDto(this);
        }
    }

    public GameSettingsDto UpdateGameSettings(Player player, GameSettingsUpdateRequest settings)
    {
        if (HostPlayerId != player.PlayerId)
        {
            throw new GameException("Only the host can change game settings.");
        }

        if (State.CurrentPhase != GamePhase.Lobby)
        {
            throw new GameException("Settings can only be changed from the lobby.");
        }

        lock (_gate)
        {
            Settings.WordSelectionSize = settings.WordSelectionSize;
            Settings.WordChoiceTimeLimit = settings.WordChoiceTimeLimit;
            Settings.DrawTimeLimit = settings.DrawTimeLimit;
            Settings.NumberOfRounds = settings.NumberOfRounds;

            Revision++;
            return DtoConstructor.GameSettingsDto(this);
        }
    }

    // TODO: Check if all players have guessed correctly to move to next phase.
    public ChatDto? SendMessage(Player player, string body)
    {
        if (!ValidateMessage(player, body, out var contents))
        {
            return null;
        }

        lock (_gate)
        {
            Message message;
            if (IsCorrectGuess(contents.ToLower()))
            {
                message = new Message(
                    null,
                    null,
                    $"{player.Username} has guessed correctly!",
                    _timeProvider.GetUtcNow(),
                    MessageType.CorrectGuessNotification
                );

                // TODO: implement
                HandleCorrectGuess(player.PlayerId);
            }
            else
            {
                message = new Message(
                    player.PlayerId,
                    player.Username,
                    contents,
                    _timeProvider.GetUtcNow(),
                    MessageType.StandardMessage
                );
            }

            Chat.Messages.Add(message);

            Revision++;
            return DtoConstructor.ChatDto(this);
        }
    }

    public PhaseChangeDto? StartGame(Player player)
    {
        if (!CanStartGame(player))
        {
            return null;
        }

        lock (_gate)
        {
            // Shouldn't need to reset state here, as it was done when transitioning to lobby,
            // and the initial values are null in room creation.
            StartPhase(GamePhase.ChoosingWord, Settings.WordChoiceTimeLimit);

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.PhaseChangeDto(this, artistConnectionId);
        }
    }

    public PhaseChangeDto? ChooseWord(Player player, string word)
    {
        if (player.PlayerId != State.CurrentArtist)
        {
            return null;
        }

        if (State.WordChoices is null)
        {
            throw new NullReferenceException("Word choice should not be null.");
        }

        lock (_gate)
        {
            var choice = State.WordChoices.Where(item => item == word).SingleOrDefault();

            if (choice is null)
            {
                throw new GameException("Invalid word choice.");
            }

            State.CurrentWord = choice;

            StartPhase(GamePhase.Drawing, Settings.DrawTimeLimit);

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.PhaseChangeDto(this, artistConnectionId);
        }
    }

    public CanvasDto? StartStroke(Player player, StrokeInput stroke)
    {
        if (State.CurrentPhase != GamePhase.Drawing || State.CurrentArtist != player.PlayerId)
        {
            return null;
        }

        var createdStroke = ValidateAndCreateStroke(stroke);

        lock (_gate)
        {
            Canvas.ActiveStroke = createdStroke;

            Revision++;
            return DtoConstructor.CanvasDto(this);
        }
    }

    public CanvasDto? ExtendStroke(Player player, Point[] points)
    {
        if (State.CurrentPhase != GamePhase.Drawing || State.CurrentArtist != player.PlayerId)
        {
            return null;
        }

        if (Canvas.ActiveStroke is null)
        {
            return null;
        }

        var validPoints = ValidatePoints(points);

        lock (_gate)
        {
            Canvas.ActiveStroke.Points.AddRange(validPoints);

            Revision++;
            return DtoConstructor.CanvasDto(this);
        }
    }

    public CanvasDto? EndStroke(Player player)
    {
        if (State.CurrentPhase != GamePhase.Drawing || State.CurrentArtist != player.PlayerId)
        {
            return null;
        }

        if (Canvas.ActiveStroke is null)
        {
            return null;
        }

        lock (_gate)
        {
            Canvas.ActiveStroke.IsComplete = true;
            Canvas.Strokes.Push(Canvas.ActiveStroke);
            Canvas.ActiveStroke = null;

            Revision++;
            return DtoConstructor.CanvasDto(this);
        }
    }

    public CanvasDto? UndoStroke(Player player)
    {
        if (player.PlayerId != State.CurrentArtist)
        {
            return null;
        }

        if (Canvas.Strokes.Count == 0)
        {
            return null;
        }

        lock (_gate)
        {
            Canvas.Strokes.Pop();

            Revision++;
            return DtoConstructor.CanvasDto(this);
        }
    }

    public CanvasDto? ClearCanvas(Player player)
    {
        if (player.PlayerId != State.CurrentArtist)
        {
            return null;
        }

        lock (_gate)
        {
            Canvas.Strokes.Clear();

            Revision++;
            return DtoConstructor.CanvasDto(this);
        }
    }

    public PhaseChangeDto? AdvancePhaseIfExpired()
    {
        var now = _timeProvider.GetUtcNow();

        if (State.PhaseEndsAt is null || now < State.PhaseEndsAt)
        {
            return null;
        }

        lock (_gate)
        {
            switch (State.CurrentPhase)
            {
                case GamePhase.ChoosingWord:
                    StartPhase(GamePhase.Drawing, Settings.DrawTimeLimit);
                    break;
                case GamePhase.Drawing:
                    StartPhase(GamePhase.TurnEnd, null);
                    break;
                case GamePhase.TurnEnd:
                    HandleNextTurnOrEnd();
                    break;
                case GamePhase.MatchEnd:
                    StartPhase(GamePhase.Lobby, null);
                    break;
            }

            if (State.CurrentArtist is not null)
            {
                var artistConnectionId = GetArtistConnectionId();
                return DtoConstructor.PhaseChangeDto(this, artistConnectionId);
            }

            return DtoConstructor.PhaseChangeDto(this, null);
        }
    }

    private void HandleNextTurnOrEnd()
    {
        State.CurrentWord = null;
        State.MaskedWord = null;

        if (IsLastPlayersTurn())
        {
            if (IsFinalRound())
            {
                StartPhase(GamePhase.MatchEnd, null);
                return;
            }
            // Incremements inside StartChoosingWordPhase()
            State.CurrentTurn = 0;
            State.CurrentRound++;
        }

        StartPhase(GamePhase.ChoosingWord, Settings.WordChoiceTimeLimit);
    }

    private bool IsLastPlayersTurn()
    {
        return State.TurnOrder.IndexOf(
                State.CurrentArtist
                    ?? throw new NullReferenceException("Current artist should not be null here.")
            )
            == State.TurnOrder.Count - 1;
    }

    private bool IsFinalRound()
    {
        return State.CurrentRound == Settings.NumberOfRounds;
    }

    private void StartPhase(GamePhase phase, TimeSpan? duration)
    {
        TimeSpan Duration() =>
            duration ?? throw new InvalidOperationException($"{phase} requires a duration.");

        Canvas.Clear();
        Chat.Clear();
        State.PlayersMarkedCorrect.Clear();

        Revision++;

        switch (phase)
        {
            case GamePhase.Lobby:
                StartLobbyPhase();
                break;

            case GamePhase.ChoosingWord:
                StartChoosingWordPhase(Duration());
                break;

            case GamePhase.Drawing:
                StartDrawingPhase(Duration());
                break;

            case GamePhase.TurnEnd:
                StartTurnEndPhase();
                break;

            case GamePhase.MatchEnd:
                StartMatchEndPhase();
                break;
        }
    }

    private void StartLobbyPhase()
    {
        State.CurrentPhase = GamePhase.Lobby;
        State.PrepareStartingRoomState();
        return;
    }

    private void StartChoosingWordPhase(TimeSpan duration)
    {
        State.CurrentPhase = GamePhase.ChoosingWord;

        if (State.CurrentTurn is null)
        {
            State.CurrentTurn = 0;
        }
        State.CurrentTurn++;

        State.CurrentArtist = State.TurnOrder[
            State.CurrentTurn - 1
                ?? throw new NullReferenceException("Current turn should not be null here.")
        ];

        State.WordChoices = _wordListManager.GetChoices(Settings.WordSelectionSize);
        State.PhaseEndsAt = _timeProvider.GetUtcNow() + duration;
        return;
    }

    private bool ValidateMessage(Player player, string body, out string processedBody)
    {
        processedBody = body.Trim();

        if (!CanChat(player))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(processedBody))
        {
            return false;
        }

        if (processedBody.Length > GameConstants.MaxMessageLength)
        {
            throw new GameException(
                $"Messages have a limit {GameConstants.MaxMessageLength} characters."
            );
        }

        return true;
    }

    private bool CanChat(Player player)
    {
        if (State.CurrentPhase == GamePhase.Lobby)
        {
            return true;
        }

        if (State.CurrentPhase != GamePhase.Drawing)
        {
            return false;
        }

        if (
            player.PlayerId == State.CurrentArtist
            || State.PlayersMarkedCorrect.Contains(player.PlayerId)
        )
        {
            return false;
        }

        return true;
    }

    private Stroke ValidateAndCreateStroke(StrokeInput stroke)
    {
        // NOTE:
        // Colour
        // Width
        // ValidatePoints()
        throw new NotImplementedException();
    }

    private Point[] ValidatePoints(Point[] points)
    {
        throw new NotImplementedException();
    }

    private void StartDrawingPhase(TimeSpan duration)
    {
        // NOTE: Eventually we will notify when the word choice timed out to make turn skipping
        // functionality.

        // Current word is set inside of <GameRoom>.ChooseWord(). If the word was not chosen in
        // time, it defaults inside of here.
        if (State.CurrentWord is null)
        {
            if (State.WordChoices is null)
            {
                throw new NullReferenceException("Word choices should not be null here.");
            }
            State.CurrentWord = State.WordChoices[0];
        }
        State.MaskedWord = MaskWord(State.CurrentWord);

        State.CurrentPhase = GamePhase.Drawing;
        State.PhaseEndsAt = _timeProvider.GetUtcNow() + duration;
        return;
    }

    private void StartTurnEndPhase()
    {
        State.CurrentPhase = GamePhase.TurnEnd;
        State.PhaseEndsAt = _timeProvider.GetUtcNow() + GameConstants.TurnEndDuration;
        return;
    }

    private void StartMatchEndPhase()
    {
        State.CurrentPhase = GamePhase.MatchEnd;
        State.PhaseEndsAt = _timeProvider.GetUtcNow() + GameConstants.MatchEndDuration;
        return;
    }

    private string MaskWord(string word) => new String('_', word.Length);

    private void HandleCorrectGuess(Guid playerId)
    {
        State.PlayersMarkedCorrect.Add(playerId);
        UpdateScore(playerId);
        if (State.PlayersMarkedCorrect.Count == Players.Count)
        {
            StartPhase(GamePhase.TurnEnd, null);
        }
    }

    private void UpdateScore(Guid playerId)
    {
        // TODO: Implement scoring.
    }

    private string GetArtistConnectionId()
    {
        var artistConnectionId = Players
            .Where(player => player.Key == State.CurrentArtist)
            .Select(player => player.Value.ConnectionId)
            .SingleOrDefault();

        if (artistConnectionId is null)
        {
            throw new NullReferenceException("Artist Connection ID should not be null here.");
        }

        return artistConnectionId;
    }

    private bool CanStartGame(Player player)
    {
        if (State.CurrentPhase != GamePhase.Lobby)
        {
            return false;
        }

        if (HostPlayerId != player.PlayerId)
        {
            return false;
        }

        if (Players.Count < 2)
        {
            throw new GameException("The game must have at least two players to start.");
        }

        return true;
    }

    private bool IsCorrectGuess(string contents)
    {
        return contents == State.CurrentWord?.ToLower();
    }
}

public class GameException : Exception
{
    public GameException(string message)
        : base(message) { }
}
