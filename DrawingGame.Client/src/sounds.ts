import { SOUND_VOLUMES } from "./config";
import { SOUNDS } from "./network/roomSounds";
import type { Sound, SoundPlayer } from "./network/roomSounds";

const players = new Map<Sound, HTMLAudioElement>();

// File names in public/sounds.
const FILES: Record<Sound, string> = {
  "chat-message": "chat-message.mp3",
  "correct-guess": "correct-guess.mp3",
  "match-results-loser": "match-results-loser.mp3",
  "match-results-winner": "match-results-winner.mp3",
  "other-correct-guess": "other-correct-guess.wav",
  "player-enters-leaves": "player-enters-leaves.wav",
  "time-out": "time-out.mp3",
  "turn-end-to-choose-word": "turn-end-to-choose-word.wav",
};

function audioFor(sound: Sound) {
  let audio = players.get(sound);
  if (!audio) {
    audio = new Audio(`/sounds/${FILES[sound]}`);
    audio.preload = "auto";
    // HTMLMediaElement throws outside 0-1, so louder than the file itself isn't possible.
    audio.volume = Math.min(1, Math.max(0, SOUND_VOLUMES[sound]));
    players.set(sound, audio);
  }
  return audio;
}

// Fetch the files up front so the first time each sound plays isn't delayed.
export function preloadSounds() {
  SOUNDS.forEach(audioFor);
}

export const soundPlayer: SoundPlayer = {
  play(sound, fromSeconds = 0) {
    const audio = audioFor(sound);
    audio.currentTime = fromSeconds;
    // Browsers block playback until the page has had a user gesture, e.g. right after a
    // refresh restores the room. Missing a sound then is fine.
    void audio.play().catch(() => {});
  },
  stop(sound) {
    players.get(sound)?.pause();
  },
};
