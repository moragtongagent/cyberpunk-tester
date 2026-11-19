# Cyberpunk-Tester

Cyberpunk-Tester is a gameplay testing project for Cyberpunk 2077 mods from any author. Lives of Night City is the first supported pilot. Its runner verifies the active deployment and the mod's save marker. Other mods can use the quest-testing method and need their own identity checks for automated verdicts.

For the pilot, describe what happened, what you expected, and any quest, role, or dialogue choice you remember in a new project chat. An ordinary compatible manual save is sufficient to **attempt** a route. The agent chooses a starting slot and uses observations from the actual game to play forward.

## Default headless setup

Ticket commands run on a separate Windows game worker by default. The client needs Node.js 22+ and an SSH client. The worker uses a logged-in, unlocked desktop to render the game, send input and record evidence. Keep the game worker private and run it from its desktop session.

1. On the Windows worker, install Cyberpunk 2077, the mod under test, Node.js 22+, PowerShell 7, and FFmpeg/FFprobe on PATH. FFmpeg needs the Windows Graphics Capture filter (`gfxcapture`) and libx264. Set `CPT_GAME`, `CPT_SAVES`, and `CPT_VORTEX_EXE` on the worker if it uses nonstandard locations. The game's save arguments resolve against the worker's Windows account.
2. Set the same strong `CPT_WORKER_TOKEN` in the worker and client environments. Generate a value with `node -p "require('node:crypto').randomBytes(32).toString('base64url')"` and share it privately. On the worker's desktop, run `node pilot.mjs worker`. It listens on `127.0.0.1:49180`.
3. On the client, open an SSH tunnel to the worker's [OpenSSH server](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse). Keep this command running and replace `game-worker` with your SSH host alias.

   ~~~powershell
   ssh -NT -o ExitOnForwardFailure=yes -L 127.0.0.1:49180:127.0.0.1:49180 game-worker
   ~~~

4. Run `node pilot.mjs doctor`, `node pilot.mjs profile`, and `node pilot.mjs smoke` from the client to check the worker. Archive detection confirms files are present. Verify the mod is active in the loaded game during each case.

`CPT_WORKER_PORT` overrides the default port. Update the corresponding side of the SSH forward when using a different port. If the worker is unavailable, the command fails and the ticket can be resumed when it reconnects. Check `status` before retrying an action after a disconnect.

The pilot launches Cyberpunk with its [specific-save argument](https://github.com/CDPR-Modding-Documentation/Cyberpunk-Modding-Docs/blob/main/for-mod-users/users-modding-cyberpunk-2077/the-cyberpunk-2077-game-directory/launch-parameters.md). Each case launches the same manual slot and checks the save fingerprint. Gameplay uses the installed mod list and normal game autosave behavior. Avoid overwriting any manual save. Close an existing personal play session before running a ticket. A user session that triggers a platform or game permission prompt may need one-time setup.

For an explicit local run, put `--interactive` before the command, for example `node pilot.mjs --interactive doctor`. Use this form for every command on a local ticket. Use the same worker throughout a remote ticket.

## Fresh-chat workflow

The chat is the gameplay agent. It stays on the ticket, reads the mod source when useful, selects actions, inspects private frames, and updates the verdict. The runner executes bounded actions, owns the game reservation, and persists the ticket between calls. Exiting the chat pauses decisions. Resume from the ticket ID in a new chat.

Private files default to `%LOCALAPPDATA%\Cyberpunk-Tester\private\<ticket-id>` on the worker. Set `CPT_PRIVATE` to another private, non-synced folder outside Git if needed. `node pilot.mjs open <ticket-id>` copies the report and its videos to a private folder on the client and opens the report on Windows. Add `--download` to skip opening a browser. The command prints the report path relative to the client's private ticket directory. Set `CPT_PRIVATE` on a non-Windows client when downloading a report.

### Operator commands

Commands that take JSON read it from standard input. In PowerShell, pipe a single-quoted JSON string or `ConvertTo-Json -Depth 10 -Compress` to the command. In the table, `ID` stands for the ticket ID returned by `new`.

| Command | Input or result |
|---|---|
| `node pilot.mjs new` | `{"ticket":"<reported behavior and expectation>"}` creates the private ticket. |
| `node pilot.mjs profile` | Reads the active Vortex profile using its CLI and compares it with the deployment manifest and on-disk load order. Prints a fingerprint and any discrepancies. Set `CPT_VORTEX_EXE` for a nonstandard installation. |
| `node pilot.mjs saves` | Lists manual slots, save metadata and NCL identity status. The NCL v1 class marker must match the SHA-256 of both metadata and save data. Older unmarked saves have unverified identity. |
| `node pilot.mjs saves QUEST_FRAGMENT` | Finds verified slots whose tracked journal entry contains the quest or stage fragment. Search earlier prerequisites as well as the target. An untracked quest can still be active. |
| `node pilot.mjs plan ID` | JSON with `slot`, `route`, and `cases`. Each case has `trigger`, `expected`, and an ordered array of observable prerequisite strings named `milestones`. A mod ticket requires a verified NCL save and a matching deployment. |
| `node pilot.mjs start ID happy` | Launches the starting save. Repeat for each case. Restarting gracefully closes only the game launched by this ticket. |
| `node pilot.mjs step ID` | JSON with `phase` (route or test), `goal`, and an `actions` array. An empty array observes. Returns a private clip and a frame from its end. |
| `node pilot.mjs milestone ID` | Submit `index` (starting at zero), a reviewed route `clip`, and the actual `observed` state. Complete the sequence before recording the trigger. |
| `node pilot.mjs observe ID` | Supply `{"facts":[]}` to record live player position, class and tracked objective via WkMCP. Include fact names from the installed build when the case requires them. |
| `node pilot.mjs frame ID FRAME [seconds]` | Returns a PNG encoded as base64 for image-tool integration. Use seconds to inspect the middle of a clip. |
| `node pilot.mjs judge ID` | JSON with `verdict`, `prerequisite`, `observed`, and `evidence` (reviewed clip names). Pass/fail requires test-phase footage. |
| `node pilot.mjs blocked ID` | JSON with `reason`. Records outstanding cases as inconclusive if recovery is exhausted. |
| `node pilot.mjs finish ID` | Finalizes the report, asks the owned game to close, and releases the reservation. |
| `node pilot.mjs status ID` | Returns private plan, attempts, actions, and outcomes for resuming. |
| `node pilot.mjs release ID` | Releases a stalled ticket's game reservation. Resolve unfinished attempts as inconclusive before another launch. |
| `node pilot.mjs smoke` | Checks actual window capture without gameplay input. Uses an existing game window or opens the title screen. |

Example step input:

~~~json
{"phase":"route","goal":"Approach the marked entrance and inspect the interaction prompt","actions":[{"type":"key","key":"w","ms":600},{"type":"wait","ms":350}]}
~~~

Actions include held keys, relative camera motion (`{"type":"look","x":120,"y":0}`), clicks in normalized game-client coordinates (`{"type":"click","x":0.5,"y":0.7}`), and waits. Input checks the foreground game window. Each batch gets a silent game-window clip covering the actions and a short settling period. There can be gaps between batches while the agent reviews frames. Put time-sensitive action and observation in the same batch. Any conclusion needing sound alone is inconclusive with this pilot.

Use `node --test` for offline regression checks. Use `node --test worker.integration.mjs` in an interactive Windows session to verify client and worker communication over loopback using synthetic tickets. Use a real ticket to validate that a route and the three case outcomes hold on a particular build.

### WkMCP observation

The pilot starts the [WkMCP v2.1.0 release](https://github.com/Guikingone/WkMCP/releases/tag/v2.1.0) over MCP stdio on the game host. Use the official `wkmcp.mcpb` archive with its published SHA-256, extract it under `%LOCALAPPDATA%\Cyberpunk-Tester\tools\WkMCP-v2.1.0\package`, or set `CPT_WKMCP` to the extracted folder. Copy its `live-bridge/CETBridge` directory into the game's CET mods folder, select `transport = "file"` in the bridge configuration, and cold-start the game. Keep the package, local configuration and captures outside Git.

Run `observe` before and after the trigger. The tester reads the tracked journal objective, the class label from the NCL role system, the player position and named quest facts. It verifies a fresh heartbeat and saves each observation in the case report. For travel and incidental combat during setup, follow the [quest skill's route guidance](skills/quest-reproduction/SKILL.md#world-travel-and-local-obstacles). Use normal player inputs for the approach, dialogue and quest actions the case exercises.

In raw-input menus, move the game cursor with `look`, then send `{"type":"select"}` to click its current position. Scroll the hovered list with `{"type":"scroll","ticks":-4}`. A negative value scrolls down.

The pilot compares the private environment fingerprint at planning, launch and verdict. It reads Vortex's enabled mods and ordered archive and REDmod lists, deployment ownership, the game's order files, and deployed file content. Use `profile --details` privately to inspect the lists. The ticket retains the lists from its baseline. A direct launch with enabled REDmods is currently unsupported because Vortex can recompile them at launch. The preflight reports that condition. It never deploys, sorts, purges, or switches profiles.

If Vortex reports that its state database is locked by the running manager, let any deployment finish and close Vortex normally so it saves its state. Repeat the profile check and reopen the manager after the ticket's final verdict.
