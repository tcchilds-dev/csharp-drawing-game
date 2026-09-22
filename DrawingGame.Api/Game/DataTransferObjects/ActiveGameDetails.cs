namespace DrawingGame.Api.Game.DataTransferObjects;

public record GameDetails(
    string? ArtistConnectionId,
    ArtistDetails? ArtistDetails,
    RoomDetails RoomDetails
);

public record ArtistDetails(string? CurrentWord, string[]? WordChoices);
