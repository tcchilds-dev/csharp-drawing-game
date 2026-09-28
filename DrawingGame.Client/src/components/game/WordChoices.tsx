import { useState } from "react";

type WordChoicesProps = {
  words: readonly string[];
  autoFocus?: boolean;
  onChoose?: (word: string) => void;
};

export default function WordChoices({ words, autoFocus = false, onChoose }: WordChoicesProps) {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  return (
    <div className="word-choices-overlay scroll-area">
      <div className="word-choice-options" role="group" aria-label="Choose a word to draw">
        {words.map((word, index) => (
          <button
            key={word}
            type="button"
            className="word-choice-button"
            aria-pressed={selectedWord === word}
            autoFocus={autoFocus && index === 0}
            onClick={() => {
              setSelectedWord(word);
              onChoose?.(word);
            }}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
