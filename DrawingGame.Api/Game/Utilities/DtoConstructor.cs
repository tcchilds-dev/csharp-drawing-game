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
            var artistUpdate = ArtistUpdateDto(room);

            return new PhaseChangeDto(artistConnectionId, artistUpdate, roomUpdate);
        }

        return new PhaseChangeDto(null, null, roomUpdate);
    }

    public static ArtistUpdateDto ArtistUpdateDto(GameRoom room)
    {
        return new ArtistUpdateDto(
            room.Revision,
            room.State.CurrentWord,
            room.State.WordChoices?.ToArray()
        );
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
            canvasUpdate,
            room.Now
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
            room.State.CurrentPhase == GamePhase.TurnEnd ? room.State.CurrentWord : null,
            room.State.PhaseEndsAt,
            room.State.TurnOrder.ToArray(),
            new Dictionary<Guid, int>(room.State.Scores),
            new HashSet<Guid>(room.State.PlayersMarkedCorrect)
        );
    }

    public static ChatDto ChatDto(GameRoom room)
    {
        var chat = new Chat();
        foreach (var message in room.Chat.Messages)
        {
            chat.Messages.Add(
                new Message(
                    message.PlayerId,
                    message.Username,
                    message.Body,
                    message.TimeStamp,
                    message.MessageType
                )
            );
        }

        return new ChatDto(room.Revision, room.RoomId, chat);
    }

    public static MessageDto MessageDto(GameRoom room)
    {
        var latest = room.Chat.Messages[^1];

        var copiedMessage = new Message(
            latest.PlayerId,
            latest.Username,
            latest.Body,
            latest.TimeStamp,
            latest.MessageType
        );

        return new MessageDto(room.Revision, room.RoomId, copiedMessage);
    }

    public static CanvasDto CanvasDto(GameRoom room)
    {
        return new CanvasDto(
            room.Revision,
            room.RoomId,
            room.Canvas.Strokes.Select(CopyStroke).ToArray(),
            room.Canvas.ActiveStroke is null ? null : CopyStroke(room.Canvas.ActiveStroke)
        );
    }

    public static CanvasUpdateDto CanvasUpdateDto(
        GameRoom room,
        CanvasOperation operation,
        Stroke? stroke = null,
        Point[]? points = null
    )
    {
        return new CanvasUpdateDto(
            room.Revision,
            room.RoomId,
            operation,
            stroke is null ? null : CopyStroke(stroke),
            points?.ToArray()
        );
    }

    private static Stroke CopyStroke(Stroke stroke)
    {
        var copy = new Stroke(stroke.Colour, stroke.Width) { IsComplete = stroke.IsComplete };
        copy.Points.AddRange(stroke.Points);
        return copy;
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
