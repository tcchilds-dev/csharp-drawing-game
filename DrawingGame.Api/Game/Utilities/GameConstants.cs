namespace DrawingGame.Api.Game.Utilities;

public static class GameConstants
{
    public static readonly (int Min, int Max) UsernameLength = (2, 16);

    public const int MaxMessageLength = 200;

    public static readonly (TimeSpan Min, TimeSpan Max) WordChoiceTimeLimit = (
        new TimeSpan(0, 0, 10),
        new TimeSpan(0, 0, 60)
    );
    public static readonly (TimeSpan Min, TimeSpan Max) DrawTimeLimit = (
        new TimeSpan(0, 0, 60),
        new TimeSpan(0, 0, 180)
    );
    public static readonly (int Min, int Max) NumberOfRounds = (1, 10);

    // NOTE: These may need to be tweaked.
    public static readonly TimeSpan TurnEndDuration = new TimeSpan(0, 0, seconds: 5);
    public static readonly TimeSpan MatchEndDuration = new TimeSpan(0, 0, seconds: 15);
}
