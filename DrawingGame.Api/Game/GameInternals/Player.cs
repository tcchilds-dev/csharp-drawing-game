using System.Security.Cryptography;

namespace DrawingGame.Api.Game.GameInternals;

public class Player
{
    public Guid PlayerId { get; } = Guid.NewGuid();
    public string Username { get; }
    public string ConnectionId { get; set; }
    public string MembershipToken { get; } =
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public Player(string connectionId, string username)
    {
        Username = username;
        ConnectionId = connectionId;
    }
}
