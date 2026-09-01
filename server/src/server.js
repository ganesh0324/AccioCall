require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const corsOrigins = require("./config/corsOrigins");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});


const rooms = {};

const participantNames = {};

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
  socket.on("join-room", ({ roomName, name } = {}) => {

    if (!roomName) return;

    socket.join(roomName);

    participantNames[socket.id] = name || "Participant";

    if (!rooms[roomName]) {
      rooms[roomName] = [];
    }

    if (!rooms[roomName].includes(socket.id)) {
      rooms[roomName].push(socket.id);
    }

    console.log(`${participantNames[socket.id]} (${socket.id}) joined ${roomName}`);

    const otherUsers =
      rooms[roomName]
        .filter((id) => id !== socket.id)
        .map((id) => ({
          id,
          name: participantNames[id],
        }));

    socket.emit("all-users", otherUsers);

    socket.to(roomName).emit(
      "user-joined",
      {
        id: socket.id,
        name: participantNames[socket.id],
      }
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

    delete participantNames[socket.id];
  });
});


const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
