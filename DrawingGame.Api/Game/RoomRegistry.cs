using System.Collections.Concurrent;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

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

        var update = DtoConstructor.RoomEntryDto(room, player);

        if (!Rooms.TryAdd(room.RoomId, room))
        {
            _membership.TryRemove(connectionId, out _);
            throw new GameException("Could not register room.");
        }

        return update;
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
            var update = room.JoinRoom(player);
            return update;
        }
        catch (GameException)
        {
            // Remove membership if room join fails.
            _membership.TryRemove(connectionId, out _);
            throw;
        }
    }

    public RoomDto LeaveRoom(string connectionId, Guid playerId, string roomId)
    {
        var room = GetRoom(roomId);

        var update = room.LeaveRoom(connectionId, playerId);
        _membership.TryRemove(connectionId, out _);
        RemoveRoomIfEmpty(update);

        return update;
    }

    public RoomEntryDto ReconnectToRoom(
        string connectionId,
        SessionRestorationRequest request,
        out ArtistUpdateDto? artistUpdate
    )
    {
        var room = GetRoom(request.RoomId);

        // Reserve membership first, the same as joining.
        var member = new RoomMember(request.PlayerId, room.RoomId);
        if (!_membership.TryAdd(connectionId, member))
        {
            throw new GameException("This connection is already in a room.");
        }

        try
        {
            return room.Reconnect(
                connectionId,
                request.PlayerId,
                request.MembershipToken,
                out artistUpdate
            );
        }
        catch (GameException)
        {
            _membership.TryRemove(connectionId, out _);
            throw;
        }
    }

    public void MarkDisconnected(string connectionId)
    {
        // The connection is gone for good, so its membership is too. The player keeps their
        // seat until it expires, and reconnects with a new connection.
        if (
            _membership.TryRemove(connectionId, out var member)
            && Rooms.TryGetValue(member.RoomId, out var room)
        )
        {
            room.MarkDisconnected(connectionId, member.PlayerId);
        }
    }

    public RoomDto? ExpireDisconnectedPlayers(GameRoom room)
    {
        var update = room.RemoveDisconnectedPlayers();
        if (update is not null)
        {
            RemoveRoomIfEmpty(update);
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
        var room = GetRoom(roomId);

        var update = room.UpdateGameSettings(connectionId, playerId, settings);
        return update;
    }

    public MessageDto? SendMessage(
        string connectionId,
        Guid playerId,
        string roomId,
        string body,
        out RoomDto? roomUpdate
    )
    {
        var room = GetRoom(roomId);

        var update = room.SendMessage(connectionId, playerId, body, out roomUpdate);
        return update;
    }

    public PhaseChangeDto? StartGame(string connectionId, Guid playerId, string roomId)
    {
        var room = GetRoom(roomId);

        var update = room.StartGame(connectionId, playerId);
        return update;
    }

    public PhaseChangeDto? ChooseWord(
        string connectionId,
        Guid playerId,
        string roomId,
        string word
    )
    {
        var room = GetRoom(roomId);

        var update = room.ChooseWord(connectionId, playerId, word);
        return update;
    }

    public CanvasUpdateDto? StartStroke(
        string connectionId,
        Guid playerId,
        string roomId,
        StrokeInput stroke
    )
    {
        var room = GetRoom(roomId);

        var update = room.StartStroke(connectionId, playerId, stroke);
        return update;
    }

    public CanvasUpdateDto? ExtendStroke(
        string connectionId,
        Guid playerId,
        string roomId,
        Point[] points
    )
    {
        var room = GetRoom(roomId);

        var update = room.ExtendStroke(connectionId, playerId, points);
        return update;
    }

    public CanvasUpdateDto? EndStroke(string connectionId, Guid playerId, string roomId)
    {
        var room = GetRoom(roomId);

        var update = room.EndStroke(connectionId, playerId);
        return update;
    }

    public CanvasUpdateDto? UndoStroke(string connectionId, Guid playerId, string roomId)
    {
        var room = GetRoom(roomId);

        var update = room.UndoStroke(connectionId, playerId);
        return update;
    }

    public CanvasUpdateDto? ClearCanvas(string connectionId, Guid playerId, string roomId)
    {
        var room = GetRoom(roomId);

        var update = room.ClearCanvas(connectionId, playerId);
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

        _wordListManager.ValidateSelectionSize(settings.WordSelectionSize);

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

    // Players are validated by the room itself, under its lock, as part of each action.
    private GameRoom GetRoom(string roomId)
    {
        if (roomId is null || !Rooms.TryGetValue(roomId, out var room))
        {
            throw new GameException("Room not found.");
        }

        return room;
    }

    private void RemoveRoomIfEmpty(RoomDto update)
    {
        if (update.Players.Length == 0)
        {
            Rooms.TryRemove(update.RoomId, out _);
        }
    }
}
