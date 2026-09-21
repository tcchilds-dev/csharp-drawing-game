namespace DrawingGame.Api.Game.GameInternals;

public class GameState
{
    public GamePhase CurrentPhase { get; set; } = GamePhase.Lobby;
    public Guid? CurrentArtist { get; set; }
    public int? CurrentTurn { get; set; }
    public int? CurrentRound { get; set; }
    public string? CurrentWord { get; set; }
    public string? MaskedWord { get; set; }
    public DateTimeOffset? PhaseEndsAt { get; set; }

    public List<Guid> TurnOrder = new();
    public Dictionary<Guid, int> Scores = new();
    public HashSet<Guid> PlayersMarkedCorrect = new();
    public List<string>? WordChoices;

    public GameState(Player host)
    {
        TurnOrder.Add(host.PlayerId);
        Scores.Add(host.PlayerId, 0);
    }

    public void PrepareStartingRoomState()
    {
        CurrentArtist = TurnOrder[0];
        CurrentTurn = 1;
        CurrentRound = 1;
        CurrentWord = null;
        MaskedWord = null;
        PhaseEndsAt = null;
        ResetScores();
        PlayersMarkedCorrect.Clear();
        WordChoices = null;
    }

    private void ResetScores()
    {
        Scores.Clear();

        foreach (var playerId in TurnOrder)
        {
            Scores.Add(playerId, 0);
        }
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
