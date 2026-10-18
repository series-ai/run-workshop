# Local multiplayer check

Date: 17 October 2026.

The check used `npm run dev`, the installed Syncplay rc.54 authority, and the
native Yard physics runtime. It used two tabs with separate SDK identities.
It made no hosted game or authentication requests.

Run the check with:

```bash
npx playwright test --config playwright.dev.config.ts
```

The configuration uses installed Chrome and ports 4497 and 4498. Set
`PLAYWRIGHT_CHANNEL=chromium` to compare the bundled browser. Keep these ports
free. The tests save reports and images in `test-results/dev-multiplayer/`.

## Confirmed behavior

- The first tab sends one create request.
- `?room=CODE` sends one join request. It removes spaces and converts the code
  to uppercase. It does not create another room first.
- Both tabs show the same code and Crew 2/4. They use different player slots.
- The copy button puts the room code on the clipboard.
- Chrome 155.0.8059.84 showed movement on both peers.
- During that movement, confirmed frames advanced at 29.18 and 29.33 Hz.
  The guest drew at 42.53 Hz. Its interpolated position changed 26 times while
  the discrete frame and discrete position stayed fixed.
- The build, identity check, TypeScript check, and 42 existing match, play gate,
  and presentation tests passed against the isolated source snapshot.
- The built room configuration matched the authored four-seat, 30 Hz file.
- Separate focused tests passed leaving, rejoining with the same owner slot,
  invalid-code retry, new-room recovery, and switching to another room.
- Seven existing browser checks passed for startup, capture, pause, resume,
  dragging, room sharing, and connection error recovery.

These rates measure the observed frame sequence. They do not measure all
physics work during prediction or replay. Simulation and rendering share the
main thread. This check does not prove phone performance.

## Open failures

The full local acceptance check did not pass. Do not use this record as release
acceptance.

Bundled Chromium 153.0.8010.12 had an unstable frame rate. In the final
960 by 640 run, the guest drew at 7.14 Hz. Confirmed frames advanced at
30.29 Hz. The test held forward input with focus active and the menu closed.
Neither peer showed movement for that player. An earlier run passed movement.
The cause remains open.

After a player left, the other tab showed Crew 1/4 after 31 to 35 seconds.
The room continued to advance. This matches the SDK disconnect grace period.
See [the seat audit](seats.txt).

The separate focused rejoin passed, but it took 29.66 seconds to show the live
UI. Installed Chrome used hardware Metal rendering on an Apple M5 Max.

Rejoin failed the visible Live check within 45 seconds in both browser builds.
The final Chrome DOM contained a visible Live lamp and Crew 2/4. The controller
used the original slot, but its frame was more than 1,100 frames behind the
host. A final DOM snapshot does not prove that the UI met the timeout.

Raw evidence from this check is in `test-results/dev-multiplayer/`:
`run-7-report.json`, `run-5-report.json`, and
`chrome-comparison-report.json`. These files are local test output.
Focused results are in `chrome-focused.json` and `chrome-legacy-start.json`.

## Syncplay snapshot defect

The local authority logged repeated `snapshot-target-tick-mismatch` failures.
It then logged `snapshot-transfer-timeout`. The installed rc.54 code has a
protocol mismatch:

- `authority-room.js`, `validateAndStoreSnapshot`, requires
  `snapshot.tick === pendingTransfer.targetTick`.
- `networked-client.js`, `handleSnapshotRequest`, treats the requested
  `minFrame` as a lower bound. It can select a later reported tick when the
  requested checkpoint is unavailable.
- The SDK sets the offered wire tick. The Yard save bytes do not set it.

Both the dev authority and the hosted authority use this contract. No public
game setting repairs it. A lower `snapshotCadenceTicks` could cause more
rejected transfers. Keep the current cadence until the SDK contract is fixed.
These logs prove rejected transfers. They do not prove the cause of every
slow frame or the complete rejoin delay.

The SDK fix must use one tick contract for the request, donor, and server.
If the target is exact and its checkpoint is unavailable, the donor must
decline that target. The server must recover through another donor or a new
target. A protocol test must remove the exact requested checkpoint while
retaining a later one. It must verify rejection recovery and a later join
from a validated snapshot with a contiguous frame tail.
