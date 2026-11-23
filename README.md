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
- Group WebRTC audio/video calls for up to 6 participants, with independent microphone and camera controls for every participant, including the owner.
- Call signaling is authenticated and relays peer offers, answers, and ICE candidates through Socket.IO. Media streams are peer-to-peer; the server does not record audio or video.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
```

Set both a cryptographically random `SESSION_SECRET` (at least 32 characters) and a separate random `OWNER_SETUP_TOKEN` before starting the server. Startup is refused if `SESSION_SECRET` is missing or too short. Keep both values private and do not commit them to GitHub. The owner setup token must be at least 32 characters long.

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

The SQLite database is created in `data/dark-spot.sqlite`. It stores accounts, messages, invitations, and persistent login sessions. Password approval increments the account session version and invalidates that user’s previous sessions. Socket chat is limited to 8 messages per 10 seconds per connection. In production, the app trusts one reverse proxy hop so secure cookies work correctly behind an HTTPS tunnel. On a fresh database, create the owner from the setup screen using `OWNER_SETUP_TOKEN`. Once the owner exists, the setup route is permanently closed for that database. The owner creates invitations from the owner panel; each invitation is single-use and expires exactly 96 hours after creation. Registration without a valid invitation is rejected. Do not expose the server publicly until HTTPS/tunnel configuration and further security testing are completed.

## Hosting plan

The target is to run the server on the owner's computer. Friends will connect through a public HTTPS address (not LAN); when the owner's computer is off, the service will be unavailable. A tunnel option will be evaluated after the local MVP is tested.

## Next milestones

1. Test registration, login, message persistence, and owner permissions.
2. Complete security hardening: persistent session storage, secure cookie/HTTPS configuration, session revocation, and Socket.IO rate limits.
3. Add WebRTC audio/video rooms for up to 6 people.
4. Add public HTTPS tunnel deployment and production session handling.
5. Add optional games/entertainment after core chat and calls are stable.
\n\n## Group calls\n\nCalls use a peer-to-peer WebRTC mesh with a maximum of 6 participants. Each participant can independently enable or disable their own microphone and camera; the owner has the same controls as everyone else. The current ICE configuration uses a public STUN server only. Some network/NAT combinations will not establish a direct connection without a TURN relay, so calls must be tested over HTTPS on the actual networks before being considered production-ready. Camera and microphone access require a secure context (HTTPS, or localhost during local development).\n\n\nCall moderation: the owner can independently disable or re-enable another participant's microphone or camera while they are in the call. The server authorizes this action against the current database role and enforces the restriction in participant media state; the participant's browser stops and removes the affected local media track. Participants are notified when a restriction is applied or released.\n