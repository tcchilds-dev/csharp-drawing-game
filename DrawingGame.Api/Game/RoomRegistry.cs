using System.Collections.Concurrent;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

// TODO: Implement
public class ServerSettings { }

// NOTE: Reserve room membership, do room stuff, remove membership if failure.

public class RoomRegistry
{
    private record RoomMember(Guid PlayerId, string RoomId);

    // Room ID -> Game Room
    private ConcurrentDictionary<string, GameRoom> _rooms = new();

    // Connection ID -> RoomMember
    private ConcurrentDictionary<string, RoomMember> _membership = new();

    public RoomEntryDetails CreateRoom(string connectionId, string username)
    {
        username = Validator.ValidateUsername(username);

        var player = new Player(connectionId, username);
        var room = new GameRoom(player);

        var member = new RoomMember(player.PlayerId, room.RoomId);
        if (!_membership.TryAdd(connectionId, member))
        {
            throw new GameException("This connection is already in a room.");
        }

        if (!_rooms.TryAdd(room.RoomId, room))
        {
            _membership.TryRemove(connectionId, out _);
            throw new GameException("Could not register room.");
        }

        return DtoConstructor.CreateRoomEntryDetails(room, player);
    }

    public RoomEntryDetails JoinRoom(string connectionId, string username, string roomId)
    {
        username = Validator.ValidateUsername(username);
        roomId = Validator.ValidateRoomId(roomId);

        var player = new Player(connectionId, username);
        var member = new RoomMember(player.PlayerId, roomId);

        if (!_rooms.TryGetValue(roomId, out var room))
        {
            throw new GameException("Room not found.");
        }

        // Reserve membership first.
        if (!_membership.TryAdd(connectionId, member))
        {
            throw new GameException("This connection is already in a room.");
        }

        try
        {
            var details = room.JoinRoom(connectionId, username);
            return details;
        }
        catch (GameException e)
        {
            // Remove membership if room join fails.
            _membership.TryRemove(connectionId, out _);
            throw new GameException(e.Message);
        }
    }

    public RoomSyncDetails UpdateGameSettings(string connectionId, GameSettingsDetails settings)
    {
        var member = CheckMembership(connectionId);
        var room = CheckRoomExistence(connectionId, member.RoomId);

        var details = room.UpdateGameSettings(settings);
        return details;
    }

    public RoomSyncDetails? SendMessage(string connectionId, string body)
    {
        var member = CheckMembership(connectionId);
        var room = CheckRoomExistence(connectionId, member.RoomId);
        var player = room
            .Players.Select(player => player.Value)
            .Where(player => player.ConnectionId == connectionId)
            .SingleOrDefault();

        if (player is null)
        {
            throw new GameException("Player could not be found in room.");
        }

        var playerDetails = DtoConstructor.CreatePlayerDetails(player);

        var details = room.SendMessage(playerDetails, body);
        return details;
    }

    private RoomMember CheckMembership(string connectionId)
    {
        if (!_membership.TryGetValue(connectionId, out var member))
        {
            throw new GameException("This connection does not belong to a room.");
        }

        return member;
    }

    private GameRoom CheckRoomExistence(string connectionId, string roomId)
    {
        if (!_rooms.TryGetValue(roomId, out var room))
        {
            _membership.TryRemove(connectionId, out _);
            throw new KeyNotFoundException("Room should exist if membership exists.");
        }

        return room;
    }
}
