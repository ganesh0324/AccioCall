# AccioCall

Hogwarts is calling you! A full-stack video calling app — sign in, pick a room name, and start a direct browser-to-browser video call powered by WebRTC, with Socket.IO handling the signaling.

## Features

- **JWT authentication** — register/login with hashed passwords (bcrypt), protected REST routes
- **Room-based calls** — create/join named rooms via Socket.IO
- **WebRTC video calls** — direct peer-to-peer audio/video between two participants
- **Reconnect-safe signaling** — the client rejoins its active room automatically after a socket reconnect
- **Clean lifecycle** — media tracks stop and peer connections close on leave/logout
- **Admin portal** — role-gated screen to view/manage every user and room
- **Change password** — self-service password change from the header, current-password verified server-side
- **Forgot password** — email a time-limited reset link, no account enumeration

## Tech Stack

| Layer    | Tech                              |
| -------- | ---------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS, socket.io-client |
| Backend  | Node.js, Express 5, Socket.IO      |
| Database | PostgreSQL + Prisma ORM            |
| Auth     | JWT (`jsonwebtoken`), bcrypt       |

## Project Structure

```
AccioCall/
├── package.json          # root scripts to run client + server together
├── client/                # React + Vite frontend
│   └── src/
│       ├── App.jsx        # Auth UI, room UI, WebRTC peer logic
│       ├── AdminPanel.jsx # Admin-only users/rooms management screen
│       ├── ChangePasswordModal.jsx
│       ├── ResetPasswordForm.jsx
│       └── main.jsx
└── server/                # Express API + Socket.IO signaling
    ├── prisma/
    │   └── schema.prisma  # User & Room models
    ├── scripts/
    │   └── setAdminRole.js # CLI helper to promote/demote a user
    └── src/
        ├── app.js         # Express app + routes mounting
        ├── server.js      # HTTP + Socket.IO signaling server
        ├── controllers/   # authController, roomController, adminController
        ├── middleware/    # JWT protect + requireAdmin middleware
        ├── config/        # Prisma client
        └── routes/        # authRoutes, roomRoutes, adminRoutes
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL running locally

### 1. Configure environment variables

**`server/.env`**

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/acciocall"
JWT_SECRET="your-secret"
PORT=5000

# Used to build the link inside password-reset emails
CLIENT_URL="http://localhost:5173"

# SMTP — required for "forgot password" to actually send an email.
# Example for Gmail: host smtp.gmail.com, port 587, secure false,
# user your Gmail address, pass a 16-character Google "App Password"
# (not your normal password — https://myaccount.google.com/apppasswords)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
```

Without SMTP configured, "forgot password" still works end-to-end (the reset token is generated and stored), it just can't deliver the email — the request fails silently server-side and the API still returns its normal generic response either way.

**`client/.env`** (optional — falls back to Vite's dev proxy when omitted)

```bash
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 2. Install dependencies

```bash
npm run install:all
```

Installs dependencies for both `client/` and `server/` in one step (equivalent to running `npm install` in each folder separately).

### 3. Apply database migrations

```bash
cd server && npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

Starts the API/signaling server (`nodemon`) and the Vite dev server together in one terminal, output labeled `[server]` / `[client]`. The client runs on `http://localhost:5173` and proxies `/api` and `/socket.io` to the server on `http://localhost:5000`.

To run either side on its own instead:

```bash
npm run dev:server   # server only
npm run dev:client   # client only
```

## API Endpoints

Base URL: `/api/auth`

| Method | Endpoint     | Access | Description           |
| ------ | ------------ | ------ | ---------------------- |
| POST   | `/register`  | Public | Create account         |
| POST   | `/login`     | Public | Login, returns JWT     |
| POST   | `/logout`    | Public | Logout                 |
| GET    | `/me`        | JWT    | Current user profile   |
| POST   | `/change-password` | JWT | Change your own password — body `{ currentPassword, newPassword }` |
| POST   | `/forgot-password` | Public | Email a reset link if the address has an account — body `{ email }` |
| POST   | `/reset-password` | Public | Consume a reset token — body `{ token, newPassword }` |
| POST   | `/rooms`     | JWT    | Create a room          |
| GET    | `/rooms`     | JWT    | List rooms             |
| DELETE | `/rooms/:id` | JWT    | Delete a room (owner only) |

Base URL: `/api/admin` — every route below requires a valid JWT **and** the caller's current role in the database to be `ADMIN` (checked fresh on each request, not cached in the token).

| Method | Endpoint          | Description                              |
| ------ | ----------------- | ----------------------------------------- |
| GET    | `/users`          | List every user (no password hashes)     |
| PATCH  | `/users/:id/role` | Set a user's role — body `{ "role": "ADMIN" \| "USER" }` |
| DELETE | `/users/:id`      | Delete a user (and their rooms)          |
| GET    | `/rooms`          | List every room, with its host           |
| DELETE | `/rooms/:id`      | Delete any room, regardless of host      |

An admin can't demote or delete their own account through these routes — that's blocked server-side to avoid locking yourself out.

## Socket Events

| Event                                 | Direction         | Payload                    |
| -------------------------------------- | ------------------ | --------------------------- |
| `join-room`                            | client → server    | `{ roomName, name }`        |
| `leave-room`                           | client → server    | room name                   |
| `all-users`                            | server → client    | other participants in room  |
| `user-joined`                          | server → clients   | `{ id, name }`               |
| `user-left`                            | server → clients   | departed socket id           |
| `offer` / `answer` / `ice-candidate`   | relayed             | `{ target, ... }`            |

## How a Call Works

1. Client joins a room → server replies with `all-users` (existing participants) and notifies others via `user-joined`.
2. The joining side creates an `RTCPeerConnection`, generates an SDP **offer**, and sends it to the first participant.
3. The remote side answers with an SDP **answer**.
4. Both sides exchange ICE candidates until a direct peer-to-peer connection is established.
5. On leave/disconnect, the server cleans up room membership and peers reset their streams.

> Note: currently limited to one-to-one calls (the first participant in the room is connected). Uses Google's public STUN server for NAT traversal.

### Calling across different networks (TURN)

STUN alone (the default) lets two peers connect directly, which works when both are on the same or simply-NAT'd networks. Once callers are on different networks — home WiFi to mobile data, behind a restrictive/corporate firewall, or CGNAT — a direct connection often can't be established and calls need a **TURN** relay instead.

This app gets TURN credentials from [Metered.ca](https://www.metered.ca)'s TURN Server product via a small backend endpoint (`GET /api/turn/credentials`, auth-protected):

1. Sign up for Metered's TURN Server (free tier is enough for a project this size), go to TURN Server → **TURN Credentials**, and add a credential — it gives you a username/password pair (this pair is meant to be given to the browser, unlike the account-wide API key, so it's fine that it ends up in the client's `iceServers` config).
2. Set `METERED_TURN_USERNAME` and `METERED_TURN_CREDENTIAL` in `server/.env`.
3. Restart the server. The client automatically fetches the `iceServers` array via `turnController.js` before starting a call, and falls back to STUN-only if they're unset.

Any TURN provider (or a self-hosted [coturn](https://github.com/coturn/coturn)) can be substituted by changing what `turnController.js` returns — the client only cares that it gets back an `iceServers` array.

## Admin Portal

Every user has a `role` (`USER` by default, or `ADMIN`) on the `User` model. A logged-in admin sees an **Admin** button in the header, which opens a screen listing every user and every room, with actions to promote/demote a user, or delete a user or room.

There's no admin account by default, and the admin API itself requires an existing admin to call it — so the first one has to be granted from the server:

```bash
cd server
npm run admin:role -- someone@example.com ADMIN
```

They'll see the **Admin** button next time they refresh (or immediately, if they're already logged in — the role check is live, not cached in their token).

## Forgot Password

From the login screen, "Forgot password?" asks for an email and calls `/api/auth/forgot-password`. If an account exists for it, the server generates a random token, stores its SHA-256 hash with a 30-minute expiry on the `User` row, and emails a link like `http://localhost:5173/?resetToken=<token>` (built from `CLIENT_URL`). The response is identical whether or not the email exists, so the endpoint can't be used to check which emails are registered.

Opening that link loads the app straight into a "choose a new password" screen (`ResetPasswordForm.jsx`), which posts the token + new password to `/api/auth/reset-password`. The server re-hashes the token, checks it matches and hasn't expired, updates the password, and clears the token — so it's single-use.

Nothing here works without SMTP configured (see step 1) — until then, tokens are still generated and stored correctly, but no email actually goes out.
