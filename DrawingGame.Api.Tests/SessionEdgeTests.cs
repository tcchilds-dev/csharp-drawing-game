using DrawingGame.Api.Game;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

public class SessionEdgeTests
{
    private readonly ManualTimeProvider _clock = new();
    private readonly RoomRegistry _registry;

    public SessionEdgeTests() => _registry = new(_clock, TestWordListManager.Create());

    private static SessionRestorationRequest Request(RoomEntryDto entry, string? token = null) =>
        new(
            entry.Snapshot.Room.RoomId,
            entry.Session.PlayerId,
            token ?? entry.Session.MembershipToken
        );

    private GameRoom RoomOf(RoomEntryDto entry) => _registry.Rooms[entry.Snapshot.Room.RoomId];

    [Fact]
    public void Invalid_token_cannot_take_over_a_seat_or_reserve_new_connection()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        Assert.Throws<GameException>(() =>
            _registry.ReconnectToRoom("new", Request(entry, "bad-token"), out _)
        );
        Assert.Equal("old", RoomOf(entry).Players[entry.Session.PlayerId].ConnectionId);
        Assert.NotNull(_registry.CreateRoom("new", "New owner"));
    }

    [Fact]
    public void Restoration_revokes_old_connection_authority()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        var restored = _registry.ReconnectToRoom("new", Request(entry), out _);
        Assert.Equal(entry.Session.PlayerId, restored.Session.PlayerId);
        Assert.Equal(entry.Snapshot.Room.HostPlayerId, restored.Snapshot.Room.HostPlayerId);
        Assert.Throws<GameException>(() => _registry.SendMessage("old", "hi", out _));
        Assert.Single(RoomOf(entry).Players);
    }

    [Fact]
    public void Already_occupied_connection_cannot_restore_a_second_membership()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        _registry.CreateRoom("occupied", "Other");
        Assert.Throws<GameException>(() =>
            _registry.ReconnectToRoom("occupied", Request(entry), out _)
        );
        Assert.Equal("old", RoomOf(entry).Players[entry.Session.PlayerId].ConnectionId);
    }

    [Fact]
    public void Explicit_leave_invalidates_restoration_token()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        _registry.JoinRoom("guest", "Guest", entry.Snapshot.Room.RoomId);
        _registry.LeaveRoom("old");
        Assert.Throws<GameException>(() => _registry.ReconnectToRoom("new", Request(entry), out _));
    }

    [Fact]
    public void Only_the_reconnecting_artist_gets_their_private_word_back()
    {
        var host = _registry.CreateRoom("host", "Host");
        var guest = _registry.JoinRoom("guest", "Guest", host.Snapshot.Room.RoomId);
        _registry.StartGame("host");
        _registry.MarkDisconnected("host");
        _registry.MarkDisconnected("guest");

        _registry.ReconnectToRoom("new-host", Request(host), out var artistUpdate);
        Assert.Equal(RoomOf(host).State.WordChoices, artistUpdate!.WordChoices);

        _registry.ReconnectToRoom("new-guest", Request(guest), out var guestUpdate);
        Assert.Null(guestUpdate);
    }

    [Fact]
    public void Delayed_old_connection_disconnect_cannot_remove_restored_player()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        _registry.MarkDisconnected("old");
        _clock.AdvanceTime(TimeSpan.FromSeconds(20));
        _registry.ReconnectToRoom("new", Request(entry), out _);
        _registry.MarkDisconnected("old");
        _clock.AdvanceTime(TimeSpan.FromSeconds(40));
        Assert.Null(_registry.ExpireDisconnectedPlayers(RoomOf(entry)));
        Assert.Single(RoomOf(entry).Players);
    }

    [Fact]
    public void Last_disconnected_seat_expires_at_grace_boundary_and_cleanup_is_idempotent()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        var room = RoomOf(entry);
        _registry.MarkDisconnected("old");
        _clock.AdvanceTime(GameConstants.DisconnectGracePeriod - TimeSpan.FromSeconds(1));
        Assert.Null(_registry.ExpireDisconnectedPlayers(room));
        Assert.Single(_registry.Rooms);
        _clock.AdvanceTime(TimeSpan.FromSeconds(1));
        Assert.NotNull(_registry.ExpireDisconnectedPlayers(room));
        Assert.Empty(_registry.Rooms);
        Assert.Null(_registry.ExpireDisconnectedPlayers(room));
        Assert.Throws<GameException>(() => _registry.ReconnectToRoom("new", Request(entry), out _));
        Assert.NotNull(_registry.CreateRoom("old", "Again"));
    }

    [Fact]
    public void Reconnect_at_expired_deadline_cannot_resurrect_a_seat_before_cleanup_tick()
    {
        var entry = _registry.CreateRoom("old", "Owner");
        _registry.MarkDisconnected("old");
        _clock.AdvanceTime(GameConstants.DisconnectGracePeriod);
        Assert.Throws<GameException>(() => _registry.ReconnectToRoom("new", Request(entry), out _));
    }
}
