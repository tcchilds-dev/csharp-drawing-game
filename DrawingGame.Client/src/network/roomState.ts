import type { ArtistDto, ChatDto, MessageDto, RoomDto, SettingsDto } from "./contracts";

// Streams share a room revision but arrive independently. A newer canvas/message
// must not suppress an older, still-needed roster or phase update.
export class RoomState {
  room: RoomDto | null = null;
  chat: ChatDto | null = null;
  artist: ArtistDto | null = null;
  private messages = new Map<number, MessageDto>();
  private historyRevision = -1;
  private rosterRevision = -1;

  reset() {
    this.room = null;
    this.chat = null;
    this.artist = null;
    this.messages.clear();
    this.historyRevision = this.rosterRevision = -1;
  }

  acceptRoom(incoming: RoomDto) {
    const old = this.room;
    if (old && old.roomId !== incoming.roomId) return false;
    const newerRoster = incoming.revision >= this.rosterRevision;
    if (newerRoster) this.rosterRevision = incoming.revision;
    this.room = {
      ...(newerRoster || !old ? incoming : old),
      state: !old || incoming.state.revision >= old.state.revision ? incoming.state : old.state,
      settings:
        !old || incoming.settings.revision >= old.settings.revision
          ? incoming.settings
          : old.settings,
    };
    return true;
  }

  // Full history from a snapshot. It replaces the individual messages it already includes.
  acceptChat(chat: ChatDto) {
    if (!this.room || chat.roomId !== this.room.roomId || chat.revision < this.historyRevision)
      return false;
    this.historyRevision = chat.revision;
    for (const revision of this.messages.keys())
      if (revision <= this.historyRevision) this.messages.delete(revision);
    this.chat = chat;
    return true;
  }

  acceptSettings(settings: SettingsDto) {
    if (
      !this.room ||
      settings.roomId !== this.room.roomId ||
      settings.revision <= this.room.settings.revision
    )
      return false;
    this.room = { ...this.room, settings };
    return true;
  }

  acceptMessage(update: MessageDto) {
    if (
      !this.room ||
      update.roomId !== this.room.roomId ||
      update.revision <= this.historyRevision ||
      this.messages.has(update.revision)
    )
      return false;
    this.messages.set(update.revision, update);
    return true;
  }

  // Only ever sent to this player, and sent before the room update that makes them the artist.
  acceptArtist(update: ArtistDto) {
    if (this.artist && update.revision < this.artist.revision) return false;
    this.artist = update;
    return true;
  }

  privateArtist(playerId: string) {
    return this.room?.state.currentArtist === playerId ? this.artist : null;
  }

  chatMessages() {
    const history = this.chat?.chatHistory.messages ?? [];
    return [
      ...history.map((message, index) => ({
        id: `history-${this.historyRevision}-${index}`,
        message,
      })),
      ...[...this.messages.values()]
        .sort((a, b) => a.revision - b.revision)
        .map((update) => ({
          id: `message-${update.revision}`,
          message: update.message,
        })),
    ];
  }
}
