namespace DrawingGame.Api.Game.DataTransferObjects;

public record SessionDetails(
    // To find the room they were in:
    string RoomId,
    // To match with the membership token:
    Guid PlayerId,
    // To update socket connection ID:
    string ConnectionId,
    // To prove authenticity:
    string MembershipToken
);
