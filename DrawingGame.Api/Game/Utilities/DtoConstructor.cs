using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.Utilities;

public static class DtoConstructor
{
    public static RoomEntryDto RoomEntryDto(GameRoom room, Player player)
    {
        var sessionUpdate = CreateSessionDto(room, player);
        var roomUpdate = RoomDto(room);

        return new RoomEntryDto(sessionUpdate, roomUpdate);
    }

    public static PhaseChangeDto PhaseChangeDto(GameRoom room, string? artistConnectionId)
    {
        var roomUpdate = RoomDto(room);

        if (artistConnectionId is not null)
        {
            var artistUpdate = new ArtistUpdateDto(room.State.CurrentWord, room.State.WordChoices);

            return new PhaseChangeDto(artistConnectionId, artistUpdate, roomUpdate);
        }

        return new PhaseChangeDto(null, null, roomUpdate);
    }

    public static RoomDto RoomDto(GameRoom room)
    {
        var settingsUpdate = GameSettingsDto(room);
        var stateUpdate = CreateGameStateDto(room);
        var canvasUpdate = CanvasDto(room);
        var chatHistory = ChatDto(room);
        var players = new List<PlayerDto>();

        foreach (var player in room.Players.Values)
        {
            players.Add(CreatePlayerDto(player));
        }

        return new RoomDto(
            room.RoomId,
            room.HostPlayerId,
            room.Revision,
            players.ToArray(),
            chatHistory,
            settingsUpdate,
            stateUpdate,
            canvasUpdate
        );
    }

    public static GameSettingsDto GameSettingsDto(GameRoom room)
    {
        return new GameSettingsDto(
            room.Revision,
            room.RoomId,
            room.Settings.MaxPlayers,
            room.Settings.WordSelectionSize,
            room.Settings.WordChoiceTimeLimit,
            room.Settings.DrawTimeLimit,
            room.Settings.NumberOfRounds
        );
    }

    public static GameStateDto CreateGameStateDto(GameRoom room)
    {
        return new GameStateDto(
            room.Revision,
            room.State.CurrentPhase,
            room.State.CurrentArtist,
            room.State.CurrentTurn,
            room.State.CurrentRound,
            room.State.MaskedWord,
            room.State.PhaseEndsAt,
            room.State.TurnOrder.ToArray(),
            room.State.Scores,
            room.State.PlayersMarkedCorrect
        );
    }

    public static ChatDto ChatDto(GameRoom room)
    {
        return new ChatDto(room.Revision, room.RoomId, room.Chat);
    }

    public static CanvasDto CanvasDto(GameRoom room)
    {
        return new CanvasDto(
            room.Revision,
            room.RoomId,
            room.Canvas.Strokes.ToArray(),
            room.Canvas.ActiveStroke
        );
    }

    public static PlayerDto CreatePlayerDto(Player player)
    {
        return new PlayerDto(player.PlayerId, player.Username);
    }

    public static SessionDto CreateSessionDto(GameRoom room, Player player)
    {
        return new SessionDto(player.PlayerId, player.MembershipToken);
    }
}
