# Runbook: someone cannot sign in

**What people see:** "Sign-in failed", a page that reloads back to the sign-in form, an invite link
that says it is invalid/expired, or "Two-step login is required for everyone in this workspace".

## 1. First, is it one person or everyone?

Open **`/status`** and read **Sign-in**:

- **"Sign-in is not set up on this installation"** → the whole installation has no sign-in
  configuration (`SUPABASE_URL` is missing). Nothing the person does will work. Hand over to the
  owner (deployment settings), do not retry.
- **"Set up."** → sign-in is configured, so the problem is this account, this link, or this device.
  Go on to step 2.

## 2. The account itself

1. Ask whether they can sign in from a different browser or their phone (rules out a browser
   extension or an old tab). Close every tab of the app first — an old tab holds an old session.
2. If they *can* sign in elsewhere, the session was stale: signing out and in again on the failing
   device is the fix.
3. If the password reset email never arrives, follow [emails-stop.md](emails-stop.md) — the email is
   sent by the same service as invoice emails, so the status page says whether it can send at all.

## 3. An invite link that is refused

Invite links are signed and time-limited. A refused link means one of:

- it was **already used** (an invite works once — ask the owner to send a new one);
- it has **expired** (send a new one);
- it was sent for a **different email address** than the one signed in now.

The owner re-sends from **Settings → Team**. Nothing is fixed by editing the link.

## 4. "Two-step login is required for everyone in this workspace"

An owner turned on the workspace-wide requirement (`requireTwoStep`). The person must set up an
authenticator app once, from **Settings → Security**, then sign in with the code. Two escapes exist
and both belong to the owner:

- the owner can sign in with their own code and turn the requirement off;
- the owner can reset an enrolled factor for a person who lost their phone.

**Never** switch the requirement off for everybody just to unblock one person: that weakens every
account in the workspace. Turn it back on immediately after the person is enrolled.

## 5. If nothing above fits

Collect and send to the owner: the **time (with time zone)**, the **email address**, the exact
**message on screen**, and whether `/status` shows Sign-in as set up. Do not create duplicate
accounts — every duplicate becomes a second workspace with real books in it.
