# Project instructions

## Project scope

Cyberpunk-Tester is for Cyberpunk 2077 mods from any author. Identify the affected mod, build, deployment and expected behavior from each ticket. Use the quest-reproduction skill for quest issues across mods. Choose save and runtime identity checks appropriate to the target. The implemented ticket runner currently validates Lives of Night City saves and deployments; a different mod needs its own verification before this runner can issue a verdict for it.

Use the [background game testing skill](skills/background-game-testing/SKILL.md) when a test needs to leave the user's desktop available or reduce graphics and memory pressure.

## Privacy and public releases

This repository is public. These instructions apply to every ticket, agent handoff, commit, and GitHub publication.

Use the [public release audit](skills/public-release-audit/SKILL.md) before staging release changes and before pushing or merging a reviewed revision.

- Address the user as “you” in chat. Omit personal attribution from project materials. Never use the user's name or Windows account name, or infer a name from a filesystem path, account, or Git configuration.
- Keep personal and security-sensitive information private. This includes email addresses, local account and machine names, absolute user paths, private repository details, credentials, tokens, keys, and private security reports.
- Keep raw tickets, saves, logs, traces, crash dumps, screenshots, recordings, and repair reports outside the public checkout by default. Use repository-relative paths and synthetic examples in public documentation. Share review evidence privately with the user.
- Before staging files or publishing anything, inspect the exact content and metadata. Check commit author, committer, email, and attribution trailers as well as filenames and diffs. For media, inspect visible and audible content and embedded metadata. If public-safe attribution is needed and none is configured, ask the user which project identity to use.
- Apply the same checks to branch names, issues, pull requests, release assets, and CI output. Keep sensitive material private if it cannot be verified as safe to publish.
- Obtain the user's explicit approval before pushing or merging the reviewed revision. Approval to publish code does not authorize disclosure of personal or security-sensitive information.
- For every future release, stage only the reviewed files by name and inspect the staged patch, including newly added files. Before pushing, inspect every outgoing commit, including merge commits, for personal attribution, private addresses, signatures and trailers. Use the established public project identity and a verified no-reply address for both author and committer.
- Keep release notes and handoffs public-safe too. Describe a test with synthetic identifiers or a general result. Deliver the actual ticket ID, save details, local report and video in the originating private chat.

## Bug reports and project handoffs

For a reported Cyberpunk 2077 mod defect, follow `skills/bug-report-handoff/SKILL.md` from intake through private evidence delivery and a handoff for the affected project. Use the pilot below for Lives of Night City.

## Lives of Night City pilot

When a new chat reports a Lives of Night City bug, treat the message as a ticket and run the pilot in this checkout. Design discussions alone do not create tickets. Use the commands and JSON formats in README.md. The chat itself provides gameplay decisions. Keep working through case verdicts and private evidence delivery during the active chat.

For save selection, load-order verification and deep quest routes, read `skills/quest-reproduction/SKILL.md` and follow it throughout each case. A generic control check has no bearing on a Lives of Night City verdict.

1. Run `doctor` and `new` through the headless client by default. Keep every command on the same Windows worker. The worker runs in the interactive game desktop and keeps evidence outside the checkout. Use `--interactive` before every command for an explicitly requested local run. Keep raw ticket contents out of shell history where possible and never write them into this checkout.
2. Inspect manual save metadata with `saves` and the relevant installed mod files. Choose an ordinary compatible starting slot using the quest and player state. Define happy, edge and negative cases with independent observable success criteria in `plan`. Infer a reasonable route from the ticket and mod logic. Do not require a prepared save or a manual playthrough.
3. Use `start` per case. Begin with a route observation. Check the loaded world, mod-specific signals, journal and choices. Navigate with bounded `step` actions. Read each returned private PNG with an image viewer tool, or decode the frame command's output into an image tool. Do not print base64 or private paths in chat. Include alternate branches, short action batches, and retries when observations warrant them. Follow the quest skill's [world travel and local obstacle guidance](skills/quest-reproduction/SKILL.md#world-travel-and-local-obstacles) for assisted setup. Preserve the real trigger, including required travel and dialogue. Never force the state being tested. Keep manual saves intact.
4. Record the actual trigger in a test-phase step. Inspect the before, trigger, and outcome frames, using video timestamps where necessary. For a negative case establish a meaningful observation window. Attach the reviewed clip names and describe the visible prerequisite and outcome in `judge`. Missing prerequisites, lost inputs, unreadable frames, and exhausted recovery mean inconclusive. An absence of visible errors alone does not establish success. Use `status` to resume interrupted work. A partially executed step must be re-observed before retrying.
5. Run `finish`, then `open` to present the local report and its videos privately. Give the ticket ID, three results, relevant clip names/timestamps, and blockers in the originating chat. When the desktop is unavailable give a path beginning with the literal environment variable `%LOCALAPPDATA%` or the report-opening command. Keep personal path components out of links and captions. Raw footage stays private.
