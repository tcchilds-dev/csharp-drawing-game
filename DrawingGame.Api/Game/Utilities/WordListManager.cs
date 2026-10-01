using DrawingGame.Api.Game.GameInternals;

namespace DrawingGame.Api.Game.Utilities;

public class WordListManager
{
    private readonly string[] _words;

    public WordListManager(string wordListPath)
    {
        if (!File.Exists(wordListPath))
        {
            throw new FileNotFoundException("The word list could not be found.", wordListPath);
        }

        _words = File.ReadLines(wordListPath)
            .Select(word => word.Trim())
            .Where(word => word.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (_words.Length < 3)
        {
            throw new InvalidOperationException("The word list must contain at least three words.");
        }
    }

    public void ValidateSelectionSize(WordSelectionSize amount)
    {
        if (amount != WordSelectionSize.Three && amount != WordSelectionSize.Five)
        {
            throw new GameException("Invalid word selection size.");
        }

        var num = (int)amount;
        if (num > _words.Length)
        {
            throw new GameException(
                "The word list does not contain enough words for this selection size."
            );
        }
    }

    public string[] GetChoices(WordSelectionSize amount)
    {
        var num = (int)amount;
        var deck = _words.ToArray();
        Random.Shared.Shuffle(deck);
        return deck[..num];
    }
}
