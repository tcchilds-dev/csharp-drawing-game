# Drawing coordinates and API handoff

The board uses **1131 × 902 logical units** as a shared coordinate space only.
The canvas always fills the original 12-row grid area, with no fixed aspect ratio,
inset margins, or JavaScript sizing of the panel. Coordinates scale independently
on each axis to fill that area; drawings may change proportions across screen
shapes. Preserving the existing UI structure takes priority over matching drawing
proportions. Brush widths (4, 8, 14, 22) scale by the smaller axis to keep the brush
and its cursor round. Neither CSS pixels nor device pixels enter stored stroke data.

A stroke starts inside the canvas and continues while the primary button is held,
including when the pointer leaves and re-enters. Outside points are retained as
finite coordinates beyond the logical board bounds; the canvas clips their ink.
Do not clamp these points or discard the outside path: that would draw unwanted
connections along the edge or across the board. The whole gesture remains one
stroke for replay and undo. Releasing outside, cancelling, or losing focus ends it.

`DrawingCanvas` redraws retained vectors into a backing canvas sized for the
current device pixel ratio. `renderStroke` uses midpoint quadratic Bézier curves,
round joins/caps, and a filled dot for a click. Local and received strokes use the
same renderer. Quadratics are traced with overlapping round-capped line segments,
subdivided and simplified to at most 0.1 device pixel of error. This avoids the
software curve stroker's pale pinholes on dense, jittery input without changing
the input points or brush size.

`DrawingRenderer` paints stable sections of the active stroke onto the base canvas
once, in fixed groups of 64 quadratic segments. Only the unfinished section and
its endpoint are redrawn on the transparent overlay; clearing is limited to that
preview's bounds. Simplification also operates on these bounded sections, never
on the entire accumulating stroke during pointer movement. Work per frame depends
on newly received points and a short tail, not how long the mouse has been held.
Mouse-up commits only the tail, without replaying either the stroke or the history.
Replay uses identical section boundaries, independent of pointer event batching.
Undo, snapshot replacement, resize, and context restoration rebuild from retained
vectors. One gesture still stores one complete point array and is undone as one
stroke. Brush changes update the cursor and next stroke without resetting either
bitmap. Neither layer changes the panel's layout.

Both layers request software-backed 2D contexts with `willReadFrequently: true`
as a workaround for reported black flashing on the accelerated drawing path.
Pixel density and vector smoothing are unchanged. Context options are fixed on
the first `getContext` call, so reload the page after changing this setting;
hot reload can retain contexts created with the old options.

`DrawingModel.onCommand` now feeds `network/drawingQueue.ts` and the SignalR
transport in `network/gameClient.ts`. Pointer samples are coalesced for 20ms,
split into batches of at most 128 points and invoked in order with the current
playerId and roomId. Drawing remains immediate; commands never trigger React
renders. A slow connection delays commands but never drops them. The artist keeps
drawing through a reconnect; once the room is restored, `resyncCommands` compares
the server's canvas with the local one and sends only what the server is missing,
so the artist's canvas is never rolled back. Uncertain commands are never replayed
as-is. The model stays within the server's limits, so a rejected command (answered
with the real canvas via `SyncCanvas`, which replaces the local drawing) is a last
resort.

`applyRemote` retains active-stroke identity and appends only the newly received
points from `SyncCanvasUpdate`, preserving incremental rendering for guessers.
`network/remotePlayback.ts` feeds it: each received batch is released linearly,
a few points per animation frame, over the measured gap between batches (at most
150ms), so remote strokes grow continuously like local drawing. End, undo and
clear wait for earlier points. Playback never lags behind the newest batch, and a
snapshot cancels anything still waiting to be played.
`replace(CanvasDto)` is for entry, rejection recovery and phase changes. Snapshots
enumerate completed strokes newest-first and are reversed to paint oldest-first.
The transport ignores updates for another room or older than its canvas revision.

Run `npm test` with Node 22.18+ for stroke lifecycle, point validation, and wire-format
checks. Run `npm run build` and `npm run lint` for the frontend checks.
With Vite running, open `/tests/rendering.html` for real-browser pixel checks of
slow and fast strokes across brush widths, display scales, and drawing directions.
It also compares incremental drawing with replay through section boundaries,
commit, history changes, and invalidation, and verifies that extending or finishing
a 60,000-point stroke reads only a bounded number of points.
