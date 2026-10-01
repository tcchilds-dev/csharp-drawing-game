using System.Collections.Frozen;

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

    public static readonly TimeSpan TurnEndDuration = new TimeSpan(0, 0, seconds: 5);
    public static readonly TimeSpan MatchEndDuration = new TimeSpan(0, 0, seconds: 15);

    public static readonly TimeSpan DisconnectGracePeriod = new TimeSpan(0, 0, seconds: 30);

    // NOTE: Current points system is a placeholder.
    public static readonly (int Min, int Max) GuesserPoints = (50, 150);
    public const int ArtistPointsPerGuess = 25;

    // Drawing limits. These match the frontend's board and brushes.
    public static readonly (int Width, int Height) BoardSize = (1131, 902);
    public static readonly int[] BrushWidths = [4, 8, 14, 22];
    public const int MaxPointsPerExtension = 128;
    public const int MaxPointsPerStroke = 100_000;

    // Strokes may continue off the board to allow a continuous stroke to persist if the cursor
    // leaves and re-enters the canvas.
    public const double MaxCoordinate = 10_000;

    // Frozen set so it's contents can't be changed. Not that it's particularly necessary.
    public static FrozenSet<string> AllowedColours =
    [
        "#1a1a1a",
        "#ffffff",
        "#7c7b7a",
        "#afbcc8",
        "#702963",
        "#800020",
        "#eb212e",
        "#ff4500",
        "#fd9600",
        "#ffbf00",
        "#fff49c",
        "#98fb98",
        "#50c878",
        "#16733d",
        "#7fffd4",
        "#50ebec",
        "#87cefa",
        "#7898ec",
        "#4269e1",
        "#6d00ff",
        "#6a5acd",
        "#c9a0dc",
        "#ffa6c9",
        "#f64a8a",
        "#654444",
        "#6d391d",
        "#c78862",
        "#f9dac2",
    ];
}
