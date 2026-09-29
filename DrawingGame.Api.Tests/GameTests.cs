using System.Globalization;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

public class GameTests
{
    private readonly TestRoom _game = new();

    [Fact]
    public void Duplicate_start_and_unoffered_word_do_not_advance_or_mutate_the_turn()
    {
        _game.Room.StartGame(_game.Host);
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.StartGame(_game.Host));
        Assert.Throws<GameException>(() =>
            _game.Room.ChooseWord(_game.Host, "not an offered word")
        );
        Assert.Equal(revision, _game.Room.Revision);
        Assert.Equal(1, _game.Room.State.CurrentTurn);
        Assert.Null(_game.Room.State.CurrentWord);
    }

    [Fact]
    public void Unauthorised_word_choice_and_canvas_commands_leave_state_untouched()
    {
        _game.Room.StartGame(_game.Host);
        Assert.Null(_game.Room.ChooseWord(_game.Guest, _game.Room.State.WordChoices![0]));
        _game.BeginDrawing();
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.StartStroke(_game.Guest, new("#000000", 8, [new(1, 1)])));
        Assert.Null(_game.Room.ExtendStroke(_game.Guest, [new(2, 2)]));
        Assert.Null(_game.Room.EndStroke(_game.Guest));
        Assert.Null(_game.Room.ClearCanvas(_game.Guest));
        Assert.Null(_game.Room.UndoStroke(_game.Guest));
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Fact]
    public void Double_clock_tick_at_same_deadline_advances_only_once()
    {
        _game.BeginDrawing();
        _game.Clock.AdvanceTime(_game.Room.Settings.DrawTimeLimit);
        Assert.NotNull(_game.Room.AdvancePhaseIfExpired());
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.AdvancePhaseIfExpired());
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Fact]
    public void Artist_leaving_does_not_skip_the_next_player()
    {
        var third = new Player("third", "Third");
        _game.Room.JoinRoom(third);
        _game.BeginDrawing();
        _game.Room.LeaveRoom(_game.Host);
        _game.Clock.AdvanceTime(GameConstants.TurnEndDuration);
        _game.Room.AdvancePhaseIfExpired();
        Assert.Equal(_game.Guest.PlayerId, _game.Room.State.CurrentArtist);
        Assert.Equal(_game.Guest.PlayerId, _game.Room.HostPlayerId);
        Assert.DoesNotContain(_game.Host.PlayerId, _game.Room.State.TurnOrder);
        Assert.False(_game.Room.State.Scores.ContainsKey(_game.Host.PlayerId));
    }

    [Fact]
    public void Join_arriving_after_the_last_player_left_cannot_revive_the_room()
    {
        _game.Room.LeaveRoom(_game.Guest);
        _game.Room.LeaveRoom(_game.Host);
        Assert.Throws<GameException>(() => _game.Room.JoinRoom(new Player("late", "Late")));
        Assert.Empty(_game.Room.Players);
    }

    [Fact]
    public void Leaving_below_minimum_players_aborts_and_resets_the_match()
    {
        _game.BeginDrawing();
        _game.Room.State.Scores[_game.Host.PlayerId] = 100;
        _game.Room.LeaveRoom(_game.Guest);
        Assert.Equal(GamePhase.Lobby, _game.Room.State.CurrentPhase);
        Assert.Null(_game.Room.State.CurrentArtist);
        Assert.Null(_game.Room.State.PhaseEndsAt);
        Assert.Equal(0, _game.Room.State.Scores[_game.Host.PlayerId]);
    }

    [Fact]
    public void Too_long_chat_is_rejected_without_adding_message_or_revision()
    {
        var revision = _game.Room.Revision;
        Assert.Throws<GameException>(() =>
            _game.Room.SendMessage(_game.Host, new string('x', 201), out _)
        );
        Assert.Empty(_game.Room.Chat.Messages);
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_messages_are_no_ops(string body)
    {
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.SendMessage(_game.Host, body, out _));
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Fact]
    public void Null_chat_is_rejected_without_crashing_or_mutating()
    {
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.SendMessage(_game.Host, null!, out _));
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Fact]
    public void Guess_matching_does_not_depend_on_server_culture()
    {
        _game.BeginDrawing();
        _game.Room.JoinRoom(new Player("third", "Third"));
        _game.Room.State.CurrentWord = "PIRATE";
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("tr-TR");
            var message = _game.Room.SendMessage(_game.Guest, " pirate ", out _);
            Assert.Equal(MessageType.CorrectGuessNotification, message!.Message.MessageType);
            Assert.Null(message.Message.PlayerId); // Answer never leaks as standard chat.
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    [Fact]
    public void Non_final_correct_guess_publishes_scores_and_cannot_be_scored_twice()
    {
        _game.Room.JoinRoom(new Player("third", "Third"));
        _game.BeginDrawing();
        var answer = _game.Room.State.CurrentWord!;
        _game.Room.SendMessage(_game.Guest, answer, out var update);
        Assert.NotNull(update);
        Assert.Contains(_game.Guest.PlayerId, update.State.PlayersMarkedCorrect);
        var score = _game.Room.State.Scores[_game.Guest.PlayerId];
        Assert.True(score > 0, "GUESS-01: score the first correct guess.");
        Assert.True(
            _game.Room.State.Scores[_game.Host.PlayerId] > 0,
            "GUESS-01: reward the artist."
        );
        var revision = _game.Room.Revision;
        Assert.Null(_game.Room.SendMessage(_game.Guest, answer, out _));
        Assert.Equal(score, _game.Room.State.Scores[_game.Guest.PlayerId]);
        Assert.Equal(revision, _game.Room.Revision);
    }

    [Fact]
    public void Expiry_preserves_an_unfinished_stroke_and_correct_guesser_until_next_turn()
    {
        _game.Room.JoinRoom(new Player("third", "Third"));
        _game.BeginDrawing();
        var stroke = new Stroke("#000000", 8);
        stroke.Points.Add(new(1, 1));
        _game.Room.Canvas.ActiveStroke = stroke;
        _game.Room.State.PlayersMarkedCorrect.Add(_game.Guest.PlayerId);
        _game.Clock.AdvanceTime(_game.Room.Settings.DrawTimeLimit);
        var update = _game.Room.AdvancePhaseIfExpired()!;
        Assert.Contains(_game.Guest.PlayerId, update.Room.State.PlayersMarkedCorrect);
        Assert.True(
            update.Room.Canvas.ActiveStroke != null
                || update.Room.Canvas.CompletedStrokes.Length == 1,
            "PHASE-01: keep the final canvas even if pointer-up never arrives."
        );
        Assert.Equal(_game.Room.State.CurrentWord, update.Room.State.RevealedWord);
    }

    [Fact]
    public void Final_correct_guess_survives_the_same_call_transitioning_to_turn_end()
    {
        _game.BeginDrawing();
        _game.Room.SendMessage(_game.Guest, _game.Room.State.CurrentWord!, out var update);
        Assert.NotNull(update);
        Assert.Contains(_game.Guest.PlayerId, update.State.PlayersMarkedCorrect);
        Assert.Single(update.ChatHistory.ChatHistory.Messages);
    }

    [Theory]
    [InlineData("Ice cream", "___ _____")]
    [InlineData("T-shirt", "_-_____")]
    [InlineData("𐐀a", "__")]
    public void Word_mask_preserves_phrase_separators_and_counts_unicode_letters(
        string word,
        string expected
    )
    {
        _game.Room.StartGame(_game.Host);
        _game.Room.State.WordChoices = [word, "Apple", "Orange"];
        _game.Room.ChooseWord(_game.Host, word);
        Assert.Equal(expected, _game.Room.State.MaskedWord);
    }

    [Fact]
    public void Guess_at_exact_deadline_is_not_accepted_before_clock_tick()
    {
        _game.BeginDrawing();
        _game.Clock.AdvanceTime(_game.Room.Settings.DrawTimeLimit);
        Assert.Null(_game.Room.SendMessage(_game.Guest, _game.Room.State.CurrentWord!, out _));
        Assert.Equal(0, _game.Room.State.Scores[_game.Guest.PlayerId]);
    }

    [Fact]
    public void Word_choice_at_exact_deadline_cannot_override_timeout_selection()
    {
        _game.Room.StartGame(_game.Host);
        _game.Clock.AdvanceTime(_game.Room.Settings.WordChoiceTimeLimit);
        Assert.Null(_game.Room.ChooseWord(_game.Host, _game.Room.State.WordChoices![1]));
        Assert.Null(_game.Room.State.CurrentWord);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Undo_and_clear_cannot_change_the_revealed_drawing_after_turn_end(bool clear)
    {
        _game.BeginDrawing();
        _game.Room.State.CurrentPhase = GamePhase.TurnEnd;
        var stroke = new Stroke("#000000", 8) { IsComplete = true };
        stroke.Points.Add(new(1, 1));
        _game.Room.Canvas.Strokes.Push(stroke);
        var revision = _game.Room.Revision;
        Assert.Null(clear ? _game.Room.ClearCanvas(_game.Host) : _game.Room.UndoStroke(_game.Host));
        Assert.Single(_game.Room.Canvas.Strokes);
        Assert.Equal(revision, _game.Room.Revision);
    }
}
