using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

public class RegistryEdgeTests
{
    private readonly RoomRegistry _registry = new(
        new ManualTimeProvider(),
        TestWordListManager.Create()
    );

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("a")]
    [InlineData("12345678901234567")]
    public void Invalid_name_does_not_reserve_a_connection(string? name)
    {
        Assert.Throws<GameException>(() => _registry.CreateRoom("socket", name!));
        Assert.NotNull(_registry.CreateRoom("socket", "Valid"));
        Assert.Single(_registry.Rooms);
    }

    // ISSUE: Currently fails w/ actual 3, expected 2 :37

    [Fact]
    public void Reusing_a_connection_cannot_create_or_join_a_second_room()
    {
        var first = _registry.CreateRoom("one", "Owner");
        var second = _registry.CreateRoom("two", "Other");
        Assert.Throws<GameException>(() => _registry.CreateRoom("one", "Again"));
        Assert.Throws<GameException>(() => _registry.JoinRoom("one", "Again", second.Room.RoomId));
        Assert.Equal(2, _registry.Rooms.Count);
        Assert.Single(_registry.Rooms[first.Room.RoomId].Players);
    }

    [Fact]
    public void Failed_full_room_join_releases_reserved_membership()
    {
        var entry = _registry.CreateRoom("host", "Host");
        for (var i = 0; i < 5; i++)
            _registry.JoinRoom($"guest{i}", $"Guest{i}", entry.Room.RoomId);
        Assert.Throws<GameException>(() => _registry.JoinRoom("retry", "Retry", entry.Room.RoomId));
        Assert.NotNull(_registry.CreateRoom("retry", "Retry"));
    }

    [Fact]
    public async Task Concurrent_last_seat_joins_never_overfill_or_leak_failed_memberships()
    {
        var entry = _registry.CreateRoom("host", "Host");
        for (var i = 0; i < 4; i++)
            _registry.JoinRoom($"existing{i}", $"Existing{i}", entry.Room.RoomId);
        var results = await Task.WhenAll(
            Enumerable
                .Range(0, 20)
                .Select(i =>
                    Task.Run(() =>
                    {
                        try
                        {
                            _registry.JoinRoom($"racer{i}", $"Racer{i}", entry.Room.RoomId);
                            return true;
                        }
                        catch (GameException)
                        {
                            _registry.CreateRoom($"racer{i}", $"Retry{i}");
                            return false;
                        }
                    })
                )
        );
        Assert.Single(results, won => won);
        Assert.Equal(6, _registry.Rooms[entry.Room.RoomId].Players.Count);
    }

    [Fact]
    public void Player_id_and_room_code_do_not_authorise_a_different_socket()
    {
        var owner = _registry.CreateRoom("owner", "Owner");
        Assert.Throws<GameException>(() => _registry.LeaveRoom("impostor"));
        Assert.Throws<GameException>(() => _registry.SendMessage("impostor", "hi", out _));
        Assert.Single(_registry.Rooms[owner.Room.RoomId].Players);
    }

    [Fact]
    public void Explicit_last_leave_removes_room_and_invalidates_old_identity()
    {
        var entry = _registry.CreateRoom("socket", "Owner");
        _registry.LeaveRoom("socket");
        Assert.Empty(_registry.Rooms);
        var next = _registry.CreateRoom("socket", "Owner");
        Assert.NotEqual(entry.Session.PlayerId, next.Session.PlayerId);
    }

    [Theory]
    [InlineData(2, 30, 80, 3)]
    [InlineData(4, 30, 80, 3)]
    [InlineData(3, 9, 80, 3)]
    [InlineData(3, 61, 80, 3)]
    [InlineData(3, 30, 59, 3)]
    [InlineData(3, 30, 181, 3)]
    [InlineData(3, 30, 80, 0)]
    [InlineData(3, 30, 80, 11)]
    public void Invalid_settings_are_atomic(int choices, int choiceTime, int drawTime, int rounds)
    {
        var entry = _registry.CreateRoom("host", "Host");
        var request = new GameSettingsUpdateRequest(
            (WordSelectionSize)choices,
            TimeSpan.FromSeconds(choiceTime),
            TimeSpan.FromSeconds(drawTime),
            rounds
        );
        Assert.Throws<GameException>(() => _registry.UpdateGameSettings("host", request));
        var room = _registry.Rooms[entry.Room.RoomId];
        Assert.Equal(entry.Room.Revision, room.Revision);
        Assert.Equal(entry.Room.Settings, DtoConstructor.GameSettingsDto(room));
    }

    [Fact]
    public void Guest_cannot_change_settings_or_start_game()
    {
        var host = _registry.CreateRoom("host", "Host");
        var guest = _registry.JoinRoom("guest", "Guest", host.Room.RoomId);
        var revision = guest.Room.Revision;
        Assert.Throws<GameException>(() =>
            _registry.UpdateGameSettings(
                "guest",
                new(WordSelectionSize.Five, TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(60), 1)
            )
        );
        Assert.Null(_registry.StartGame("guest"));
        Assert.Equal(revision, _registry.Rooms[host.Room.RoomId].Revision);
    }

    [Fact]
    public void Settings_cannot_change_during_a_match()
    {
        var host = _registry.CreateRoom("host", "Host");
        _registry.JoinRoom("guest", "Guest", host.Room.RoomId);
        _registry.StartGame("host");
        var room = _registry.Rooms[host.Room.RoomId];
        var before = DtoConstructor.GameSettingsDto(room);
        Assert.Throws<GameException>(() =>
            _registry.UpdateGameSettings(
                "host",
                new(WordSelectionSize.Five, TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(60), 1)
            )
        );
        Assert.Equal(before, DtoConstructor.GameSettingsDto(room));
    }
}
