---
name: public-release-audit
description: Audit a Cyberpunk-Tester revision before staging, pushing or merging it into the public repository. Covers release content, Git history, project attribution and publication approval.
---

# Audit a public revision

Apply this audit to changes to the audit skill itself. Keep findings and any sensitive evidence in the originating private chat.

1. Identify the intended public destination, target branch and approved changes. Read the current remote tip. Compare the working tree, index and outgoing history with that baseline. Check branch names and file names, including untracked candidates and both sides of renames. Isolate unrelated local work before publication.
2. Before staging, read the exact candidate changes, including the full contents of new files. Check for personal attribution, account and machine names, absolute user paths, private project references, secrets and private security reports. Keep raw tickets, saves, logs, traces, crash dumps, recordings and repair reports private by default. For any proposed media, inspect what can be seen or heard and its embedded metadata. Inspect proposed issue or pull request text, release notes, asset names and CI output with the same standard.
3. Confirm the effective Git author and committer identities with `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` privately. Match both to the established public project identity and its verified no-reply address. If no public-safe identity is established, ask which identity to use before committing.
4. Stage the reviewed paths explicitly with `git add -- <paths>`. Inspect the entire index with `git diff --cached --name-status`, `git diff --cached` and `git diff --cached --check`. Compare staged blobs for binary files with the copies inspected in step 2. Resolve unexpected entries or content before committing.
5. Enumerate **every** outgoing commit with `git rev-list --reverse <remote-tip>..<candidate>`. For each, read the raw commit with `git cat-file -p <commit>` to inspect parents, author, committer, message, trailers and any signature or embedded merge tag. Inspect the patch against each parent, including merge resolutions. Check intermediate files even when a later commit removes them. For a root commit use `git show --root <commit>`. Repeat for the actual merge commit before pushing it.
6. Confirm the final tree diff and destination match the reviewed revision. Obtain explicit push or merge approval for that revision and destination, honoring approval already given. Recheck the remote tip before publication. If it has moved, review the resulting integration and any new outgoing commits. Push the reviewed ref and verify the destination contains the reviewed commit. Report the published revision privately.

If a check finds sensitive material, correct the unpublished candidate and audit it again. Keep the finding private, including when publication was already approved.
