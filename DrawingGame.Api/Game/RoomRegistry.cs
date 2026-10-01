using System.Collections.Concurrent;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Game;

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

    // --- ROOMS AND MEMBERSHIP ---

    public RoomEntryDto CreateRoom(string connectionId, string username)
    {
        username = ValidateUsername(username);

        var player = new Player(connectionId, username);

        GameRoom room;
        do
        {
            room = new GameRoom(player, _timeProvider, _wordListManager);
        } while (!Rooms.TryAdd(room.RoomId, room));

        var member = new RoomMember(player.PlayerId, room.RoomId);

        if (!_membership.TryAdd(connectionId, member))
        {
            Rooms.TryRemove(room.RoomId, out _);
            throw new GameException("This connection is already in a room.");
        }

        var update = DtoConstructor.RoomEntryDto(room, player);

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

    public RoomSnapshotDto LeaveRoom(string connectionId)
    {
        var member = GetMember(connectionId);

        var room = GetRoom(member.RoomId);

        var update = room.LeaveRoom(connectionId, member.PlayerId);
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

    public RoomSnapshotDto? ExpireDisconnectedPlayers(GameRoom room)
    {
        var update = room.RemoveDisconnectedPlayers();
        if (update is null)
        {
            return null;
        }

        RemoveRoomIfEmpty(update);
        return update;
    }

    // --- GAME OPERATIONS ---

    public GameSettingsDto UpdateGameSettings(
        string connectionId,
        GameSettingsUpdateRequest settings
    )
    {
        var member = GetMember(connectionId);

        ValidateSettings(settings);
        var room = GetRoom(member.RoomId);

        var update = room.UpdateGameSettings(connectionId, member.PlayerId, settings);
        return update;
    }

    public PhaseChangeDto? StartGame(string connectionId)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.StartGame(connectionId, member.PlayerId);
        return update;
    }

    public PhaseChangeDto? ChooseWord(string connectionId, string word)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.ChooseWord(connectionId, member.PlayerId, word);
        return update;
    }

    // --- CHAT OPERATIONS ---

    public MessageDto? SendMessage(string connectionId, string body, out RoomSnapshotDto? snapshot)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.SendMessage(connectionId, member.PlayerId, body, out snapshot);
        return update;
    }

    // --- DRAWING OPERATIONS ---

    public CanvasUpdateDto? StartStroke(string connectionId, StrokeInput stroke)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.StartStroke(connectionId, member.PlayerId, stroke);
        return update;
    }

    public CanvasUpdateDto? ExtendStroke(string connectionId, Point[] points)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.ExtendStroke(connectionId, member.PlayerId, points);
        return update;
    }

    public CanvasUpdateDto? EndStroke(string connectionId)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.EndStroke(connectionId, member.PlayerId);
        return update;
    }

    public CanvasUpdateDto? UndoStroke(string connectionId)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.UndoStroke(connectionId, member.PlayerId);
        return update;
    }

    public CanvasUpdateDto? ClearCanvas(string connectionId)
    {
        var member = GetMember(connectionId);
        var room = GetRoom(member.RoomId);

        var update = room.ClearCanvas(connectionId, member.PlayerId);
        return update;
    }

    // --- HELPERS ---

    private RoomMember GetMember(string connectionId)
    {
        if (!_membership.TryGetValue(connectionId, out var member))
        {
            throw new GameException("Room member could not be found.");
        }

        return member;
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

    private void RemoveRoomIfEmpty(RoomSnapshotDto update)
    {
        if (update.Room.Players.Length == 0)
        {
            Rooms.TryRemove(update.Room.RoomId, out _);
        }
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
}
