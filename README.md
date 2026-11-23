# Dark-Spot

Private messaging and video calling platform for a small group of friends.

## Current MVP

- Persian and English responsive interface.
- Username/password login.
- First owner is created through a one-time setup flow protected by `OWNER_SETUP_TOKEN`.
- New member registration requires a single-use invitation created by the owner; invitations expire after 96 hours.
- Maximum of 6 accounts.
- Owner can promote members to admin; owner role cannot be reassigned through the member-role endpoint.
- Realtime group chat with messages stored in SQLite.
- Maximum call capacity is reserved at 6 participants; audio/video calling is not implemented yet.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
```

Set both a long random session secret and a separate random owner setup token before starting the server. Keep both values private and do not commit them to GitHub. The owner setup token must be at least 32 characters long.

Windows PowerShell:
```powershell
$env:SESSION_SECRET="replace-with-a-long-random-secret"
$env:OWNER_SETUP_TOKEN="replace-with-a-separate-random-token-at-least-32-characters"
npm start
```

Linux/macOS:
```bash
export SESSION_SECRET="replace-with-a-long-random-secret"
export OWNER_SETUP_TOKEN="replace-with-a-separate-random-token-at-least-32-characters"
npm start
```

Open http://localhost:3000.

The SQLite database is created in `data/dark-spot.sqlite`. On a fresh database, create the owner from the setup screen using `OWNER_SETUP_TOKEN`. Once the owner exists, the setup route is permanently closed for that database. The owner creates invitations from the owner panel; each invitation is single-use and expires exactly 96 hours after creation. Registration without a valid invitation is rejected. Do not expose the server publicly until HTTPS/tunnel configuration, persistent production session storage, and security testing are completed.

## Hosting plan

The target is to run the server on the owner's computer. Friends will connect through a public HTTPS address (not LAN); when the owner's computer is off, the service will be unavailable. A tunnel option will be evaluated after the local MVP is tested.

## Next milestones

1. Test registration, login, message persistence, and owner permissions.
2. Complete security hardening: persistent session storage, secure cookie/HTTPS configuration, session revocation, and Socket.IO rate limits.
3. Add WebRTC audio/video rooms for up to 6 people.
4. Add public HTTPS tunnel deployment and production session handling.
5. Add optional games/entertainment after core chat and calls are stable.
