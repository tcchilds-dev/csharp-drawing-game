using DrawingGame.Api.Game.DataTransferObjects;
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

    public async Task<RoomEntryDto> ReconnectToRoom(SessionRestorationRequest session)
    {
        throw new NotImplementedException();
    }

    public async Task UpdateGameSettings(GameSettingsUpdateRequest settings)
    {
        GameSettingsDto update;
        try
        {
            update = roomRegistry.UpdateGameSettings(Context.ConnectionId, settings);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Clients.Group(update.RoomId).SyncGameSettings(update);

        // NOTE: Do I need to hand update back here if I'm already broadcasting?
        // Presumably it's better for consistencies sake to only do the broadcast.
        return;
    }

    public async Task<ChatDto?> SendMessage(string message)
    {
        ChatDto? update;
        try
        {
            update = roomRegistry.SendMessage(Context.ConnectionId, message);
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

    public async Task StartGame()
    {
        PhaseChangeDto? update;
        try
        {
            update = roomRegistry.StartGame(Context.ConnectionId);
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

    public async Task ChooseWord(string? word)
    {
        PhaseChangeDto? update;
        try
        {
            update = roomRegistry.ChooseWord(Context.ConnectionId, word);
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

    public async Task StrokeStart()
    {
        throw new NotImplementedException();
    }

    public async Task StrokeExtend()
    {
        throw new NotImplementedException();
    }

    public async Task StrokeEnd()
    {
        throw new NotImplementedException();
    }

    public async Task UndoStroke()
    {
        CanvasDto? update;
        try
        {
            update = roomRegistry.UndoStroke(Context.ConnectionId);
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

    public async Task ClearCanvas()
    {
        throw new NotImplementedException();
    }

    public async Task LeaveGame()
    {
        throw new NotImplementedException();
    }

    // public override Task OnDisconnectedAsync() { }
}
