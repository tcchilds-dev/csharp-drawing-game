using DrawingGame.Api.Game.DataTransferObjects;

namespace DrawingGame.Api.Game;

public interface IGameClient
{
    Task SyncRoom(RoomDto room);
    Task SyncGameSettings(GameSettingsDto settings);
    Task SyncMessage(MessageDto message);
    Task SyncArtist(ArtistUpdateDto update);
    Task SyncCanvas(CanvasDto canvas);
}
