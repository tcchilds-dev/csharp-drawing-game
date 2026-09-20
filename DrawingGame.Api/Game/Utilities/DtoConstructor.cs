using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.Utilities;

// NOTE: Pass in booleans to determine what details to show/hide.
// NOTE: Remember to copy over collection values.

public static class DtoConstructor
{
    public static RoomEntryDetails CreateRoomEntryDetails(GameRoom room, Player player)
    {
        var sessionDetails = CreateSessionDetails(room, player);
        var roomDetails = CreateRoomSyncDetails(room, isArtist: false);

        return new RoomEntryDetails(sessionDetails, roomDetails);
    }

    public static RoomSyncDetails CreateRoomSyncDetails(GameRoom room, bool isArtist)
    {
        var settingsDetails = CreateGameSettingsDetails(room.Settings);
        var stateDetails = CreateGameStateDetails(room.State, isArtist);
        var players = new List<PlayerDetails>();

        foreach (var player in room.Players.Values)
        {
            players.Add(CreatePlayerDetails(player));
        }

        return new RoomSyncDetails(
            room.RoomId,
            room.HostPlayerId,
            room.Revision,
            players,
            room.Chat,
            settingsDetails,
            stateDetails,
            room.Canvas
        );
    }

    public static GameSettingsDetails CreateGameSettingsDetails(GameSettings settings)
    {
        return new GameSettingsDetails(
            settings.MaxPlayers,
            settings.WordSelectionSize,
            settings.WordChoiceTimerSeconds,
            settings.DrawTimerSeconds,
            settings.NumberOfRounds
        );
    }

    public static GameStateDetails CreateGameStateDetails(GameState state, bool isArtist)
    {
        var currentWord = isArtist ? state.CurrentWord : null;
        var wordChoices = isArtist ? state.WordChoices : null;

        return new GameStateDetails(
            state.CurrentPhase,
            state.CurrentArtistIndex,
            state.CurrentTurn,
            state.CurrentRound,
            currentWord,
            state.MaskedWord,
            state.PhaseEndsAt,
            state.TurnOrder,
            state.Scores,
            state.PlayersMarkedCorrect,
            wordChoices
        );
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
