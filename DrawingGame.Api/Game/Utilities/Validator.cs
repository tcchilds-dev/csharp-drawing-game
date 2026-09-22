using DrawingGame.Api.Game.DataTransferObjects;

namespace DrawingGame.Api.Game.Utilities;

public static class Validator
{
    public static string ValidateUsername(string username)
    {
        username = username?.Trim() ?? string.Empty;
        if (
            username.Length < GameConstants.UsernameLength.Min
            || username.Length > GameConstants.UsernameLength.Max
        )
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

    public static void ValidateSettings(GameSettingsUpdateRequest settings)
    {
        var choiceTimeLimit = GameConstants.WordChoiceTimeLimit;
        var drawTimeLimit = GameConstants.DrawTimeLimit;
        var rounds = GameConstants.NumberOfRounds;

        if (
            settings.WordChoiceTimeLimit < choiceTimeLimit.Min
            || settings.WordChoiceTimeLimit > choiceTimeLimit.Max
        )
        {
            throw new GameException(
                $"Word choice timer must be {choiceTimeLimit.Min} to {choiceTimeLimit.Max} seconds."
            );
        }

        if (
            settings.DrawTimeLimit < drawTimeLimit.Min
            || settings.DrawTimeLimit > drawTimeLimit.Max
        )
        {
            throw new GameException(
                $"Draw timer must be {drawTimeLimit.Min} to {drawTimeLimit.Max} seconds."
            );
        }

        if (settings.NumberOfRounds < rounds.Min || settings.NumberOfRounds > rounds.Max)
        {
            throw new GameException(
                $"Number of rounds must be {rounds.Min} to {rounds.Max} rounds."
            );
        }
    }
}
