using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.DataTransferObjects;

public record GameSettingsUpdateRequest(
    WordSelectionSize WordSelectionSize,
    TimeSpan WordChoiceTimeLimit,
    TimeSpan DrawTimeLimit,
    int NumberOfRounds
);

public record SessionRestorationRequest(
    // To find the room they were in.
    string RoomId,
    // To match with the membership token.
    Guid PlayerId,
    // To prove authenticity.
    string MembershipToken
);

public record StrokeInput(string Colour, int Width, Point[]? Points);
