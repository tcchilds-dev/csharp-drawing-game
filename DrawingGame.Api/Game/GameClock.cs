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
                GameDetails? details;
                try
                {
                    details = room.AdvancePhaseIfExpired();
                }
                catch
                {
                    // TODO: Log error and continue.
                    continue;
                }

                if (details is null)
                {
                    continue;
                }

                if (details.ArtistConnectionId is not null && details.ArtistDetails is not null)
                {
                    await _hub
                        .Clients.Client(details.ArtistConnectionId)
                        .SyncArtist(details.ArtistDetails);
                }

                await _hub
                    .Clients.Group(details.RoomDetails.RoomId)
                    .PhaseChange(details.RoomDetails);
            }
        }
    }
}
