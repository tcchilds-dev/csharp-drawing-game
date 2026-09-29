using System.Text.Json.Serialization;

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

    public bool Undo()
    {
        if (ActiveStroke is not null)
        {
            ActiveStroke = null;
            return true;
        }

        return Strokes.TryPop(out _);
    }
}

public class Stroke
{
    public string Colour { get; init; }
    public int Width { get; init; }
    public List<Point> Points { get; } = new();
    public bool IsComplete { get; set; } = false;

    public Stroke(string colour, int width)
    {
        Colour = colour;
        Width = width;
    }
}

public record Point(double x, double y);

[JsonConverter(typeof(JsonStringEnumConverter<CanvasOperation>))]
public enum CanvasOperation
{
    Start,
    Extend,
    End,
    Undo,
    Clear,
}
