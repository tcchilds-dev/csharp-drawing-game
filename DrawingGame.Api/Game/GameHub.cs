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

    public async Task UpdateGameSettings() { }

    public async Task SendMessage() { }

    public async Task StartGame() { }

    public async Task ChooseWord() { }

    public async Task StrokeStart() { }

    public async Task StrokeExtend() { }

    public async Task StrokeEnd() { }

    public async Task UndoStroke() { }

    public async Task ClearCanvas() { }

    public async Task LeaveGame() { }

    // public override Task OnDisconnectedAsync() { }
}
