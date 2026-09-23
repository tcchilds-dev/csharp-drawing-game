using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Game;

public class GameHub(RoomRegistry roomRegistry) : Hub<IGameClient>
{
    public async Task<RoomEntryDto> CreateRoom(string username)
    {
        RoomEntryDto update;
        try
        {
            update = roomRegistry.CreateRoom(Context.ConnectionId, username);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Room.RoomId);

        return update;
    }

    public async Task<RoomEntryDto> JoinRoom(string username, string roomId)
    {
        RoomEntryDto update;
        try
        {
            update = roomRegistry.JoinRoom(Context.ConnectionId, username, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Room.RoomId);
        await Clients.Group(update.Room.RoomId).SyncRoom(update.Room);
        return update;
    }

    public async Task LeaveRoom(Guid playerId, string roomId)
    {
        RoomDto update;
        try
        {
            update = roomRegistry.LeaveRoom(Context.ConnectionId, playerId, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, update.RoomId);
        await Clients.Group(update.RoomId).SyncRoom(update);
    }

    public async Task<RoomEntryDto> ReconnectToRoom(SessionRestorationRequest session)
    {
        throw new NotImplementedException();
    }

    public async Task UpdateGameSettings(
        Guid playerId,
        string roomId,
        GameSettingsUpdateRequest settings
    )
    {
        GameSettingsDto update;
        try
        {
            update = roomRegistry.UpdateGameSettings(
                Context.ConnectionId,
                playerId,
                roomId,
                settings
            );
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Clients.Group(update.RoomId).SyncGameSettings(update);

        return;
    }

    public async Task<ChatDto?> SendMessage(Guid playerId, string roomId, string message)
    {
        ChatDto? update;
        try
        {
            update = roomRegistry.SendMessage(Context.ConnectionId, playerId, roomId, message);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return null;
        }

        await Clients.OthersInGroup(update.RoomId).SyncChat(update);

        return update;
    }

    public async Task StartGame(Guid playerId, string roomId)
    {
        PhaseChangeDto? update;
        try
        {
            update = roomRegistry.StartGame(Context.ConnectionId, playerId, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        if (update.ArtistConnectionId is null || update.ArtistUpdate is null)
        {
            throw new NullReferenceException("Artist information should not be null here.");
        }

        await Clients.Client(update.ArtistConnectionId).SyncArtist(update.ArtistUpdate);
        await Clients.Group(update.Room.RoomId).SyncRoom(update.Room);
        return;
    }

    public async Task ChooseWord(Guid playerId, string roomId, string word)
    {
        PhaseChangeDto? update;
        try
        {
            update = roomRegistry.ChooseWord(Context.ConnectionId, playerId, roomId, word);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        if (update.ArtistConnectionId is null || update.ArtistUpdate is null)
        {
            throw new NullReferenceException("Artist information should not be null here.");
        }

        await Clients.Client(update.ArtistConnectionId).SyncArtist(update.ArtistUpdate);
        await Clients.Group(update.Room.RoomId).SyncRoom(update.Room);
        return;
    }

    public async Task StartStroke(Guid playerId, string roomId, StrokeInput stroke)
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.StartStroke(Context.ConnectionId, playerId, roomId, stroke);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.OthersInGroup(update.RoomId).SyncCanvas(update);
    }

    public async Task ExtendStroke(Guid playerId, string roomId, Point[] points)
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.ExtendStroke(Context.ConnectionId, playerId, roomId, points);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.OthersInGroup(update.RoomId).SyncCanvas(update);
    }

    public async Task EndStroke(Guid playerId, string roomId)
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.EndStroke(Context.ConnectionId, playerId, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.OthersInGroup(update.RoomId).SyncCanvas(update);
    }

    public async Task UndoStroke(Guid playerId, string roomId)
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.UndoStroke(Context.ConnectionId, playerId, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.Group(update.RoomId).SyncCanvas(update);
    }

    public async Task ClearCanvas(Guid playerId, string roomId)
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.ClearCanvas(Context.ConnectionId, playerId, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.Group(update.RoomId).SyncCanvas(update);
    }

    // public override Task OnDisconnectedAsync() { }
}
