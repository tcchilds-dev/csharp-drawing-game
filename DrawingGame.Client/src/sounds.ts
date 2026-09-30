import { SOUND_VOLUMES } from "./config";
import { SOUNDS } from "./network/roomSounds";
import type { Sound, SoundPlayer } from "./network/roomSounds";

const players = new Map<Sound, HTMLAudioElement>();

function audioFor(sound: Sound) {
  let audio = players.get(sound);
  if (!audio) {
    audio = new Audio(`/sounds/${sound}.mp3`);
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
