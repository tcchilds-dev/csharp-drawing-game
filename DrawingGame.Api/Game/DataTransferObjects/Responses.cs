using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.DataTransferObjects;

public record PhaseChangeDto(
    string? ArtistConnectionId,
    ArtistUpdateDto? ArtistUpdate,
    RoomDto Room
);

public record ArtistUpdateDto(string? CurrentWord, string[]? WordChoices);

public record RoomEntryDto(SessionDto Session, RoomDto Room);

public record SessionDto(
    // To match with the membership token.
    Guid PlayerId,
    // To prove authenticity.
    string MembershipToken
);

public record RoomDto(
    string RoomId,
    Guid HostPlayerId,
    long Revision,
    PlayerDto[] Players,
    ChatDto ChatHistory,
    GameSettingsDto Settings,
    GameStateDto State,
    CanvasDto Canvas
);

public record PlayerDto(Guid PlayerId, string Username);

public record ChatDto(long Revision, string RoomId, Chat ChatHistory);

public record MessageDto(long Revision, string RoomId, Message Message);

public record GameSettingsDto(
    long Revision,
    string RoomId,
    int MaxPlayers,
    WordSelectionSize WordSelectionSize,
    TimeSpan WordChoiceTimeLimit,
    TimeSpan DrawTimeLimit,
    int NumberOfRounds
);

public record GameStateDto(
    long Revision,
    GamePhase CurrentPhase,
    Guid? CurrentArtist,
    int? CurrentTurn,
    int? CurrentRound,
    string? MaskedWord,
    DateTimeOffset? PhaseEndsAt,
    Guid[] TurnOrder,
    Dictionary<Guid, int> Scores,
    HashSet<Guid> PlayersMarkedCorrect
);

public record CanvasDto(
    long Revision,
    string RoomId,
    Stroke[] CompletedStrokes,
    Stroke? ActiveStroke
);
