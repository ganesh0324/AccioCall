# AccioCall

Hogwarts is calling you! A full-stack video calling app — sign in, pick a room name, and start a direct browser-to-browser video call powered by WebRTC with Socket.IO handling the signaling.

## Features

- **JWT authentication** — register/login with hashed passwords (bcrypt), protected REST routes
- **Room-based calls** — create/join named rooms via Socket.IO
- **WebRTC video calls** — direct P2P audio/video between two participants
- **Clean lifecycle** — media tracks stop and peer connections close on leave/logout

## Tech Stack

| Layer    | Tech                                              |
| -------- | ------------------------------------------------- |
| Frontend | React 19, Vite, socket.io-client                  |
| Backend  | Node.js, Express 5, Socket.IO                     |
| Database | PostgreSQL + Prisma ORM                           |
| Auth     | JWT (`jsonwebtoken`), bcrypt                      |

## Project Structure

```
AccioCall/
├── client/               # React + Vite frontend
│   └── src/
│       ├── App.jsx       # Auth UI, room UI, WebRTC peer logic
│       └── main.jsx
└── server/               # Express API + Socket.IO signaling
    ├── prisma/
    │   └── schema.prisma # User & Room models
    └── src/
        ├── app.js        # Express app + routes mounting
        ├── server.js     # HTTP + Socket.IO signaling server
        ├── controllers/  # authController, roomController
        ├── middleware/   # JWT protect middleware
        ├── config/       # Prisma client
        └── routes/       # authRoutes (auth + rooms)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL running locally

### 1. Server setup

```bash
cd server
npm install

# create .env
DATABASE_URL="postgresql://user:password@localhost:5432/acciocall"
JWT_SECRET="your-secret"
PORT=5000

# apply migrations, then start
npx prisma migrate dev
npm run dev          # or npm start
```

Server runs on `http://localhost:5000`.

### 2. Client setup

```bash
cd client
npm install

# create .env (optional — falls back to Vite proxy)
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

npm run dev
```

Client runs on `http://localhost:5173`. In dev mode Vite proxies `/api` and `/socket.io` to `127.0.0.1:5000`, so the `.env` can be omitted locally.

## API Endpoints

Base URL: `/api/auth`

| Method | Endpoint      | Access | Description              |
| ------ | ------------- | ------ | ------------------------ |
| POST   | `/register`   | Public | Create account           |
| POST   | `/login`      | Public | Login, returns JWT       |
| POST   | `/logout`     | Public | Logout                   |
| GET    | `/me`         | JWT    | Current user profile     |
| POST   | `/rooms`      | JWT    | Create a room            |
| GET    | `/rooms`      | JWT    | List rooms               |
| DELETE | `/rooms/:id`  | JWT    | Delete a room            |

## Socket Events

| Event           | Direction        | Payload                    |
| --------------- | ---------------- | -------------------------- |
| `join-room`     | client → server  | room name                  |
| `leave-room`    | client → server  | room name                  |
| `all-users`     | server → client  | other socket ids in room   |
| `user-joined`   | server → clients | new socket id              |
| `user-left`     | server → clients | departed socket id         |
| `offer` / `answer` / `ice-candidate` | relayed | `{ target, ... }` |

## How a Call Works

1. Client joins a room → server replies with `all-users` (existing participants) and notifies others via `user-joined`.
2. The joining side creates an `RTCPeerConnection`, generates an SDP **offer**, sends it to the first participant.
3. Remote side answers with an SDP **answer**.
4. Both sides exchange ICE candidates until a direct P2P connection is established.
5. On leave/disconnect, the server cleans up room membership and peers reset their streams.

> Note: currently limited to one-to-one calls (first participant in the list is connected). Uses Google's public STUN server for NAT traversal.
