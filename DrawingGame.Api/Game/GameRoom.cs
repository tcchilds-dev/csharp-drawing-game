using System.Text;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

public class GameRoom
{
    private readonly TimeProvider _timeProvider;
    private readonly WordListManager _wordListManager;

    private readonly Lock _gate = new();

    public string RoomId { get; }
    public Guid HostPlayerId { get; private set; }

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

    public DateTimeOffset Now => _timeProvider.GetUtcNow();

    public GameRoom(Player host, TimeProvider timeProvider, WordListManager wordListManager)
    {
        _timeProvider = timeProvider;
        _wordListManager = wordListManager;
        RoomId = RoomIdGenerator.Generate();
        Players.Add(host.PlayerId, host);
        HostPlayerId = host.PlayerId;
        State = new GameState(host);
    }

    public RoomEntryDto JoinRoom(Player player)
    {
        lock (_gate)
        {
            if (Players.Count == 0)
            {
                throw new GameException("Room not found.");
            }

            if (Players.Count >= Settings.MaxPlayers)
            {
                throw new GameException("Room is full.");
            }

            // Take the first colour nobody else has, so colours freed by leavers are reused.
            player.ColourIndex = Enumerable
                .Range(0, Settings.MaxPlayers)
                .First(index => Players.Values.All(other => other.ColourIndex != index));

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

    public RoomDto LeaveRoom(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            var player = GetPlayer(connectionId, playerId);
            RemovePlayer(player);

            Revision++;
            return DtoConstructor.RoomDto(this);
        }
    }

    public RoomEntryDto Reconnect(
        string connectionId,
        Guid playerId,
        string membershipToken,
        out ArtistUpdateDto? artistUpdate
    )
    {
        lock (_gate)
        {
            if (
                !Players.TryGetValue(playerId, out var player)
                || player.MembershipToken != membershipToken
                || IsSeatExpired(player)
            )
            {
                throw new GameException("Your session could not be restored.");
            }

            // The old connection loses authority as soon as the ID is replaced.
            player.ConnectionId = connectionId;
            player.DisconnectedAt = null;

            artistUpdate =
                State.CurrentArtist == player.PlayerId
                    ? DtoConstructor.ArtistUpdateDto(this)
                    : null;
            return DtoConstructor.RoomEntryDto(this, player);
        }
    }

    public void MarkDisconnected(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            // The player may have already reconnected on a new connection.
            if (
                Players.TryGetValue(playerId, out var player)
                && player.ConnectionId == connectionId
            )
            {
                player.DisconnectedAt = Now;
            }
        }
    }

    public RoomDto? RemoveDisconnectedPlayers()
    {
        lock (_gate)
        {
            var expired = Players.Values.Where(IsSeatExpired).ToList();
            if (expired.Count == 0)
            {
                return null;
            }

            foreach (var player in expired)
            {
                RemovePlayer(player);
            }

            Revision++;
            return DtoConstructor.RoomDto(this);
        }
    }

    public GameSettingsDto UpdateGameSettings(
        string connectionId,
        Guid playerId,
        GameSettingsUpdateRequest settings
    )
    {
        lock (_gate)
        {
            var player = GetPlayer(connectionId, playerId);

            if (HostPlayerId != player.PlayerId)
            {
                throw new GameException("Only the host can change game settings.");
            }

            if (State.CurrentPhase != GamePhase.Lobby)
            {
                throw new GameException("Settings can only be changed from the lobby.");
            }

            _wordListManager.ValidateSelectionSize(settings.WordSelectionSize);
            Settings.WordSelectionSize = settings.WordSelectionSize;
            Settings.WordChoiceTimeLimit = settings.WordChoiceTimeLimit;
            Settings.DrawTimeLimit = settings.DrawTimeLimit;
            Settings.NumberOfRounds = settings.NumberOfRounds;

            Revision++;
            return DtoConstructor.GameSettingsDto(this);
        }
    }

    public MessageDto? SendMessage(
        string connectionId,
        Guid playerId,
        string body,
        out RoomDto? roomUpdate
    )
    {
        roomUpdate = null;
        lock (_gate)
        {
            var player = GetPlayer(connectionId, playerId);

            if (!ValidateMessage(player, body, out var contents))
            {
                return null;
            }

            if (IsCorrectGuess(contents))
            {
                Chat.Messages.Add(
                    new Message(
                        null,
                        null,
                        $"{player.Username} has guessed correctly!",
                        Now,
                        MessageType.CorrectGuessNotification
                    )
                );

                HandleCorrectGuess(player.PlayerId);

                Revision++;
                roomUpdate = DtoConstructor.RoomDto(this);
            }
            else
            {
                Chat.Messages.Add(
                    new Message(
                        player.PlayerId,
                        player.Username,
                        contents,
                        Now,
                        MessageType.StandardMessage
                    )
                );

                Revision++;
            }

            return DtoConstructor.MessageDto(this);
        }
    }

    public PhaseChangeDto? StartGame(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            var player = GetPlayer(connectionId, playerId);

            if (!CanStartGame(player))
            {
                return null;
            }

            // Shouldn't need to reset state here, as it was done when transitioning to lobby,
            // and the initial values are null in room creation.
            StartPhase(GamePhase.ChoosingWord, Settings.WordChoiceTimeLimit);

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.PhaseChangeDto(this, artistConnectionId);
        }
    }

    public PhaseChangeDto? ChooseWord(string connectionId, Guid playerId, string word)
    {
        lock (_gate)
        {
            var player = GetPlayer(connectionId, playerId);

            if (
                State.CurrentPhase != GamePhase.ChoosingWord
                || player.PlayerId != State.CurrentArtist
                || IsPhaseExpired()
            )
            {
                return null;
            }

            if (!State.WordChoices!.Contains(word))
            {
                throw new GameException("Invalid word choice.");
            }

            State.CurrentWord = word;

            StartPhase(GamePhase.Drawing, Settings.DrawTimeLimit);

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.PhaseChangeDto(this, artistConnectionId);
        }
    }

    public CanvasUpdateDto? StartStroke(string connectionId, Guid playerId, StrokeInput stroke)
    {
        lock (_gate)
        {
            if (!CanDraw(GetPlayer(connectionId, playerId)))
            {
                return null;
            }

            if (Canvas.ActiveStroke is not null)
            {
                throw RejectDrawing("A stroke is already in progress.");
            }

            Canvas.ActiveStroke = CreateStroke(stroke);

            Revision++;
            return DtoConstructor.CanvasUpdateDto(
                this,
                CanvasOperation.Start,
                stroke: Canvas.ActiveStroke
            );
        }
    }

    public CanvasUpdateDto? ExtendStroke(string connectionId, Guid playerId, Point[] points)
    {
        lock (_gate)
        {
            if (!CanDraw(GetPlayer(connectionId, playerId)) || Canvas.ActiveStroke is null)
            {
                return null;
            }

            ValidateExtension(Canvas.ActiveStroke, points);
            Canvas.ActiveStroke.Points.AddRange(points);

            Revision++;
            return DtoConstructor.CanvasUpdateDto(this, CanvasOperation.Extend, points: points);
        }
    }

    public CanvasUpdateDto? EndStroke(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            if (!CanDraw(GetPlayer(connectionId, playerId)) || Canvas.ActiveStroke is null)
            {
                return null;
            }

            Canvas.ActiveStroke.IsComplete = true;
            Canvas.Strokes.Push(Canvas.ActiveStroke);
            Canvas.ActiveStroke = null;

            Revision++;
            return DtoConstructor.CanvasUpdateDto(this, CanvasOperation.End);
        }
    }

    public CanvasUpdateDto? UndoStroke(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            if (!CanDraw(GetPlayer(connectionId, playerId)) || !Canvas.Undo())
            {
                return null;
            }

            Revision++;
            return DtoConstructor.CanvasUpdateDto(this, CanvasOperation.Undo);
        }
    }

    public CanvasUpdateDto? ClearCanvas(string connectionId, Guid playerId)
    {
        lock (_gate)
        {
            if (!CanDraw(GetPlayer(connectionId, playerId)))
            {
                return null;
            }

            Canvas.Clear();

            Revision++;
            return DtoConstructor.CanvasUpdateDto(this, CanvasOperation.Clear);
        }
    }

    public PhaseChangeDto? AdvancePhaseIfExpired()
    {
        lock (_gate)
        {
            if (!IsPhaseExpired())
            {
                return null;
            }

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

    private Player GetPlayer(string connectionId, Guid playerId)
    {
        if (!Players.TryGetValue(playerId, out var player))
        {
            throw new GameException("Player could not be found.");
        }

        if (player.ConnectionId != connectionId)
        {
            throw new GameException("Invalid connection ID.");
        }

        return player;
    }

    private void RemovePlayer(Player player)
    {
        var artistLeft = State.CurrentArtist == player.PlayerId;
        var turnIndex = State.TurnOrder.IndexOf(player.PlayerId);

        Players.Remove(player.PlayerId);
        State.TurnOrder.RemoveAt(turnIndex);
        State.Scores.Remove(player.PlayerId);
        State.PlayersMarkedCorrect.Remove(player.PlayerId);

        // CurrentTurn is one-based, so this also steps back when the artist themselves leaves.
        // Either way the next turn goes to the player who was after the artist.
        if (turnIndex < State.CurrentTurn)
        {
            State.CurrentTurn--;
        }

        if (artistLeft)
        {
            State.CurrentArtist = null;
        }

        if (HostPlayerId == player.PlayerId)
        {
            HostPlayerId = State.TurnOrder.FirstOrDefault();
        }

        if (Players.Count < 2)
        {
            if (State.CurrentPhase != GamePhase.Lobby)
            {
                StartPhase(GamePhase.Lobby, null);
            }
        }
        else if (
            (artistLeft && State.CurrentPhase == GamePhase.ChoosingWord)
            || (State.CurrentPhase == GamePhase.Drawing && (artistLeft || HaveAllGuessersGuessed()))
        )
        {
            StartPhase(GamePhase.TurnEnd, null);
        }
    }

    private void HandleNextTurnOrEnd()
    {
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
        return State.CurrentTurn == State.TurnOrder.Count;
    }

    private bool IsFinalRound()
    {
        return State.CurrentRound == Settings.NumberOfRounds;
    }

    private bool IsPhaseExpired()
    {
        return State.PhaseEndsAt is not null && Now >= State.PhaseEndsAt;
    }

    private bool IsSeatExpired(Player player)
    {
        return player.DisconnectedAt is not null
            && Now >= player.DisconnectedAt + GameConstants.DisconnectGracePeriod;
    }

    private void StartPhase(GamePhase phase, TimeSpan? duration)
    {
        TimeSpan Duration() =>
            duration ?? throw new InvalidOperationException($"{phase} requires a duration.");

        if (phase == GamePhase.ChoosingWord)
        {
            _wordListManager.ValidateSelectionSize(Settings.WordSelectionSize);
        }

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
        Canvas.Clear();
        Chat.Clear();
        return;
    }

    private void StartChoosingWordPhase(TimeSpan duration)
    {
        State.CurrentPhase = GamePhase.ChoosingWord;

        // The previous turn's drawing, guesses and word are kept through TurnEnd so everyone
        // can see them, and only cleared once the next turn starts.
        Canvas.Clear();
        Chat.Clear();
        State.PlayersMarkedCorrect.Clear();
        State.CurrentWord = null;
        State.MaskedWord = null;

        State.CurrentRound ??= 1;

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
        State.PhaseEndsAt = Now + duration;
        return;
    }

    private bool ValidateMessage(Player player, string body, out string processedBody)
    {
        processedBody = body?.Trim() ?? string.Empty;

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

        if (State.CurrentPhase != GamePhase.Drawing || IsPhaseExpired())
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

    private bool CanDraw(Player player)
    {
        return State.CurrentPhase == GamePhase.Drawing
            && State.CurrentArtist == player.PlayerId
            && !IsPhaseExpired();
    }

    // The artist has already drawn a rejected command on their side, so the rejection
    // corrects their canvas.
    private DrawingRejectedException RejectDrawing(string message)
    {
        return new DrawingRejectedException(message, DtoConstructor.CanvasDto(this));
    }

    private Stroke CreateStroke(StrokeInput stroke)
    {
        if (stroke?.Colour is null || !GameConstants.AllowedColours.Contains(stroke.Colour))
        {
            throw RejectDrawing("Invalid stroke colour.");
        }

        if (!GameConstants.BrushWidths.Contains(stroke.Width))
        {
            throw RejectDrawing("Invalid stroke width.");
        }

        if (stroke.Points is not [Point start] || !IsOnBoard(start))
        {
            throw RejectDrawing("A stroke must start with a single point on the board.");
        }

        var createdStroke = new Stroke(stroke.Colour, stroke.Width);
        createdStroke.Points.Add(start);
        return createdStroke;
    }

    private void ValidateExtension(Stroke activeStroke, Point[] points)
    {
        if (points is null || points.Length is 0 or > GameConstants.MaxPointsPerExtension)
        {
            throw RejectDrawing(
                $"Strokes must be extended by 1 to {GameConstants.MaxPointsPerExtension} points."
            );
        }

        // Points may go off the board, so the stroke carries on naturally if the mouse leaves
        // and comes back.
        if (points.Any(point => point is null || !IsWithinCoordinateLimit(point)))
        {
            throw RejectDrawing("Invalid stroke point.");
        }

        if (activeStroke.Points.Count + points.Length > GameConstants.MaxPointsPerStroke)
        {
            throw RejectDrawing("This stroke is too long.");
        }
    }

    private static bool IsOnBoard(Point point)
    {
        return point.x >= 0
            && point.x <= GameConstants.BoardSize.Width
            && point.y >= 0
            && point.y <= GameConstants.BoardSize.Height;
    }

    private static bool IsWithinCoordinateLimit(Point point)
    {
        return Math.Abs(point.x) <= GameConstants.MaxCoordinate
            && Math.Abs(point.y) <= GameConstants.MaxCoordinate;
    }

    private void StartDrawingPhase(TimeSpan duration)
    {
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
        State.PhaseEndsAt = Now + duration;
        return;
    }

    private void StartTurnEndPhase()
    {
        State.CurrentPhase = GamePhase.TurnEnd;
        State.PhaseEndsAt = Now + GameConstants.TurnEndDuration;
        return;
    }

    private void StartMatchEndPhase()
    {
        State.CurrentPhase = GamePhase.MatchEnd;
        State.PhaseEndsAt = Now + GameConstants.MatchEndDuration;
        return;
    }

    // Only letters are hidden, so guessers can see spaces and punctuation in phrases.
    private static string MaskWord(string word)
    {
        return string.Concat(
            word.EnumerateRunes().Select(rune => Rune.IsLetter(rune) ? "_" : rune.ToString())
        );
    }

    private void HandleCorrectGuess(Guid playerId)
    {
        State.PlayersMarkedCorrect.Add(playerId);
        UpdateScore(playerId);
        if (HaveAllGuessersGuessed())
        {
            StartPhase(GamePhase.TurnEnd, null);
        }
    }

    private bool HaveAllGuessersGuessed()
    {
        return State.PlayersMarkedCorrect.Count == Players.Count - 1;
    }

    private void UpdateScore(Guid playerId)
    {
        // Scales from the max points at the start of the turn down to the min at the deadline.
        var (min, max) = GameConstants.GuesserPoints;
        var timeLeft = (State.PhaseEndsAt!.Value - Now) / Settings.DrawTimeLimit;
        State.Scores[playerId] += min + (int)Math.Round((max - min) * timeLeft);

        if (State.CurrentArtist is Guid artist)
        {
            State.Scores[artist] += GameConstants.ArtistPointsPerGuess;
        }
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
        return string.Equals(contents, State.CurrentWord, StringComparison.OrdinalIgnoreCase);
    }
}

public class GameException : Exception
{
    public GameException(string message)
        : base(message) { }
}

public class DrawingRejectedException : GameException
{
    public CanvasDto Canvas { get; }

    public DrawingRejectedException(string message, CanvasDto canvas)
        : base(message)
    {
        Canvas = canvas;
    }
}
