# AccioCall

Hogwarts is calling you! A full-stack video calling app — sign in, pick a room name, and start a direct browser-to-browser video call powered by WebRTC, with Socket.IO handling the signaling.

## Features

- **JWT authentication** — register/login with hashed passwords (bcrypt), protected REST routes
- **Room-based calls** — create/join named rooms via Socket.IO
- **WebRTC video calls** — direct peer-to-peer audio/video between two participants
- **Reconnect-safe signaling** — the client rejoins its active room automatically after a socket reconnect
- **Clean lifecycle** — media tracks stop and peer connections close on leave/logout

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
│       └── main.jsx
└── server/                # Express API + Socket.IO signaling
    ├── prisma/
    │   └── schema.prisma  # User & Room models
    └── src/
        ├── app.js         # Express app + routes mounting
        ├── server.js      # HTTP + Socket.IO signaling server
        ├── controllers/   # authController, roomController
        ├── middleware/    # JWT protect middleware
        ├── config/        # Prisma client
        └── routes/        # authRoutes (auth + rooms)
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
```

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
| POST   | `/rooms`     | JWT    | Create a room          |
| GET    | `/rooms`     | JWT    | List rooms             |
| DELETE | `/rooms/:id` | JWT    | Delete a room (owner only) |

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
