namespace DrawingGame.Api.Game.GameInternals;

public class GameSettings
{
    public int MaxPlayers { get; } = 6;
    public WordSelectionSize WordSelectionSize { get; set; } = WordSelectionSize.Three;
    public TimeSpan WordChoiceTimerSeconds { get; set; } = new TimeSpan(0, 0, seconds: 30);
    public TimeSpan DrawTimerSeconds { get; set; } = new TimeSpan(0, 0, seconds: 80);
    public int NumberOfRounds { get; set; } = 3;
}

public enum WordSelectionSize
{
    Three = 3,
    Five = 5,
}
