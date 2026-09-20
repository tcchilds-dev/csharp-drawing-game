namespace DrawingGame.Api.Game.GameInternals;

public class Canvas
{
    public List<Stroke> Strokes = new();
    public Stroke? ActiveStroke;
}

public class Stroke
{
    public required string Colour { get; init; }
    public required int Width { get; init; }
    public List<Point> Points { get; } = new();
    public bool IsComplete { get; set; } = false;
}

public record Point(double x, double y);
