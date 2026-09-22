using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.Utilities;

public static class DtoConstructor
{
    public static RoomEntryDetails CreateRoomEntryDetails(GameRoom room, Player player)
    {
        var sessionDetails = CreateSessionDetails(room, player);
        var roomDetails = CreateRoomDetails(room);

        return new RoomEntryDetails(sessionDetails, roomDetails);
    }

    public static GameDetails CreateGameDetails(GameRoom room, string? artistConnectionId)
    {
        var roomDetails = CreateRoomDetails(room);

        if (artistConnectionId is not null)
        {
            var artistDetails = new ArtistDetails(room.State.CurrentWord, room.State.WordChoices);

            return new GameDetails(artistConnectionId, artistDetails, roomDetails);
        }

        return new GameDetails(null, null, roomDetails);
    }

    public static RoomDetails CreateRoomDetails(GameRoom room)
    {
        var settingsDetails = CreateGameSettingsDetails(room.Settings);
        var stateDetails = CreateGameStateDetails(room.State);
        var canvasDetails = CreateCanvasDetails(room.Canvas);
        var players = new List<PlayerDetails>();

        foreach (var player in room.Players.Values)
        {
            players.Add(CreatePlayerDetails(player));
        }

        return new RoomDetails(
            room.RoomId,
            room.HostPlayerId,
            room.Revision,
            players,
            room.Chat,
            settingsDetails,
            stateDetails,
            canvasDetails
        );
    }

    public static GameSettingsDetails CreateGameSettingsDetails(GameSettings settings)
    {
        return new GameSettingsDetails(
            settings.MaxPlayers,
            settings.WordSelectionSize,
            settings.WordChoiceTimeLimit,
            settings.DrawTimeLimit,
            settings.NumberOfRounds
        );
    }

    public static GameStateDetails CreateGameStateDetails(GameState state)
    {
        return new GameStateDetails(
            state.CurrentPhase,
            state.CurrentArtist,
            state.CurrentTurn,
            state.CurrentRound,
            state.MaskedWord,
            state.PhaseEndsAt,
            state.TurnOrder,
            state.Scores,
            state.PlayersMarkedCorrect
        );
    }

    public static CanvasDetails CreateCanvasDetails(Canvas canvas)
    {
        return new CanvasDetails(canvas.Strokes, canvas.ActiveStroke);
    }

    public static PlayerDetails CreatePlayerDetails(Player player)
    {
        return new PlayerDetails(player.PlayerId, player.Username);
    }

    public static SessionDetails CreateSessionDetails(GameRoom room, Player player)
    {
        return new SessionDetails(
            room.RoomId,
            player.PlayerId,
            player.ConnectionId,
            player.MembershipToken
        );
    }
}
