namespace DrawingGame.Api.Game.GameInternals;

public class GameSettings
{
    public int MaxPlayers { get; } = 6;
    public int WordSelectionSize { get; set; } = 3;
    public int WordChoiceTimerSeconds { get; set; } = 30;
    public int DrawTimerSeconds { get; set; } = 80;
    public int NumberOfRounds { get; set; } = 3;
}
