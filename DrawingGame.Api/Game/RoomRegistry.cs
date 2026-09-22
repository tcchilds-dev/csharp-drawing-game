using System.Collections.Concurrent;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

// NOTE: Reserve room membership, do room stuff, remove membership if failure.

public class RoomRegistry
{
    private readonly TimeProvider _timeProvider;
    private readonly WordListManager _wordListManager;

    private record RoomMember(Guid PlayerId, string RoomId);

    // Room ID -> Game Room
    public ConcurrentDictionary<string, GameRoom> Rooms = new();

    // Connection ID -> RoomMember
    private ConcurrentDictionary<string, RoomMember> _membership = new();

    public RoomRegistry(TimeProvider timeProvider, WordListManager wordListManager)
    {
        _timeProvider = timeProvider;
        _wordListManager = wordListManager;
    }

    public RoomEntryDetails CreateRoom(string connectionId, string username)
    {
        username = Validator.ValidateUsername(username);

        var player = new Player(connectionId, username);
        var room = new GameRoom(player, _timeProvider, _wordListManager);

        var member = new RoomMember(player.PlayerId, room.RoomId);
        if (!_membership.TryAdd(connectionId, member))
        {
            throw new GameException("This connection is already in a room.");
        }

        if (!Rooms.TryAdd(room.RoomId, room))
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

        if (!Rooms.TryGetValue(roomId, out var room))
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

    public RoomDetails UpdateGameSettings(string connectionId, GameSettingsDetails settings)
    {
        var member = CheckMembership(connectionId);
        var room = GetRoomFromConnection(connectionId, member.RoomId);

        var details = room.UpdateGameSettings(settings);
        return details;
    }

    public RoomDetails? SendMessage(string connectionId, string body)
    {
        var member = CheckMembership(connectionId);
        var room = GetRoomFromConnection(connectionId, member.RoomId);
        var player = GetPlayerFromRoom(connectionId, room);

        var details = room.SendMessage(player, body);
        return details;
    }

    public GameDetails? StartGame(string connectionId)
    {
        var member = CheckMembership(connectionId);
        var room = GetRoomFromConnection(connectionId, member.RoomId);
        var player = GetPlayerFromRoom(connectionId, room);

        var details = room.StartGame(player);
        return details;
    }

    public GameDetails? ChooseWord(string connectionId, string? word)
    {
        var member = CheckMembership(connectionId);
        var room = GetRoomFromConnection(connectionId, member.RoomId);
        var player = GetPlayerFromRoom(connectionId, room);

        var details = room.ChooseWord(player, word);
        return details;
    }

    public RoomDetails? UndoStroke(string connectionId)
    {
        var member = CheckMembership(connectionId);
        var room = GetRoomFromConnection(connectionId, member.RoomId);
        var player = GetPlayerFromRoom(connectionId, room);

        var details = room.UndoStroke(player);
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

    private GameRoom GetRoomFromConnection(string connectionId, string roomId)
    {
        if (!Rooms.TryGetValue(roomId, out var room))
        {
            _membership.TryRemove(connectionId, out _);
            throw new KeyNotFoundException("Room should exist if membership exists.");
        }

        return room;
    }

    private Player GetPlayerFromRoom(string connectionId, GameRoom room)
    {
        var player = room
            .Players.Select(player => player.Value)
            .Where(player => player.ConnectionId == connectionId)
            .SingleOrDefault();

        if (player is null)
        {
            throw new KeyNotFoundException("Failed to retrieve player from room.");
        }

        return player;
    }
}
