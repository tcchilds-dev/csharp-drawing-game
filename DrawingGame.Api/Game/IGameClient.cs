using DrawingGame.Api.Game.DataTransferObjects;

namespace DrawingGame.Api.Game;

public interface IGameClient
{
    Task SyncRoom(RoomSyncDetails roomDetails);
}
