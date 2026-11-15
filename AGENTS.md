# Project instructions

## Privacy and public releases

This repository is public. These instructions apply to every ticket, agent handoff, commit, and GitHub publication.

- Address the user as “you” in chat. Omit personal attribution from project materials. Never use the user's name or Windows account name, or infer a name from a filesystem path, account, or Git configuration.
- Keep personal and security-sensitive information private. This includes email addresses, local account and machine names, absolute user paths, private repository details, credentials, tokens, keys, and private security reports.
- Keep raw tickets, saves, logs, traces, crash dumps, screenshots, recordings, and repair reports outside the public checkout by default. Use repository-relative paths and synthetic examples in public documentation. Share review evidence privately with the user.
- Before staging files or publishing anything, inspect the exact content and metadata. Check commit author, committer, email, and attribution trailers as well as filenames and diffs. For media, inspect visible and audible content and embedded metadata. If public-safe attribution is needed and none is configured, ask the user which project identity to use.
- Apply the same checks to branch names, issues, pull requests, release assets, and CI output. Keep sensitive material private if it cannot be verified as safe to publish.
- Obtain the user's explicit approval before pushing or merging the reviewed revision. Approval to publish code does not authorize disclosure of personal or security-sensitive information.
- For every future release, stage only the reviewed files by name and inspect the staged patch, including newly added files. Before pushing, inspect every outgoing commit, including merge commits, for personal attribution, private addresses, signatures and trailers. Use the established public project identity and a verified no-reply address for both author and committer.
- Keep release notes and handoffs public-safe too. Describe a test with synthetic identifiers or a general result. Deliver the actual ticket ID, save details, local report and video in the originating private chat.

## Lives of Night City pilot

When a new chat reports a Lives of Night City bug, treat the message as a ticket and run the pilot in this checkout. Design discussions alone do not create tickets. Use the commands and JSON formats in README.md. The chat itself provides gameplay decisions. Keep working through case verdicts and private evidence delivery during the active chat.

For save selection, load-order verification and deep quest routes, read `skills/quest-reproduction/SKILL.md` and follow it throughout each case. A generic control check has no bearing on a Lives of Night City verdict.

1. Run `doctor` and `new`. Keep every ticket command in the same interactive Windows user environment. The private folder is outside the checkout and game controls need the interactive desktop. Use the platform's normal permission mechanism for those operations. Keep raw ticket contents out of shell history where possible and never write them into this checkout.
2. Inspect manual save metadata with `saves` and the relevant installed mod files. Choose an ordinary compatible starting slot using the quest and player state. Define happy, edge and negative cases with independent observable success criteria in `plan`. Infer a reasonable route from the ticket and mod logic. Do not require a prepared save or a manual playthrough.
3. Use `start` per case. Begin with a route observation. Check the loaded world, mod-specific signals, journal and choices. Navigate with bounded `step` actions. Read each returned private PNG with an image viewer tool, or decode the frame command's output into an image tool. Do not print base64 or private paths in chat. Include alternate branches, short action batches, and retries when observations warrant them. Preserve the real trigger, including required travel and dialogue. Never force the state being tested. Use ordinary game inputs and keep manual saves intact.
4. Record the actual trigger in a test-phase step. Inspect the before, trigger, and outcome frames, using video timestamps where necessary. For a negative case establish a meaningful observation window. Attach the reviewed clip names and describe the visible prerequisite and outcome in `judge`. Missing prerequisites, lost inputs, unreadable frames, and exhausted recovery mean inconclusive. An absence of visible errors alone does not establish success. Use `status` to resume interrupted work. A partially executed step must be re-observed before retrying.
5. Run `finish`, then `open` to present the local report and its videos privately. Give the ticket ID, three results, relevant clip names/timestamps, and blockers in the originating chat. When the desktop is unavailable give a path beginning with the literal environment variable `%LOCALAPPDATA%` or the report-opening command. Keep personal path components out of links and captions. Raw footage stays private.
