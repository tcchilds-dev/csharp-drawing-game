using System.Security.Claims;
using DrawingGame.Api.Game;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Tests;

public class HubEdgeTests
{
    private readonly RoomRegistry _registry = new(
        new ManualTimeProvider(),
        TestWordListManager.Create()
    );
    private readonly RecordingClient _recorder = new();

    private (GameHub Hub, GameRoom Room, Guid ArtistId) BeginDrawing()
    {
        var entry = _registry.CreateRoom("artist", "Artist");
        _registry.JoinRoom("guest", "Guest", entry.Room.RoomId);
        _registry.StartGame("artist");
        var room = _registry.Rooms[entry.Room.RoomId];
        _registry.ChooseWord("artist", room.State.WordChoices![0]);
        var hub = new GameHub(_registry)
        {
            Context = new TestHubContext("artist"),
            Clients = new TestClients(_recorder),
        };
        return (hub, room, entry.Session.PlayerId);
    }

    [Fact]
    public async Task Extending_a_long_stroke_broadcasts_only_the_new_points()
    {
        var (hub, room, artistId) = BeginDrawing();
        room.Canvas.ActiveStroke = new Stroke("#1a1a1a", 8);
        room.Canvas.ActiveStroke.Points.AddRange(Enumerable.Repeat(new Point(1, 1), 60_000));
        await hub.ExtendStroke([new(2, 3)]);
        Assert.Empty(_recorder.Canvases);
        var update = Assert.Single(_recorder.CanvasUpdates);
        Assert.Equal(CanvasOperation.Extend, update.Operation);
        Assert.Equal(new Point(2, 3), Assert.Single(update.Points!));
        Assert.True(
            System.Text.Json.JsonSerializer.Serialize(update).Length < 1024,
            "Payload size must not grow with the stroke/history length."
        );
    }

    [Fact]
    public async Task Rejected_drawing_command_sends_the_artist_the_real_canvas()
    {
        var (hub, room, artistId) = BeginDrawing();
        await Assert.ThrowsAsync<HubException>(() =>
            hub.StartStroke(new("not a colour", 8, [new(1, 1)]))
        );
        Assert.Single(_recorder.Canvases);
        Assert.Empty(_recorder.CanvasUpdates);
    }

    [Fact]
    public async Task Hub_disconnect_marks_a_seat_for_expiry()
    {
        var clock = new ManualTimeProvider();
        var registry = new RoomRegistry(clock, TestWordListManager.Create());
        var entry = registry.CreateRoom("socket", "Owner");
        var room = registry.Rooms[entry.Room.RoomId];
        var hub = new GameHub(registry) { Context = new TestHubContext("socket") };
        await hub.OnDisconnectedAsync(null);
        clock.AdvanceTime(GameConstants.DisconnectGracePeriod);
        registry.ExpireDisconnectedPlayers(room);
        Assert.Empty(registry.Rooms);
    }
}

internal sealed class TestHubContext(string connectionId) : HubCallerContext
{
    public override string ConnectionId => connectionId;
    public override string? UserIdentifier => null;
    public override ClaimsPrincipal? User => null;
    public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
    public override IFeatureCollection Features { get; } = new FeatureCollection();
    public override CancellationToken ConnectionAborted => CancellationToken.None;

    public override void Abort() { }
}

internal sealed class RecordingClient : IGameClient
{
    public List<CanvasDto> Canvases { get; } = [];
    public List<CanvasUpdateDto> CanvasUpdates { get; } = [];

    public Task SyncRoom(RoomDto room) => Task.CompletedTask;

    public Task SyncGameSettings(GameSettingsDto settings) => Task.CompletedTask;

    public Task SyncMessage(MessageDto message) => Task.CompletedTask;

    public Task SyncArtist(ArtistUpdateDto update) => Task.CompletedTask;

    public Task SyncCanvas(CanvasDto canvas)
    {
        Canvases.Add(canvas);
        return Task.CompletedTask;
    }

    public Task SyncCanvasUpdate(CanvasUpdateDto update)
    {
        CanvasUpdates.Add(update);
        return Task.CompletedTask;
    }
}

internal sealed class TestClients(IGameClient client) : IHubCallerClients<IGameClient>
{
    public IGameClient All => client;
    public IGameClient Caller => client;
    public IGameClient Others => client;

    public IGameClient AllExcept(IReadOnlyList<string> excluded) => client;

    public IGameClient Client(string connectionId) => client;

    public IGameClient Clients(IReadOnlyList<string> connectionIds) => client;

    public IGameClient Group(string groupName) => client;

    public IGameClient GroupExcept(string groupName, IReadOnlyList<string> excluded) => client;

    public IGameClient Groups(IReadOnlyList<string> groupNames) => client;

    public IGameClient OthersInGroup(string groupName) => client;

    public IGameClient User(string userId) => client;

    public IGameClient Users(IReadOnlyList<string> userIds) => client;
}
