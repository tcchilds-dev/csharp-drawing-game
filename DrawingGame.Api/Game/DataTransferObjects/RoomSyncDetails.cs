using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.DataTransferObjects;

public record RoomSyncDetails(
    string RoomId,
    Guid HostPlayerId,
    long Revision,
    List<PlayerDetails> Players,
    Chat ChatHistory,
    GameSettingsDetails Settings,
    GameStateDetails State,
    Canvas Canvas
);

public record GameSettingsDetails(
    int MaxPlayers,
    int WordSelectionSize,
    int WordChoiceTimerSeconds,
    int DrawTimerSeconds,
    int NumberOfRounds
);

public record GameStateDetails(
    GamePhase CurrentPhase,
    int? CurrentArtistIndex,
    int? CurrentTurn,
    int? CurrentRound,
    string? CurrentWord,
    string? MaskedWork,
    DateTimeOffset? PhaseEndsAt,
    List<Guid> TurnOrder,
    Dictionary<Guid, int> Scores,
    HashSet<Guid> PlayersMarkedCorrect,
    List<string>? WordChoices
);

public record PlayerDetails(Guid PlayerId, string Username);
