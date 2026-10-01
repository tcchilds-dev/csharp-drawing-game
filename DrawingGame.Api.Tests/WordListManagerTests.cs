using DrawingGame.Api.Game.GameInternals;
using DrawingGame.Api.Game.Utilities;

namespace DrawingGame.Api.Tests;

public class WordListManagerTests
{
    private static void WithList(string contents, Action<string> test)
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, contents);
            test(path);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Blank_and_duplicate_entries_cannot_create_duplicate_choices() =>
        WithList(
            " Apple \n\nAPPLE\n Banana\nCarrot\n",
            path =>
            {
                var choices = new WordListManager(path).GetChoices(WordSelectionSize.Three);
                Assert.Equal(3, choices.Distinct(StringComparer.OrdinalIgnoreCase).Count());
                Assert.All(choices, word => Assert.Equal(word.Trim(), word));
            }
        );

    [Fact]
    public void Too_few_distinct_words_fail_at_startup() =>
        WithList(
            "Apple\napple\nBanana\n",
            path => Assert.Throws<InvalidOperationException>(() => new WordListManager(path))
        );

    [Fact]
    public void Five_choices_are_rejected_when_only_three_distinct_words_exist() =>
        WithList(
            "Apple\nBanana\nCarrot",
            path =>
                Assert.Throws<GameException>(() =>
                    new WordListManager(path).ValidateSelectionSize(WordSelectionSize.Five)
                )
        );

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(4)]
    [InlineData(6)]
    public void Undefined_selection_enum_values_are_rejected(int count) =>
        Assert.Throws<GameException>(() =>
            TestWordListManager.Create().ValidateSelectionSize((WordSelectionSize)count)
        );
}
