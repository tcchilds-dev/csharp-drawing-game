using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Game;

public class GameHub(RoomRegistry roomRegistry) : Hub<IGameClient>
{
    // --- ROOMS AND MEMBERSHIP ---

    public async Task<RoomEntryDto> CreateRoom(string username)
    {
        RoomEntryDto update = HandleOperation(() =>
            roomRegistry.CreateRoom(Context.ConnectionId, username)
        );

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Snapshot.Room.RoomId);

        return update;
    }

    public async Task<RoomEntryDto> JoinRoom(string username, string roomId)
    {
        RoomEntryDto update = HandleOperation(() =>
            roomRegistry.JoinRoom(Context.ConnectionId, username, roomId)
        );

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Snapshot.Room.RoomId);
        await Clients.Group(update.Snapshot.Room.RoomId).SyncRoom(update.Snapshot.Room);
        return update;
    }

    public async Task LeaveRoom()
    {
        RoomSnapshotDto update = HandleOperation(() =>
            roomRegistry.LeaveRoom(Context.ConnectionId)
        );

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, update.Room.RoomId);
        await Clients.Group(update.Room.RoomId).FullSync(update);
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

        await Groups.AddToGroupAsync(Context.ConnectionId, update.Snapshot.Room.RoomId);

        // A reconnecting artist needs their word or word choices back.
        if (artistUpdate is not null)
        {
            await Clients.Caller.SyncArtist(artistUpdate);
        }

        return update;
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        roomRegistry.MarkDisconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    // --- GAME OPERATIONS ---

    public async Task UpdateGameSettings(GameSettingsUpdateRequest settings)
    {
        GameSettingsDto update = HandleOperation(() =>
            roomRegistry.UpdateGameSettings(Context.ConnectionId, settings)
        );

        await Clients.Group(update.RoomId).SyncGameSettings(update);
    }

    public async Task StartGame()
    {
        PhaseChangeDto? update = HandleOperation(() =>
            roomRegistry.StartGame(Context.ConnectionId)
        );

        if (update is null)
        {
            return;
        }

        await Clients.Client(update.ArtistConnectionId!).SyncArtist(update.ArtistUpdate!);
        await Clients.Group(update.Snapshot.Room.RoomId).FullSync(update.Snapshot);
    }

    public async Task ChooseWord(string word)
    {
        PhaseChangeDto? update = HandleOperation(() =>
            roomRegistry.ChooseWord(Context.ConnectionId, word)
        );

        if (update is null)
        {
            return;
        }

        await Clients.Client(update.ArtistConnectionId!).SyncArtist(update.ArtistUpdate!);
        await Clients.Group(update.Snapshot.Room.RoomId).FullSync(update.Snapshot);
    }

    // --- CHAT OPERATIONS ---

    public async Task SendMessage(string message)
    {
        MessageDto? messageUpdate;
        RoomSnapshotDto? snapshot;
        try
        {
            messageUpdate = roomRegistry.SendMessage(Context.ConnectionId, message, out snapshot);
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
        if (snapshot is not null)
        {
            if (snapshot.Room.State.CurrentPhase == GamePhase.TurnEnd)
            {
                await Clients.Group(snapshot.Room.RoomId).FullSync(snapshot);
            }
            else
            {
                await Clients.Group(snapshot.Room.RoomId).SyncRoom(snapshot.Room);
            }
        }
    }

    // --- DRAWING OPERATIONS ---

    public Task StartStroke(StrokeInput stroke) =>
        HandleCanvasOperation(() => roomRegistry.StartStroke(Context.ConnectionId, stroke));

    public Task ExtendStroke(Point[] points) =>
        HandleCanvasOperation(() => roomRegistry.ExtendStroke(Context.ConnectionId, points));

    public Task EndStroke() =>
        HandleCanvasOperation(() => roomRegistry.EndStroke(Context.ConnectionId));

    public Task UndoStroke() =>
        HandleCanvasOperation(() => roomRegistry.UndoStroke(Context.ConnectionId));

    public Task ClearCanvas() =>
        HandleCanvasOperation(() => roomRegistry.ClearCanvas(Context.ConnectionId));

    // --- HELPERS ---

    private T HandleOperation<T>(Func<T> operation)
    {
        try
        {
            return operation();
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }
    }

    private async Task HandleCanvasOperation(Func<CanvasUpdateDto?> canvasOperation)
    {
        CanvasUpdateDto? update;
        try
        {
            update = canvasOperation();
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
