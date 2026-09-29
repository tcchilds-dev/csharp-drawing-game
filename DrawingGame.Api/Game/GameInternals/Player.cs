using System.Security.Cryptography;

namespace DrawingGame.Api.Game.GameInternals;

public class Player
{
    public Guid PlayerId { get; } = Guid.NewGuid();
    public string Username { get; }
    public string ConnectionId { get; set; }
    public string MembershipToken { get; } =
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    // Set while their connection is lost. They keep their seat for a grace period so they can
    // reconnect.
    public DateTimeOffset? DisconnectedAt { get; set; }

    // Which of the frontend's player colours they use. Unique within their room.
    public int ColourIndex { get; set; }

    public Player(string connectionId, string username)
    {
        Username = username;
        ConnectionId = connectionId;
    }
}
