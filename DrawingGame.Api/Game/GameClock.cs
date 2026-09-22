using DrawingGame.Api.Game.DataTransferObjects;
using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Game;

public class GameClock : BackgroundService
{
    private readonly TimeProvider _timeProvider;
    private readonly RoomRegistry _roomRegistry;
    private readonly IHubContext<GameHub, IGameClient> _hub;

    public GameClock(
        TimeProvider timeProvider,
        RoomRegistry roomRegistry,
        IHubContext<GameHub, IGameClient> hub
    )
    {
        _timeProvider = timeProvider;
        _roomRegistry = roomRegistry;
        _hub = hub;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250), _timeProvider);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            foreach (var room in _roomRegistry.Rooms.Values)
            {
                PhaseChangeDto? update;
                try
                {
                    update = room.AdvancePhaseIfExpired();
                }
                catch
                {
                    // TODO: Log error and continue.
                    continue;
                }

                if (update is null)
                {
                    continue;
                }

                if (update.ArtistConnectionId is not null && update.ArtistUpdate is not null)
                {
                    await _hub
                        .Clients.Client(update.ArtistConnectionId)
                        .SyncArtist(update.ArtistUpdate);
                }

                await _hub.Clients.Group(update.Room.RoomId).SyncRoom(update.Room);
            }
        }
    }
}
