using DrawingGame.Api.Game;
using DrawingGame.Api.Game.DataTransferObjects;
using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

public class DrawingEdgeTests
{
    private readonly TestRoom _game = new();
    private GameRoom Room => _game.Room;

    public DrawingEdgeTests() => _game.BeginDrawing();

    public static IEnumerable<object[]> InvalidStrokes()
    {
        yield return [new StrokeInput("red", 8, [new(1, 1)])];
        yield return [new StrokeInput("#ffffff00", 8, [new(1, 1)])];
        yield return [new StrokeInput(null!, 8, [new(1, 1)])];
        yield return [new StrokeInput("#123abc", 8, [new(1, 1)])];
        yield return [new StrokeInput("#1a1a1a", 0, [new(1, 1)])];
        yield return [new StrokeInput("#1a1a1a", 23, [new(1, 1)])];
        yield return [new StrokeInput("#1a1a1a", 8, null)];
        yield return [new StrokeInput("#1a1a1a", 8, [])];
        yield return [new StrokeInput("#1a1a1a", 8, [new(1, 1), new(2, 2)])];
        yield return [new StrokeInput("#1a1a1a", 8, [new(-1, 1)])];
        yield return [new StrokeInput("#1a1a1a", 8, [new(1132, 902)])];
        yield return [new StrokeInput("#1a1a1a", 8, [new(double.NaN, 1)])];
        yield return [new StrokeInput("#1a1a1a", 8, [null!])];
        yield return [null!];
    }

    [Theory, MemberData(nameof(InvalidStrokes))]
    public void Invalid_start_is_atomic_and_returns_a_domain_error(StrokeInput stroke)
    {
        var revision = Room.Revision;
        Assert.Throws<DrawingRejectedException>(() => Room.StartStroke(_game.Host, stroke));
        Assert.Null(Room.Canvas.ActiveStroke);
        Assert.Empty(Room.Canvas.Strokes);
        Assert.Equal(revision, Room.Revision);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(8)]
    [InlineData(14)]
    [InlineData(22)]
    public void Boundary_dot_and_off_board_continuation_are_preserved_without_clamping(int width)
    {
        var start = new Point[] { new(1131, 902) };
        Room.StartStroke(_game.Host, new("#1a1a1a", width, start));
        start[0] = new(0, 0);
        var points = new Point[] { new(-100, 1000), new(10, 10) };
        Room.ExtendStroke(_game.Host, points);
        points[0] = new(0, 0);
        Room.EndStroke(_game.Host);
        var stroke = Assert.Single(Room.Canvas.Strokes);
        Assert.Equal(width, stroke.Width);
        Assert.Equal(new Point(1131, 902), stroke.Points[0]);
        Assert.Equal(new Point(-100, 1000), stroke.Points[1]);
        Assert.Equal(new Point(10, 10), stroke.Points[2]);
    }

    public static IEnumerable<object[]> InvalidBatches()
    {
        yield return [Array.Empty<Point>()];
        yield return [null!];
        yield return [new Point[] { new(2, 2), new(double.PositiveInfinity, 3) }];
        yield return [new Point[] { new(2, 2), new(3, double.NaN) }];
        yield return [new Point[] { new(2, 2), new(1_000_001, 3) }];
        yield return [new Point[] { null! }];
        yield return
        [
            Enumerable.Repeat(new Point(1, 1), GameConstants.MaxPointsPerExtension + 1).ToArray(),
        ];
    }

    [Theory, MemberData(nameof(InvalidBatches))]
    public void Invalid_extension_does_not_append_a_valid_prefix(Point[] points)
    {
        // Seed the fixture directly to isolate extension validation from StartStroke.
        var active = new Stroke("#1a1a1a", 8, StrokeType.Line);
        active.Points.Add(new(1, 1));
        Room.Canvas.ActiveStroke = active;
        var revision = Room.Revision;
        Assert.Throws<DrawingRejectedException>(() => Room.ExtendStroke(_game.Host, points));
        Assert.Single(active.Points);
        Assert.Equal(revision, Room.Revision);
    }

    [Fact]
    public void Stroke_point_budget_is_enforced_atomically()
    {
        var active = new Stroke("#1a1a1a", 8, StrokeType.Line);
        active.Points.AddRange(Enumerable.Repeat(new Point(1, 1), 100_000));
        Room.Canvas.ActiveStroke = active;
        var revision = Room.Revision;
        Assert.Throws<DrawingRejectedException>(() => Room.ExtendStroke(_game.Host, [new(2, 2)]));
        Assert.Equal(100_000, active.Points.Count);
        Assert.Equal(revision, Room.Revision);
    }

    [Fact]
    public void Clear_removes_active_ink_as_well_as_completed_ink()
    {
        Room.Canvas.ActiveStroke = new Stroke("#1a1a1a", 8, StrokeType.Line);
        Room.Canvas.ActiveStroke.Points.Add(new(1, 1));
        Room.ClearCanvas(_game.Host);
        Assert.Null(Room.Canvas.ActiveStroke);
        Assert.Empty(Room.Canvas.Strokes);
    }

    [Fact]
    public void Undo_of_an_active_gesture_preserves_previous_completed_stroke()
    {
        var previous = new Stroke("#1a1a1a", 8, StrokeType.Line) { IsComplete = true };
        previous.Points.Add(new(1, 1));
        Room.Canvas.Strokes.Push(previous);
        Room.Canvas.ActiveStroke = new Stroke("#ffffff", 4, StrokeType.Line);
        Room.Canvas.ActiveStroke.Points.Add(new(2, 2));
        Room.UndoStroke(_game.Host);
        Assert.Null(Room.Canvas.ActiveStroke);
        Assert.Same(previous, Assert.Single(Room.Canvas.Strokes));
    }

    [Fact]
    public void Duplicate_end_is_a_no_op_not_an_extra_history_entry()
    {
        Room.Canvas.ActiveStroke = new Stroke("#1a1a1a", 8, StrokeType.Line);
        Room.Canvas.ActiveStroke.Points.Add(new(1, 1));
        Room.EndStroke(_game.Host);
        var revision = Room.Revision;
        Assert.Null(Room.EndStroke(_game.Host));
        Assert.Single(Room.Canvas.Strokes);
        Assert.Equal(revision, Room.Revision);
    }

    [Fact]
    public void Second_start_cannot_silently_discard_an_active_stroke()
    {
        var active = new Stroke("#1a1a1a", 8, StrokeType.Line);
        active.Points.Add(new(1, 1));
        Room.Canvas.ActiveStroke = active;
        Assert.Throws<DrawingRejectedException>(() =>
            Room.StartStroke(_game.Host, new("#ffffff", 4, [new(1, 1)]))
        );
        Assert.Same(active, Room.Canvas.ActiveStroke);
    }

    [Fact]
    public void Rejected_command_carries_the_real_canvas_back_to_the_artist()
    {
        var completed = new Stroke("#1a1a1a", 8, StrokeType.Line) { IsComplete = true };
        completed.Points.Add(new(1, 1));
        Room.Canvas.Strokes.Push(completed);
        var rejection = Assert.Throws<DrawingRejectedException>(() =>
            Room.StartStroke(_game.Host, new("#1a1a1a", 8, [new(-5, -5)]))
        );
        Assert.Single(rejection.Canvas.CompletedStrokes);
        Assert.Null(rejection.Canvas.ActiveStroke);
    }

    [Fact]
    public void Stroke_at_deadline_is_ignored_before_validation_or_mutation()
    {
        _game.Clock.AdvanceTime(Room.Settings.DrawTimeLimit);
        var revision = Room.Revision;
        Assert.Null(Room.StartStroke(_game.Host, new("#1a1a1a", 8, [new(1, 1)])));
        Assert.Equal(revision, Room.Revision);
    }

    [Theory, MemberData(nameof(InvalidStrokes))]
    public void Invalid_fill_is_atomic_and_returns_a_domain_error(StrokeInput stroke)
    {
        var revision = Room.Revision;
        Assert.Throws<DrawingRejectedException>(() => Room.FillColour(_game.Host, stroke));
        Assert.Empty(Room.Canvas.Strokes);
        Assert.Equal(revision, Room.Revision);
    }

    [Fact]
    public void Fill_is_a_single_completed_history_entry_that_undo_removes()
    {
        var update = Room.FillColour(_game.Host, new("#1a1a1a", 8, [new(1131, 902)]))!;
        Assert.Equal(CanvasOperation.Fill, update.Operation);
        var fill = Assert.Single(Room.Canvas.Strokes);
        Assert.Equal(StrokeType.Fill, fill.Type);
        Assert.True(fill.IsComplete);
        Assert.Null(Room.Canvas.ActiveStroke);
        Room.UndoStroke(_game.Host);
        Assert.Empty(Room.Canvas.Strokes);
    }

    [Fact]
    public void Started_stroke_is_a_line_and_fill_cannot_interrupt_it()
    {
        Room.StartStroke(_game.Host, new("#1a1a1a", 8, [new(1, 1)]));
        var active = Room.Canvas.ActiveStroke!;
        Assert.Equal(StrokeType.Line, active.Type);
        Assert.False(active.IsComplete);
        Assert.Throws<DrawingRejectedException>(() =>
            Room.FillColour(_game.Host, new("#ffffff", 4, [new(1, 1)]))
        );
        Assert.Same(active, Room.Canvas.ActiveStroke);
        Assert.Empty(Room.Canvas.Strokes);
    }

    [Fact]
    public void Fill_at_deadline_is_ignored_before_validation_or_mutation()
    {
        _game.Clock.AdvanceTime(Room.Settings.DrawTimeLimit);
        var revision = Room.Revision;
        Assert.Null(Room.FillColour(_game.Host, new("#1a1a1a", 8, [new(1, 1)])));
        Assert.Empty(Room.Canvas.Strokes);
        Assert.Equal(revision, Room.Revision);
    }
}

public class SnapshotEdgeTests
{
    [Fact]
    public void Published_snapshots_do_not_alias_mutable_room_collections()
    {
        var game = new TestRoom();
        game.BeginDrawing();
        var stroke = new Stroke("#1a1a1a", 8, StrokeType.Line);
        stroke.Points.Add(new(1, 1));
        game.Room.Canvas.ActiveStroke = stroke;
        game.Room.Chat.Messages.Add(
            new(null, null, "Before", game.Clock.GetUtcNow(), MessageType.SystemMessage)
        );
        var snapshot = DtoConstructor.RoomSnapshotDto(game.Room);
        game.Room.Canvas.ActiveStroke.Points.Add(new(2, 2));
        game.Room.Chat.Messages[0].Body = "After";
        game.Room.State.Scores[game.Host.PlayerId] = 999;
        game.Room.State.PlayersMarkedCorrect.Add(game.Guest.PlayerId);
        Assert.Single(snapshot.Canvas.ActiveStroke!.Points);
        Assert.Equal("Before", snapshot.Chat.ChatHistory.Messages[0].Body);
        Assert.Equal(0, snapshot.Room.State.Scores[game.Host.PlayerId]);
        Assert.Empty(snapshot.Room.State.PlayersMarkedCorrect);
    }

    [Fact]
    public void Guesser_snapshot_contains_no_answer_choices_or_other_membership_tokens()
    {
        var game = new TestRoom();
        game.BeginDrawing();
        var entry = DtoConstructor.RoomEntryDto(game.Room, game.Guest);
        Assert.Null(entry.Snapshot.Room.State.RevealedWord);
        var json = System.Text.Json.JsonSerializer.Serialize(entry);
        Assert.DoesNotContain(game.Room.State.CurrentWord!, json);
        Assert.DoesNotContain(game.Host.MembershipToken, json);
        Assert.DoesNotContain(game.Host.ConnectionId, json);
    }
}
