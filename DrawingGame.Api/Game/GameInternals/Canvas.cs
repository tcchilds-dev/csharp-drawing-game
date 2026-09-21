namespace DrawingGame.Api.Game.GameInternals;

public class Canvas
{
    public Stack<Stroke> Strokes = new();
    public Stroke? ActiveStroke = null;

    public void Clear()
    {
        Strokes.Clear();
        ActiveStroke = null;
    }
}

public class Stroke
{
    public required string Colour { get; init; }
    public required int Width { get; init; }
    public List<Point> Points { get; } = new();
    public bool IsComplete { get; set; } = false;
}

public record Point(double x, double y);
