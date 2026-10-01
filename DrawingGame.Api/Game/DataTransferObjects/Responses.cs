using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.DataTransferObjects;

public record PhaseChangeDto(
    string? ArtistConnectionId,
    ArtistUpdateDto? ArtistUpdate,
    RoomSnapshotDto Snapshot
);

public record ArtistUpdateDto(long Revision, string? CurrentWord, string[]? WordChoices);

public record RoomEntryDto(SessionDto Session, RoomSnapshotDto Snapshot);

public record RoomSnapshotDto(RoomDto Room, ChatDto Chat, CanvasDto Canvas);

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
    GameSettingsDto Settings,
    GameStateDto State,
    // Lets clients correct their phase timers drifting.
    DateTimeOffset ServerTime
);

public record PlayerDto(Guid PlayerId, string Username, int ColourIndex);

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
    // Only set during TurnEnd.
    string? RevealedWord,
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

// A single drawing command, so guessers don't need the whole canvas for every new point.
// Stroke is only set for Start, and Points only for Extend.
public record CanvasUpdateDto(
    long Revision,
    string RoomId,
    CanvasOperation Operation,
    Stroke? Stroke,
    Point[]? Points
);
