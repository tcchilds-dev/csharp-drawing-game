namespace DrawingGame.Api.Game.Utilities;

public static class GameConstants
{
    public static readonly (int Min, int Max) UsernameLength = (2, 16);

    public const int MaxMessageLength = 200;

    public static readonly (TimeSpan Min, TimeSpan Max) WordChoiceTimerSeconds = (
        new TimeSpan(0, 0, 10),
        new TimeSpan(0, 0, 60)
    );
    public static readonly (TimeSpan Min, TimeSpan Max) DrawTimerSeconds = (
        new TimeSpan(0, 0, 60),
        new TimeSpan(0, 0, 180)
    );
    public static readonly (int Min, int Max) NumberOfRounds = (1, 10);
}
