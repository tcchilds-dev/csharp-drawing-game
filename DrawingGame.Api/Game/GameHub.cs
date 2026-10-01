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

    public async Task LeaveRoom()
    {
        RoomDto update;
        try
        {
            update = roomRegistry.LeaveRoom(Context.ConnectionId);
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
        RoomEntryDto update;
        ArtistUpdateDto? artistUpdate;
        try
        {
            update = roomRegistry.ReconnectToRoom(Context.ConnectionId, session, out artistUpdate);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Room.RoomId);

        // A reconnecting artist needs their word or word choices back.
        if (artistUpdate is not null)
        {
            await Clients.Caller.SyncArtist(artistUpdate);
        }

        return update;
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

        return;
    }

    public async Task SendMessage(string message)
    {
        MessageDto? messageUpdate;
        RoomDto? roomUpdate;
        try
        {
            messageUpdate = roomRegistry.SendMessage(Context.ConnectionId, message, out roomUpdate);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (messageUpdate is null)
        {
            return;
        }

        await Clients.Group(messageUpdate.RoomId).SyncMessage(messageUpdate);
        if (roomUpdate is not null)
        {
            await Clients.Group(roomUpdate.RoomId).SyncRoom(roomUpdate);
        }
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

    public async Task ChooseWord(string word)
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

    public Task StartStroke(StrokeInput stroke) =>
        PublishCanvasUpdate(() => roomRegistry.StartStroke(Context.ConnectionId, stroke));

    public Task ExtendStroke(Point[] points) =>
        PublishCanvasUpdate(() => roomRegistry.ExtendStroke(Context.ConnectionId, points));

    public Task EndStroke() =>
        PublishCanvasUpdate(() => roomRegistry.EndStroke(Context.ConnectionId));

    public Task UndoStroke() =>
        PublishCanvasUpdate(() => roomRegistry.UndoStroke(Context.ConnectionId));

    public Task ClearCanvas() =>
        PublishCanvasUpdate(() => roomRegistry.ClearCanvas(Context.ConnectionId));

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        roomRegistry.MarkDisconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private async Task PublishCanvasUpdate(Func<CanvasUpdateDto?> drawingCommand)
    {
        CanvasUpdateDto? update;
        try
        {
            update = drawingCommand();
        }
        catch (DrawingRejectedException e)
        {
            // Undo whatever the artist already drew locally for this command.
            await Clients.Caller.SyncCanvas(e.Canvas);
            throw new HubException(e.Message);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (update is null)
        {
            return;
        }

        await Clients.OthersInGroup(update.RoomId).SyncCanvasUpdate(update);
    }
}
