using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Game;

// Every tick, each room removes players whose disconnect grace period has run out, and moves
// on to its next phase if the current one's time is up.
public class GameClock : BackgroundService
{
    private readonly TimeProvider _timeProvider;
    private readonly RoomRegistry _roomRegistry;
    private readonly IHubContext<GameHub, IGameClient> _hub;
    private readonly ILogger<GameClock> _logger;

    public GameClock(
        TimeProvider timeProvider,
        RoomRegistry roomRegistry,
        IHubContext<GameHub, IGameClient> hub,
        ILogger<GameClock> logger
    )
    {
        _timeProvider = timeProvider;
        _roomRegistry = roomRegistry;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250), _timeProvider);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await Task.WhenAll(_roomRegistry.Rooms.Values.Select(HandleRoomTick));
        }
    }

    private async Task HandleRoomTick(GameRoom room)
    {
        try
        {
            await TickRoom(room);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Clock tick failed for room {RoomId}.", room.RoomId);
        }
    }

    private async Task TickRoom(GameRoom room)
    {
        var expiryUpdate = _roomRegistry.ExpireDisconnectedPlayers(room);
        if (expiryUpdate is not null)
        {
            await _hub.Clients.Group(room.RoomId).SyncRoom(expiryUpdate);
        }

        var update = room.AdvancePhaseIfExpired();
        if (update is null)
        {
            return;
        }

        if (update.ArtistConnectionId is not null && update.ArtistUpdate is not null)
        {
            await _hub.Clients.Client(update.ArtistConnectionId).SyncArtist(update.ArtistUpdate);
        }

        await _hub.Clients.Group(update.Room.RoomId).SyncRoom(update.Room);
    }
}
