using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.DataTransferObjects;

public record RoomDetails(
    string RoomId,
    Guid HostPlayerId,
    long Revision,
    List<PlayerDetails> Players,
    Chat ChatHistory,
    GameSettingsDetails Settings,
    GameStateDetails State,
    CanvasDetails Canvas
);

public record GameSettingsDetails(
    int MaxPlayers,
    WordSelectionSize WordSelectionSize,
    TimeSpan WordChoiceTimeLimit,
    TimeSpan DrawTimeLimit,
    int NumberOfRounds
);

public record GameStateDetails(
    GamePhase CurrentPhase,
    Guid? CurrentArtist,
    int? CurrentTurn,
    int? CurrentRound,
    string? MaskedWord,
    DateTimeOffset? PhaseEndsAt,
    List<Guid> TurnOrder,
    Dictionary<Guid, int> Scores,
    HashSet<Guid> PlayersMarkedCorrect
);

public record CanvasDetails(Stack<Stroke> Strokes, Stroke? ActiveStroke);

public record PlayerDetails(Guid PlayerId, string Username);
