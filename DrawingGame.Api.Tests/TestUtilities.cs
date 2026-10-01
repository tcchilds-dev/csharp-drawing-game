using DrawingGame.Api.Game;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

internal class ManualTimeProvider : TimeProvider
{
    private DateTimeOffset _now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public void AdvanceTime(TimeSpan duration) => _now += duration;
}

internal static class TestWordListManager
{
    public static WordListManager Create() =>
        new(Path.Combine(AppContext.BaseDirectory, "test-word-list.txt"));
}

internal class TestRoom
{
    public ManualTimeProvider Clock { get; } = new();
    public Player Host { get; } = new("host-connection", "Host");
    public GameRoom Room { get; }
    public Player Guest { get; }

    public void BeginDrawing()
    {
        if (Room.State.CurrentPhase == GamePhase.Lobby)
            Room.StartGame(Host);
        Room.ChooseWord(Host, Room.State.WordChoices![0]);
    }

    public TestRoom()
    {
        Room = new GameRoom(Host, Clock, TestWordListManager.Create());
        Guest = new Player("guest-connection", "Guest");
        Room.JoinRoom(Guest);
    }
}

// Lets tests act as a player without spelling out their connection and player IDs each time.
internal static class GameRoomTestExtensions
{
    public static RoomSnapshotDto LeaveRoom(this GameRoom room, Player player) =>
        room.LeaveRoom(player.ConnectionId, player.PlayerId);

    public static MessageDto? SendMessage(
        this GameRoom room,
        Player player,
        string body,
        out RoomSnapshotDto? roomUpdate
    ) => room.SendMessage(player.ConnectionId, player.PlayerId, body, out roomUpdate);

    public static PhaseChangeDto? StartGame(this GameRoom room, Player player) =>
        room.StartGame(player.ConnectionId, player.PlayerId);

    public static PhaseChangeDto? ChooseWord(this GameRoom room, Player player, string word) =>
        room.ChooseWord(player.ConnectionId, player.PlayerId, word);

    public static CanvasUpdateDto? StartStroke(
        this GameRoom room,
        Player player,
        StrokeInput stroke
    ) => room.StartStroke(player.ConnectionId, player.PlayerId, stroke);

    public static CanvasUpdateDto? ExtendStroke(
        this GameRoom room,
        Player player,
        Point[] points
    ) => room.ExtendStroke(player.ConnectionId, player.PlayerId, points);

    public static CanvasUpdateDto? EndStroke(this GameRoom room, Player player) =>
        room.EndStroke(player.ConnectionId, player.PlayerId);

    public static CanvasUpdateDto? UndoStroke(this GameRoom room, Player player) =>
        room.UndoStroke(player.ConnectionId, player.PlayerId);

    public static CanvasUpdateDto? ClearCanvas(this GameRoom room, Player player) =>
        room.ClearCanvas(player.ConnectionId, player.PlayerId);
}
