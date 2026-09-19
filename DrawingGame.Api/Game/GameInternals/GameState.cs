namespace DrawingGame.Api.Game.GameInternals;

public class GameState
{
    public GamePhase CurrentPhase { get; private set; } = GamePhase.Lobby;
    public int? CurrentAristIndex { get; private set; }
    public int? CurrentTurn { get; private set; }
    public int? CurrentRound { get; private set; }
    public string? CurrentWord { get; private set; }
    public string? MaskedWord { get; private set; }
    public DateTimeOffset? PhaseEndsAt { get; private set; }

    public List<Guid> TurnOrder = new();
    public Dictionary<Guid, int> Scores = new();
    public HashSet<Guid> PlayersMarkedCorrect = new();
    public List<string>? WordChoices;

    public GameState(Player host)
    {
        TurnOrder.Add(host.PlayerId);
        Scores.Add(host.PlayerId, 0);
    }
}

public enum GamePhase
{
    Lobby,
    ChoosingWord,
    Drawing,
    TurnEnd,
    MatchEnd,
}
