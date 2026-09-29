import { useState } from "react";

type WordChoicesProps = {
  words: readonly string[];
  autoFocus?: boolean;
  onChoose?: (word: string) => Promise<void>;
  disabled?: boolean;
};

export default function WordChoices({
  words,
  autoFocus = false,
  onChoose,
  disabled = false,
}: WordChoicesProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  return (
    <div className="word-choices-overlay scroll-area">
      <div className="word-choice-options" role="group" aria-label="Choose a word to draw">
        {words.map((word, index) => (
          <button
            key={word}
            type="button"
            className="word-choice-button"
            disabled={disabled || selectedWord !== null}
            aria-pressed={selectedWord === word}
            autoFocus={autoFocus && index === 0}
            onClick={async () => {
              setSelectedWord(word);
              try {
                await onChoose?.(word);
              } catch {
                /* Shared error notification. */
              } finally {
                setSelectedWord(null);
              }
            }}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
