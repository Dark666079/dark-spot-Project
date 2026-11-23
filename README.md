# Dark-Spot

Private messaging and video calling platform for a small group of friends.

## Current MVP

- Persian and English responsive interface.
- Username/password registration and login.
- First registered account becomes the owner.
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

Set a long random session secret before sharing the service outside your computer.

Windows PowerShell:
```powershell
$env:SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Linux/macOS:
```bash
export SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Open http://localhost:3000.

The SQLite database is created in `data/dark-spot.sqlite`. The first account created becomes the owner. Do not expose the server publicly until HTTPS/tunnel configuration, persistent production session storage, account invitation controls, and security testing are completed.

## Hosting plan

The target is to run the server on the owner's computer. Friends will connect through a public HTTPS address (not LAN); when the owner's computer is off, the service will be unavailable. A tunnel option will be evaluated after the local MVP is tested.

## Next milestones

1. Test registration, login, message persistence, and owner permissions.
2. Add secure invitation/approval so registration is not open to strangers.
3. Add WebRTC audio/video rooms for up to 6 people.
4. Add public HTTPS tunnel deployment and production session handling.
5. Add optional games/entertainment after core chat and calls are stable.
