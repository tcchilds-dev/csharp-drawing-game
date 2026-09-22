using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

// NOTE: Remember to reset chat and canvas history at the start of every turn.
// NOTE: Get codex to reorder functions according to access and alphabetic order.
// TODO: Return finer-grain details.

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

    public RoomEntryDetails JoinRoom(string connectionId, string username)
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

            var details = DtoConstructor.CreateRoomEntryDetails(this, player);

            return details;
        }
    }

    public RoomDetails UpdateGameSettings(GameSettingsDetails settings)
    {
        Validator.ValidateSettings(settings);

        lock (_gate)
        {
            if (State.CurrentPhase != GamePhase.Lobby)
            {
                throw new GameException("Settings can only be changed from the lobby.");
            }

            Settings.WordSelectionSize = settings.WordSelectionSize;
            Settings.WordChoiceTimeLimit = settings.WordChoiceTimeLimit;
            Settings.DrawTimeLimit = settings.DrawTimeLimit;
            Settings.NumberOfRounds = settings.NumberOfRounds;

            Revision++;

            var details = DtoConstructor.CreateRoomDetails(this);
            return details;
        }
    }

    // TODO: Check if all players have guessed correctly to move to next phase.
    public RoomDetails? SendMessage(Player player, string body)
    {
        if (!CanChat(player))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        if (body.Length > GameConstants.MaxMessageLength)
        {
            throw new GameException(
                $"Messages have a limit of {GameConstants.MaxMessageLength} characters."
            );
        }

        var contents = body.Trim();

        lock (_gate)
        {
            Message message;
            if (IsCorrectGuess(contents.ToLower()))
            {
                message = new Message(
                    null,
                    null,
                    $"{player.Username} has guessed correctly!",
                    MessageType.CorrectGuessNotification
                );

                HandleCorrectGuess(player.PlayerId);
            }
            else
            {
                message = new Message(
                    player.PlayerId,
                    player.Username,
                    contents,
                    MessageType.StandardMessage
                );
            }

            Chat.Messages.Add(message);

            Revision++;

            return DtoConstructor.CreateRoomDetails(this);
        }
    }

    public GameDetails? StartGame(Player player)
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

            Revision++;

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.CreateGameDetails(this, artistConnectionId);
        }
    }

    public GameDetails? ChooseWord(Player player, string? word)
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
            if (word is not null)
            {
                var choice = State.WordChoices.Where(item => item == word).SingleOrDefault();

                if (choice is null)
                {
                    throw new GameException("Invalid word choice.");
                }

                State.CurrentWord = choice;
            }
            StartPhase(GamePhase.Drawing, Settings.DrawTimeLimit);

            Revision++;

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.CreateGameDetails(this, artistConnectionId);
        }
    }

    public RoomDetails? UndoStroke(Player player)
    {
        if (player.PlayerId != State.CurrentArtist)
        {
            return null;
        }

        if (Canvas.ActiveStroke is not null || Canvas.Strokes.Count == 0)
        {
            return null;
        }

        lock (_gate)
        {
            Canvas.Strokes.Pop();

            return DtoConstructor.CreateRoomDetails(this);
        }
    }

    public GameDetails? AdvancePhaseIfExpired()
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
                return DtoConstructor.CreateGameDetails(this, artistConnectionId);
            }

            return DtoConstructor.CreateGameDetails(this, null);
        }
    }

    private void HandleNextTurnOrEnd()
    {
        if (IsFinalRound() && IsLastPlayersTurn())
        {
            StartPhase(GamePhase.MatchEnd, null);
            return;
        }

        if (IsLastPlayersTurn())
        {
            // NOTE: increments inside StartChoosingWordPhase()
            State.CurrentTurn = 0;
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

    private void StartDrawingPhase(TimeSpan duration)
    {
        // TODO: Set current word and masked word inside word chosen, default behaviour here.
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
        throw new NotImplementedException("Update score.");
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

        if (player.PlayerId == State.CurrentArtist)
        {
            return false;
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
