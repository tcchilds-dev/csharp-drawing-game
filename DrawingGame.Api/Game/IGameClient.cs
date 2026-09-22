using DrawingGame.Api.Game.DataTransferObjects;

namespace DrawingGame.Api.Game;

public interface IGameClient
{
    Task SyncRoom(RoomDetails roomDetails);
    Task SyncArtist(ArtistDetails artistDetails);
    Task PhaseChange(RoomDetails roomDetails);
}
