namespace DrawingGame.Api.Game.GameInternals;

public class GameSettings
{
    // Reason for 6 player max is game pacing. We don't want players waiting too long to take
    // their turn.
    public int MaxPlayers { get; } = 6;
    public WordSelectionSize WordSelectionSize { get; set; } = WordSelectionSize.Three;
    public TimeSpan WordChoiceTimeLimit { get; set; } = new TimeSpan(0, 0, seconds: 30);
    public TimeSpan DrawTimeLimit { get; set; } = new TimeSpan(0, 0, seconds: 80);
    public int NumberOfRounds { get; set; } = 3;
}

public enum WordSelectionSize
{
    Three = 3,
    Five = 5,
}
