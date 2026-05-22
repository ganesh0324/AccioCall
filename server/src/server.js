require("dotenv").config();
const app = require("./app");



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`ACCIOCALL API is running on port ${PORT}`)

});require("dotenv").config();

const http = require("http");

const { Server } = require("socket.io");

const app = require("./app");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});


// SOCKET CONNECTION
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // join room
  socket.on("join-room", (roomName) => {

    socket.join(roomName);

    console.log(`${socket.id} joined ${roomName}`);

    // notify everyone in room
    io.to(roomName).emit(
      "user-joined",
      `${socket.id} joined room`
    );
  });

  // disconnect
  socket.on("disconnect", () => {

    console.log("User disconnected:", socket.id);
  });
});


const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(`Server running on port ${PORT}`);
});