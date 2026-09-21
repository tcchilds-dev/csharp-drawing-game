namespace DrawingGame.Api.Game.DataTransferObjects;

public record ActiveGameDetails(
    string ArtistConnectionId,
    ArtistDetails ArtistDetails,
    RoomSyncDetails RoomSyncDetails
);

public record ArtistDetails(string? CurrentWord, List<string>? WordChoices);
