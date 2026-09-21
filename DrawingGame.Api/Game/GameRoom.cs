using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

// NOTE: Remember to reset chat and canvas history at the start of every turn.

public class GameRoom
{
    private readonly TimeProvider _timeProvider;

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

    public GameRoom(Player host, TimeProvider timeProvider)
    {
        _timeProvider = timeProvider;
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

    public RoomSyncDetails UpdateGameSettings(GameSettingsDetails settings)
    {
        Validator.ValidateSettings(settings);

        lock (_gate)
        {
            if (State.CurrentPhase != GamePhase.Lobby)
            {
                throw new GameException("Settings can only be changed from the lobby.");
            }

            Settings.WordSelectionSize = settings.WordSelectionSize;
            Settings.WordChoiceTimerSeconds = settings.WordChoiceTimerSeconds;
            Settings.DrawTimerSeconds = settings.DrawTimerSeconds;
            Settings.NumberOfRounds = settings.NumberOfRounds;

            Revision++;

            var details = DtoConstructor.CreateRoomSyncDetails(this);
            return details;
        }
    }

    public RoomSyncDetails? SendMessage(Player player, string body)
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

                State.PlayersMarkedCorrect.Add(player.PlayerId);
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

            // NOTE: Just gonna incremement the revision every mutation like a mad bastard
            // and see what happens.
            Revision++;

            return DtoConstructor.CreateRoomSyncDetails(this);
        }
    }

    public ActiveGameDetails? StartGame(Player player)
    {
        if (!CanStartGame(player))
        {
            return null;
        }

        lock (_gate)
        {
            Canvas.Clear();
            Chat.Clear();
            State.PrepareStartingRoomState();
            StartPhase(GamePhase.ChoosingWord, Settings.WordChoiceTimerSeconds);

            Revision++;

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.CreateActiveGameDetails(this, artistConnectionId);
        }
    }

    public ActiveGameDetails? ChooseWord(Player player, string word)
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
            StartPhase(GamePhase.Drawing, Settings.DrawTimerSeconds);

            Revision++;

            var artistConnectionId = GetArtistConnectionId();

            return DtoConstructor.CreateActiveGameDetails(this, artistConnectionId);
        }
    }

    public RoomSyncDetails? UndoStroke(Player player)
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

            return DtoConstructor.CreateRoomSyncDetails(this);
        }
    }

    private void StartPhase(GamePhase phase, TimeSpan? duration)
    {
        TimeSpan Duration() =>
            duration ?? throw new InvalidOperationException($"{phase} requires a duration.");

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
        throw new NotImplementedException();
    }

    private void StartChoosingWordPhase(TimeSpan duration)
    {
        throw new NotImplementedException();
    }

    private void StartDrawingPhase(TimeSpan duration)
    {
        throw new NotImplementedException();
    }

    private void StartTurnEndPhase()
    {
        throw new NotImplementedException();
    }

    private void StartMatchEndPhase()
    {
        throw new NotImplementedException();
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
