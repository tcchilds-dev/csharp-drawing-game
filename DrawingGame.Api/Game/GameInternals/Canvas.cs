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
    public StrokeType Type { get; init; }
    public bool IsComplete { get; set; } = false;

    public Stroke(string colour, int width, StrokeType type)
    {
        Colour = colour;
        Width = width;
        Type = type;

        if (type == StrokeType.Fill)
        {
            IsComplete = true;
        }
    }
}

public record Point(double x, double y);

[JsonConverter(typeof(JsonStringEnumConverter<CanvasOperation>))]
public enum CanvasOperation
{
    Start,
    Extend,
    End,
    Fill,
    Undo,
    Clear,
}

[JsonConverter(typeof(JsonStringEnumConverter<StrokeType>))]
public enum StrokeType
{
    Line,
    Fill,
}
