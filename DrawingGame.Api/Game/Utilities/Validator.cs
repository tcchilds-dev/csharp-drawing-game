namespace DrawingGame.Api.Game.Utilities;

public static class Validator
{
    private const int MinUsernameLength = 2;
    private const int MaxUsernameLength = 16;

    public static string ValidateUsername(string username)
    {
        username = username?.Trim() ?? string.Empty;
        if (username.Length is < MinUsernameLength or > MaxUsernameLength)
        {
            throw new GameException("Names must be between 2 and 16 characters long.");
        }
        return username;
    }

    public static string ValidateRoomId(string roomId)
    {
        roomId = roomId?.Trim() ?? string.Empty;
        if (roomId.Length != RoomIdGenerator.RoomIdLength)
        {
            throw new GameException("Invalid room code.");
        }
        return roomId;
    }
}
