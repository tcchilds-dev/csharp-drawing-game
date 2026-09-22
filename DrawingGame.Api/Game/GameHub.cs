using DrawingGame.Api.Game.DataTransferObjects;
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
        RoomDetails details;
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

    public async Task<RoomDetails?> SendMessage(string message)
    {
        RoomDetails? details;
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
        GameDetails? details;
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

        if (details.ArtistConnectionId is null || details.ArtistDetails is null)
        {
            throw new NullReferenceException("Artist information should not be null here.");
        }

        await Clients.Client(details.ArtistConnectionId).SyncArtist(details.ArtistDetails);
        await Clients.Group(details.RoomDetails.RoomId).SyncRoom(details.RoomDetails);
        return;
    }

    public async Task ChooseWord(string? word)
    {
        GameDetails? details;
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

        if (details.ArtistConnectionId is null || details.ArtistDetails is null)
        {
            throw new NullReferenceException("Artist information should not be null here.");
        }

        await Clients.Client(details.ArtistConnectionId).SyncArtist(details.ArtistDetails);
        await Clients.Group(details.RoomDetails.RoomId).SyncRoom(details.RoomDetails);
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
        RoomDetails? details;
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
