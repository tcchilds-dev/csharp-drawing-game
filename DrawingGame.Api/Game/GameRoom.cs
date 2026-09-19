using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

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
}

public class GameException : Exception
{
    public GameException(string message)
        : base(message) { }
}
