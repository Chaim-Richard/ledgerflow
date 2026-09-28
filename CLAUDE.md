# CLAUDE.md

## Git workflow

Always commit and push directly to the main branch. Do not create feature branches or Pull Requests.

## Keep working (owner's instruction)

The owner can't watch all day. Whenever a session starts, resumes, or gets a message like
"Continue from where you left off" or the scheduled restart: **start working immediately** on the
next open item in `docs/TRACKER.md` (finish any uncommitted work first). Never answer with only a
status or "no response". Don't wait for the owner's confirmation: put open questions in
`docs/FOR_YOU.md` with the default you used, and keep going with the next item.

Tools that need the owner's approval (the Supabase connector, unless it is set to "Always allow")
stop the whole session until someone answers; on 26–28 Sept that cost 2½ days. Call them only to
apply a migration (never just to check something), after the code is committed and pushed, and
list any migration that could not be applied in `docs/FOR_YOU.md`.
