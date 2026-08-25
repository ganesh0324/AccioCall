require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://192.168.1.89:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://6349-2404-7c00-42-e8b2-a804-5579-1632-53d4.ngrok-free.app",
      // "https://0707-2400-74e0-0-dbdf-a2c7-c73f-f256-fa.ngrok-free.app"
      
    ],
    methods: ["GET", "POST"],
  },
});


const rooms = {};

const removeSocketFromRoom = (socket, roomName) => {
  if (!rooms[roomName]) return;

  rooms[roomName] =
    rooms[roomName].filter(
      (id) => id !== socket.id
    );

  socket.leave(roomName);
  socket.to(roomName).emit("user-left", socket.id);

  if (rooms[roomName].length === 0) {
    delete rooms[roomName];
  }
};


io.on("connection", (socket) => {

  console.log("User connected:", socket.id);


  // JOIN ROOM
  socket.on("join-room", (roomName) => {

    if (!roomName) return;

    socket.join(roomName);

    if (!rooms[roomName]) {
      rooms[roomName] = [];
    }

    if (!rooms[roomName].includes(socket.id)) {
      rooms[roomName].push(socket.id);
    }

    console.log(`${socket.id} joined ${roomName}`);

    const otherUsers =
      rooms[roomName].filter(
        (id) => id !== socket.id
      );

    socket.emit("all-users", otherUsers);

    socket.to(roomName).emit(
      "user-joined",
      socket.id
    );
  });


  // LEAVE ROOM
  socket.on("leave-room", (roomName) => {

    removeSocketFromRoom(socket, roomName);
  });




  // OFFER
  socket.on("offer", (data) => {

    io.to(data.target).emit("offer", {
      offer: data.offer,
      sender: socket.id
    });
  });




  // ANSWER
  socket.on("answer", (data) => {

    io.to(data.target).emit("answer", {
      answer: data.answer,
      sender: socket.id
    });
  });




  // ICE CANDIDATE
  socket.on("ice-candidate", (data) => {

    io.to(data.target).emit(
      "ice-candidate",
      {
        candidate: data.candidate,
        sender: socket.id
      }
    );
  });




  // DISCONNECT
  socket.on("disconnect", () => {

    console.log("User disconnected:", socket.id);

    for (const roomName in rooms) {

      removeSocketFromRoom(socket, roomName);
    }
  });
});


const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
