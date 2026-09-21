using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using Microsoft.AspNetCore.SignalR;

namespace DrawingGame.Api.Game;

public class GameHub(RoomRegistry roomRegistry) : Hub<IGameClient>
{
    public async Task<RoomEntryDetails> CreateRoom(string username)
    {
        RoomEntryDetails details;
        try
        {
            details = roomRegistry.CreateRoom(Context.ConnectionId, username);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, details.Session.RoomId);

        return details;
    }

    public async Task<RoomEntryDetails> JoinRoom(string username, string roomId)
    {
        RoomEntryDetails details;
        try
        {
            details = roomRegistry.JoinRoom(Context.ConnectionId, username, roomId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, details.Session.RoomId);
        await Clients.Group(details.Session.RoomId).SyncRoom(details.Room);
        return details;
    }

    public async Task<RoomEntryDetails> ReconnectToRoom(SessionDetails session)
    {
        throw new NotImplementedException();
    }

    public async Task UpdateGameSettings(GameSettingsDetails settings)
    {
        RoomSyncDetails details;
        try
        {
            details = roomRegistry.UpdateGameSettings(Context.ConnectionId, settings);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        await Clients.Group(details.RoomId).SyncRoom(details);

        // NOTE: Do I need to hand details back here if I'm already broadcasting?
        // Presumably it's better for consistencies sake to only do the broadcast.
        return;
    }

    public async Task<RoomSyncDetails?> SendMessage(string message)
    {
        RoomSyncDetails? details;
        try
        {
            details = roomRegistry.SendMessage(Context.ConnectionId, message);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (details is null)
        {
            return null;
        }

        await Clients.OthersInGroup(details.RoomId).SyncRoom(details);

        return details;
    }

    public async Task StartGame()
    {
        ActiveGameDetails? details;
        try
        {
            details = roomRegistry.StartGame(Context.ConnectionId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (details is null)
        {
            return;
        }

        await Clients.Client(details.ArtistConnectionId).SyncArtist(details.ArtistDetails);
        await Clients.Group(details.RoomSyncDetails.RoomId).SyncRoom(details.RoomSyncDetails);
        return;
    }

    public async Task ChooseWord(string word)
    {
        ActiveGameDetails? details;
        try
        {
            details = roomRegistry.ChooseWord(Context.ConnectionId, word);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (details is null)
        {
            return;
        }

        await Clients.Client(details.ArtistConnectionId).SyncArtist(details.ArtistDetails);
        await Clients.Group(details.RoomSyncDetails.RoomId).SyncRoom(details.RoomSyncDetails);
        return;
    }

    public async Task StrokeStart() { }

    public async Task StrokeExtend() { }

    public async Task StrokeEnd() { }

    public async Task UndoStroke()
    {
        RoomSyncDetails? details;
        try
        {
            details = roomRegistry.UndoStroke(Context.ConnectionId);
        }
        catch (GameException e)
        {
            throw new HubException(e.Message);
        }

        if (details is null)
        {
            return;
        }

        await Clients.Group(details.RoomId).SyncRoom(details);
    }

    public async Task ClearCanvas() { }

    public async Task LeaveGame() { }

    // public override Task OnDisconnectedAsync() { }
}
