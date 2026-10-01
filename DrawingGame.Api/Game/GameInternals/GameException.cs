using DrawingGame.Api.Game.DataTransferObjects;

namespace DrawingGame.Api.Game.GameInternals;

public class GameException : Exception
{
    public GameException(string message)
        : base(message) { }
}

public class DrawingRejectedException : GameException
{
    public CanvasDto Canvas { get; }

    public DrawingRejectedException(string message, CanvasDto canvas)
        : base(message)
    {
        Canvas = canvas;
    }
}
