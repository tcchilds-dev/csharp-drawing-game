using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

// NOTE: Remember to reset chat and canvas history at the start of every turn.

public class GameRoom
{
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

    public GameRoom(Player host)
    {
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
                throw new GameException("Could not add player to room.");
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

            var details = DtoConstructor.CreateRoomSyncDetails(this, isArtist: false);
            return details;
        }
    }

    public RoomSyncDetails? SendMessage(PlayerDetails player, string body)
    {
        if (!CanChat(player))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(body))
        {
            return null;
        }

        // TODO: Sort out arbitrary max characters -> Server settings.
        if (body.Length > 200)
        {
            throw new GameException("Messages have a limit of 200 characters.");
        }

        var contents = body.Trim();

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

        return DtoConstructor.CreateRoomSyncDetails(this, isArtist: false);
    }

    private bool CanChat(PlayerDetails player)
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
