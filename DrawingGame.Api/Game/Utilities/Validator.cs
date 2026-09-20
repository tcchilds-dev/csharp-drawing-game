using DrawingGame.Api.Game.DataTransferObjects;

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

    // TODO: Sort out hardcoding -> Server settings.
    public static void ValidateSettings(GameSettingsDetails settings)
    {
        if (settings.WordSelectionSize != 3 && settings.WordSelectionSize != 5)
        {
            throw new GameException("Word selection size must be 3 or 5.");
        }

        if (settings.WordChoiceTimerSeconds < 10 || settings.WordChoiceTimerSeconds > 60)
        {
            throw new GameException("Word choice timer must be 10 to 60 seconds.");
        }

        if (settings.DrawTimerSeconds < 60 || settings.DrawTimerSeconds > 180)
        {
            throw new GameException("Draw timer must be 60 to 180 seconds.");
        }

        if (settings.NumberOfRounds < 1 || settings.NumberOfRounds > 10)
        {
            throw new GameException("Number of rounds must be 1 to 10 rounds.");
        }
    }
}
