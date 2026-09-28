export type WordOutcome = "pending" | "correct" | "missed";

type WordDisplayProps = {
  word: string;
  isGuessing: boolean;
  outcome?: WordOutcome;
};

export default function WordDisplay({ word, isGuessing, outcome = "pending" }: WordDisplayProps) {
  // Preserve spaces and punctuation when the preview word is a phrase.
  const letters = word.match(/\p{L}/gu) ?? [];
  const maskedWord = word.replace(/\p{L}/gu, "_");

  return (
    <div className="panel word-card col-span-2" data-masked={isGuessing} data-outcome={outcome}>
      <span className="sr-only" role="status">
        {outcome === "correct" ? "Correct guess!" : outcome === "missed" ? "Time’s up. The word is revealed." : ""}
      </span>
      {isGuessing ? (
        <>
          <h1
            className="current-word masked-word"
            aria-label={`Guess the word: ${letters.length} letters`}
          >
            <span aria-hidden="true">{maskedWord}</span>
          </h1>
          <span
            className="word-letter-count"
            aria-label={`${letters.length} letters`}
            title={`${letters.length} letters`}
          >
            {letters.length}
          </span>
        </>
      ) : (
        <h1 className="current-word" title={word}>
          {word}
        </h1>
      )}
    </div>
  );
}
