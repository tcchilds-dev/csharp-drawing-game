import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import type { HubConnection } from "@microsoft/signalr";
import { DrawingModel } from "../components/game/drawing/drawingModel.ts";
import type { CanvasDto } from "../components/game/drawing/drawingModel";
import type { GameSettings } from "../components/game/lobbySettings";
import type {
  ArtistDto,
  CanvasUpdateDto,
  MessageDto,
  RoomDto,
  RoomEntryDto,
  SessionDto,
  SettingsDto,
} from "./contracts";
import { settingsRequest } from "./contracts.ts";
import { RoomState } from "./roomState.ts";
import { DrawingQueue } from "./drawingQueue.ts";

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Please try again.";
  return message.replace(
    /^An unexpected error occurred invoking '[^']+' on the server\. HubException: /,
    "",
  );
}
export type ConnectionStatus = "offline" | "connecting" | "connected" | "reconnecting";
export type ClientSnapshot = {
  room: RoomDto | null;
  playerId: string | null;
  status: ConnectionStatus;
  artist: ArtistDto | null;
  messages: ReturnType<RoomState["chatMessages"]>;
  error: string | null;
  drawingBlocked: boolean;
  serverOffset: number;
  // True while a seat saved by a previous page load is being reclaimed.
  restoring: boolean;
};

// The seat is kept in sessionStorage so a reload can reclaim it within the server's grace
// period. sessionStorage is per tab, so separate windows still play as separate players.
type SavedSession = SessionDto & { roomId: string };
const SESSION_KEY = "drawing-game-session";
function loadSession(): SavedSession | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    return typeof saved?.roomId === "string" &&
      typeof saved.playerId === "string" &&
      typeof saved.membershipToken === "string"
      ? saved
      : null;
  } catch {
    return null;
  }
}
function saveSession(session: SavedSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be unavailable (private mode, tests); reloads then return to the home page.
  }
}

export class GameClient {
  readonly drawing = new DrawingModel();
  private connection: HubConnection;
  private state = new RoomState();
  private session: SessionDto | null = null;
  private listeners = new Set<() => void>();
  private queue: DrawingQueue;
  private canvasRevision = -1;
  private entering = false;
  private entrySerial = 0;
  private buffered: (() => void)[] = [];
  private stopping: Promise<void> = Promise.resolve();
  private snapshot: ClientSnapshot = {
    room: null,
    playerId: null,
    status: "offline",
    artist: null,
    messages: [],
    error: null,
    drawingBlocked: false,
    serverOffset: 0,
    restoring: loadSession() !== null,
  };

  constructor(url = "/game", connection?: HubConnection) {
    this.connection =
      connection ??
      new HubConnectionBuilder()
        .withUrl(url)
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(LogLevel.Warning)
        .build();
    const receive = <T>(name: string, handler: (value: T) => void) =>
      this.connection.on(name, (value: T) => {
        if (this.entering) this.buffered.push(() => handler(value));
        else if (this.session) handler(value);
      });
    receive<RoomDto>("SyncRoom", (room) => this.receiveRoom(room));
    receive<SettingsDto>("SyncGameSettings", (settings) => {
      if (this.state.acceptSettings(settings)) this.publish();
    });
    receive<MessageDto>("SyncMessage", (message) => {
      if (this.state.acceptMessage(message)) this.publish();
    });
    receive<ArtistDto>("SyncArtist", (artist) => {
      if (this.state.acceptArtist(artist)) this.publish();
    });
    // Only sent to the artist when the server rejects one of their drawing commands, so it
    // replaces whatever they drew locally.
    receive<CanvasDto>("SyncCanvas", (canvas) => this.receiveCanvas(canvas, true));
    receive<CanvasUpdateDto>("SyncCanvasUpdate", (update) => this.receiveCanvasUpdate(update));
    this.queue = new DrawingQueue(
      (command) => this.invoke(command.method, ...command.args),
      (error) => this.publish({ error: errorMessage(error) }),
    );
    this.drawing.onCommand = (command) => {
      if (this.canDraw()) this.queue.push(command);
    };
    this.connection.onreconnecting(() => {
      this.queue.cancel();
      this.publish({ status: "reconnecting", drawingBlocked: true });
    });
    this.connection.onreconnected(async () => {
      if (!this.session || !this.state.room) {
        this.publish({ status: "connected" });
        return;
      }
      const session = this.session;
      const serial = ++this.entrySerial;
      try {
        this.entering = true;
        const entry = await this.connection.invoke<RoomEntryDto>("ReconnectToRoom", {
          roomId: this.state.room.roomId,
          ...this.session,
        });
        if (this.session === session) this.acceptEntry(entry);
      } catch (error) {
        if (this.session === session) {
          saveSession(null);
          this.publish({
            error: `Could not restore the room. ${errorMessage(error)}`,
            status: "offline",
          });
        }
      } finally {
        if (this.entrySerial === serial) this.finishEntry();
      }
    });
    this.connection.onclose(() => {
      this.queue.cancel();
      this.publish({ status: "offline", drawingBlocked: true });
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  dismissError = () => this.publish({ error: null });

  private publish(changes: Partial<ClientSnapshot> = {}) {
    this.snapshot = {
      ...this.snapshot,
      room: this.state.room,
      playerId: this.session?.playerId ?? null,
      artist: this.session ? this.state.privateArtist(this.session.playerId) : null,
      messages: this.state.chatMessages(),
      ...changes,
    };
    this.listeners.forEach((listener) => listener());
  }
  private canDraw() {
    return (
      this.snapshot.status === "connected" &&
      !this.snapshot.drawingBlocked &&
      this.state.room?.state.currentPhase === 2 &&
      this.state.room.state.currentArtist === this.session?.playerId
    );
  }
  private acceptEntry(entry: RoomEntryDto) {
    this.state.reset();
    this.canvasRevision = -1;
    this.session = entry.session;
    saveSession({ roomId: entry.room.roomId, ...entry.session });
    this.receiveRoom(entry.room, true);
    this.publish({ status: "connected", drawingBlocked: false, error: null });
  }
  private finishEntry() {
    this.entering = false;
    const pending = this.buffered;
    this.buffered = [];
    if (this.session) pending.forEach((receive) => receive());
  }
  private receiveRoom(room: RoomDto, forceCanvas = false) {
    const previous = this.state.room;
    if (!this.state.acceptRoom(room)) return;
    const current = this.state.room!;
    const phaseChanged =
      previous?.state.currentPhase !== current.state.currentPhase ||
      previous?.state.phaseEndsAt !== current.state.phaseEndsAt;
    if (phaseChanged) this.queue.cancel();
    this.receiveCanvas(room.canvas, forceCanvas || phaseChanged);
    // Offset is sampled from fresh server snapshots; no client clock decides phases.
    const serverOffset = Date.parse(room.serverTime) - Date.now();
    this.publish({
      ...(Number.isFinite(serverOffset) && room.revision >= (previous?.revision ?? -1)
        ? { serverOffset }
        : {}),
      ...(phaseChanged ? { drawingBlocked: false } : {}),
    });
  }
  private receiveCanvas(canvas: CanvasDto, force = false) {
    if (
      canvas.roomId !== this.state.room?.roomId ||
      (!force && canvas.revision <= this.canvasRevision)
    )
      return;
    if (canvas.revision < this.canvasRevision) return;
    this.canvasRevision = canvas.revision;
    // Artist already rendered these commands. Echoes of undo/clear must not erase
    // newer local ink. Recovery and phase changes explicitly replace the snapshot.
    if (!force && this.canDraw()) return;
    this.drawing.replace(canvas);
  }
  // The artist isn't sent their own updates. Anything older than the canvas we have is ignored.
  private receiveCanvasUpdate(update: CanvasUpdateDto) {
    if (update.roomId !== this.state.room?.roomId || update.revision <= this.canvasRevision) return;
    this.canvasRevision = update.revision;
    this.drawing.applyRemote(update.operation, update.stroke, update.points);
  }
  private async invoke<T = void>(method: string, ...args: unknown[]): Promise<T> {
    if (!this.session || !this.state.room || this.snapshot.status !== "connected")
      throw new Error("Connection interrupted. Please wait for your room to reconnect.");
    return this.connection.invoke<T>(
      method,
      this.session.playerId,
      this.state.room.roomId,
      ...args,
    );
  }
  private async connect(serial: number) {
    // A previous dispose() may still be stopping the connection, and start() would reject.
    await this.stopping;
    // Abandoned attempts must not start a connection the attempt replacing them is using.
    if (this.entrySerial !== serial) throw new Error("Connection attempt was cancelled.");
    if (this.connection.state === HubConnectionState.Disconnected) await this.connection.start();
  }
  async enter(playerName: string, roomCode?: string) {
    if (this.entering) return;
    const serial = ++this.entrySerial;
    this.entering = true;
    this.buffered = [];
    this.publish({ status: "connecting", error: null });
    try {
      await this.connect(serial);
      const entry = roomCode
        ? await this.connection.invoke<RoomEntryDto>("JoinRoom", playerName, roomCode)
        : await this.connection.invoke<RoomEntryDto>("CreateRoom", playerName);
      if (this.entrySerial === serial) this.acceptEntry(entry);
    } catch (error) {
      this.buffered = [];
      this.publish({ status: "offline" });
      throw new Error(errorMessage(error));
    } finally {
      if (this.entrySerial === serial) this.finishEntry();
    }
  }
  // Reclaims the seat saved by a previous page load, e.g. after a refresh.
  async restore() {
    const saved = loadSession();
    if (!saved || this.session || this.entering) {
      if (this.snapshot.restoring) this.publish({ restoring: false });
      return;
    }
    const serial = ++this.entrySerial;
    this.entering = true;
    this.buffered = [];
    this.publish({ status: "connecting", error: null, restoring: true });
    try {
      await this.connect(serial);
      const entry = await this.connection.invoke<RoomEntryDto>("ReconnectToRoom", saved);
      if (this.entrySerial === serial) this.acceptEntry(entry);
    } catch {
      // The seat has expired or the room is gone, so fall back to the home page.
      if (this.entrySerial === serial) {
        saveSession(null);
        this.publish({ status: "offline" });
      }
    } finally {
      if (this.entrySerial === serial) {
        this.finishEntry();
        this.publish({ restoring: false });
      }
    }
  }
  async leave() {
    this.queue.cancel();
    // Invalidate restoration before awaiting the leave response: a concurrent
    // reconnect completion must not resurrect the room the user just left.
    const departure =
      this.snapshot.status === "connected" ? this.invoke("LeaveRoom") : Promise.resolve();
    this.session = null;
    saveSession(null);
    this.entrySerial++;
    this.entering = false;
    this.buffered = [];
    try {
      await departure;
    } finally {
      this.session = null;
      this.state.reset();
      this.drawing.reset();
      this.canvasRevision = -1;
      await this.connection.stop();
      this.publish({ status: "offline", error: null, drawingBlocked: false });
    }
  }
  async action(method: string, ...args: unknown[]) {
    try {
      await this.invoke(method, ...args);
    } catch (error) {
      this.publish({ error: errorMessage(error) });
      throw error;
    }
  }
  saveSettings(settings: GameSettings) {
    return this.action("UpdateGameSettings", settingsRequest(settings));
  }
  // Used when this app instance unmounts. The saved session is kept, so a remount (or
  // StrictMode's dev double-mount) can restore() the seat. Pending entries are abandoned.
  dispose() {
    this.queue.cancel();
    this.entrySerial++;
    this.entering = false;
    this.buffered = [];
    this.stopping = this.connection.stop().catch(() => {});
  }
}
