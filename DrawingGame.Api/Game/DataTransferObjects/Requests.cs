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
    // To update socket connection ID.
    string ConnectionId,
    // To prove authenticity.
    string MembershipToken
);
