# Backend edge-case suite

Run `dotnet test DrawingGame.slnx` from the repository root.

Coverage is limited to cases that are awkward to exercise through ordinary play:
invalid/null/boundary input, rollback on rejection, role/socket spoofing, duplicate
commands, concurrent joins, snapshots that don't share mutable state, late commands
at exact deadlines, unfinished strokes at turn end, culture/Unicode, and
disconnect/reconnect authentication and expiry. The clock is advanced manually, so
no test waits through real rounds. The normal game loop is checked by playing it.
