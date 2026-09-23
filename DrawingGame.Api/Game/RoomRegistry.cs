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

    public RoomEntryDto CreateRoom(string connectionId, string username)
    {
        username = ValidateUsername(username);

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

        return DtoConstructor.RoomEntryDto(room, player);
    }

    public RoomEntryDto JoinRoom(string connectionId, string username, string roomId)
    {
        username = ValidateUsername(username);
        roomId = ValidateRoomId(roomId);

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
            var update = room.JoinRoom(connectionId, username);
            return update;
        }
        catch (GameException e)
        {
            // Remove membership if room join fails.
            _membership.TryRemove(connectionId, out _);
            throw new GameException(e.Message);
        }
    }

    public RoomDto LeaveRoom(string connectionId, Guid playerId, string roomId)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.LeaveRoom(player);
        _membership.TryRemove(connectionId, out _);

        if (update.Players.Length == 0)
        {
            Rooms.TryRemove(update.RoomId, out _);
        }

        return update;
    }

    public GameSettingsDto UpdateGameSettings(
        string connectionId,
        Guid playerId,
        string roomId,
        GameSettingsUpdateRequest settings
    )
    {
        ValidateSettings(settings);
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.UpdateGameSettings(player, settings);
        return update;
    }

    public ChatDto? SendMessage(string connectionId, Guid playerId, string roomId, string body)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.SendMessage(player, body);
        return update;
    }

    public PhaseChangeDto? StartGame(string connectionId, Guid playerId, string roomId)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.StartGame(player);
        return update;
    }

    public PhaseChangeDto? ChooseWord(
        string connectionId,
        Guid playerId,
        string roomId,
        string word
    )
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.ChooseWord(player, word);
        return update;
    }

    public CanvasDto? StartStroke(
        string connectionId,
        Guid playerId,
        string roomId,
        StrokeInput stroke
    )
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.StartStroke(player, stroke);
        return update;
    }

    public CanvasDto? ExtendStroke(
        string connectionId,
        Guid playerId,
        string roomId,
        Point[] points
    )
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.ExtendStroke(player, points);
        return update;
    }

    public CanvasDto? EndStroke(string connectionId, Guid playerId, string roomId)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.EndStroke(player);
        return update;
    }

    public CanvasDto? UndoStroke(string connectionId, Guid playerId, string roomId)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.UndoStroke(player);
        return update;
    }

    public CanvasDto? ClearCanvas(string connectionId, Guid playerId, string roomId)
    {
        (Player player, GameRoom room) = ValidatePlayer(connectionId, playerId, roomId);

        var update = room.ClearCanvas(player);
        return update;
    }

    private string ValidateUsername(string username)
    {
        username = username?.Trim() ?? string.Empty;
        if (
            username.Length < GameConstants.UsernameLength.Min
            || username.Length > GameConstants.UsernameLength.Max
        )
        {
            throw new GameException("Names must be between 2 and 16 characters long.");
        }
        return username;
    }

    private string ValidateRoomId(string roomId)
    {
        roomId = roomId?.Trim() ?? string.Empty;
        if (roomId.Length != RoomIdGenerator.RoomIdLength)
        {
            throw new GameException("Invalid room code.");
        }
        return roomId;
    }

    private void ValidateSettings(GameSettingsUpdateRequest settings)
    {
        var choiceTimeLimit = GameConstants.WordChoiceTimeLimit;
        var drawTimeLimit = GameConstants.DrawTimeLimit;
        var rounds = GameConstants.NumberOfRounds;

        if (
            settings.WordChoiceTimeLimit < choiceTimeLimit.Min
            || settings.WordChoiceTimeLimit > choiceTimeLimit.Max
        )
        {
            throw new GameException(
                $"Word choice timer must be {choiceTimeLimit.Min} to {choiceTimeLimit.Max} seconds."
            );
        }

        if (
            settings.DrawTimeLimit < drawTimeLimit.Min
            || settings.DrawTimeLimit > drawTimeLimit.Max
        )
        {
            throw new GameException(
                $"Draw timer must be {drawTimeLimit.Min} to {drawTimeLimit.Max} seconds."
            );
        }

        if (settings.NumberOfRounds < rounds.Min || settings.NumberOfRounds > rounds.Max)
        {
            throw new GameException(
                $"Number of rounds must be {rounds.Min} to {rounds.Max} rounds."
            );
        }
    }

    private (Player, GameRoom) ValidatePlayer(string connectionId, Guid playerId, string roomId)
    {
        if (!Rooms.TryGetValue(roomId, out var room))
        {
            throw new GameException("Room not found.");
        }

        if (!room.Players.TryGetValue(playerId, out var player))
        {
            throw new GameException("Player could not be found.");
        }

        if (player.ConnectionId != connectionId)
        {
            throw new GameException("Invalid connection ID.");
        }

        return (player, room);
    }

    // NOTE: GetRoomFromConnection and GetPlayerFromRoom are not currently needed, but
    // kept around for now just in case.

    // private GameRoom GetRoomFromConnection(string connectionId)
    // {
    //     if (!_membership.TryGetValue(connectionId, out var member))
    //     {
    //         throw new GameException("This connection does not belong to a room.");
    //     }
    //
    //     if (!Rooms.TryGetValue(member.RoomId, out var room))
    //     {
    //         _membership.TryRemove(connectionId, out _);
    //         throw new KeyNotFoundException("Room should exist if membership exists.");
    //     }
    //
    //     return room;
    // }
    //
    // private Player GetPlayerFromRoom(string connectionId, GameRoom room)
    // {
    //     var player = room
    //         .Players.Select(player => player.Value)
    //         .Where(player => player.ConnectionId == connectionId)
    //         .SingleOrDefault();
    //
    //     if (player is null)
    //     {
    //         throw new KeyNotFoundException("Failed to retrieve player from room.");
    //     }
    //
    //     return player;
    // }
}
