const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("PeerShare Server Running");
});

/*
====================================
Room Storage
====================================
*/

const rooms = {};

/*
rooms = {
    "123456": {
        host: "socketId",
        guest: "socketId"
    }
}
*/

function generateRoomCode() {
  let code;

  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);

  return code;
}

/*
====================================
Socket Connection
====================================
*/

io.on("connection", (socket) => {
  console.log("Connected :", socket.id);

  /*
    ==========================
    Create Room
    ==========================
    */

  socket.on("create-room", () => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      host: socket.id,
      guest: null,
    };

    socket.roomCode = roomCode;

    socket.join(roomCode);

    socket.emit("room-created", roomCode);

    console.log("Room Created :", roomCode);
  });

  /*
    ==========================
    Join Room
    ==========================
    */

  socket.on("join-room", (roomCode) => {
    if (!rooms[roomCode]) {
      socket.emit("room-not-found");

      return;
    }

    if (rooms[roomCode].guest) {
      socket.emit("room-full");

      return;
    }

    rooms[roomCode].guest = socket.id;

    socket.roomCode = roomCode;

    socket.join(roomCode);

    socket.emit("room-joined", roomCode);

    /*
        Notify host and guest
        */

    io.to(roomCode).emit("peer-ready");

    console.log("Peer Joined :", roomCode);
  });

  /*
    ==========================
    Offer
    ==========================
    */

  socket.on("offer", (offer) => {
    console.log("Offer received from", socket.id);
    socket.to(socket.roomCode).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    console.log("Answer received from", socket.id);
    socket.to(socket.roomCode).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    console.log("ICE candidate from", socket.id);
    socket.to(socket.roomCode).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected :", socket.id);

    const roomCode = socket.roomCode;

    if (!roomCode) return;

    const room = rooms[roomCode];

    if (!room) return;

    if (room.host === socket.id) {
      io.to(roomCode).emit("host-left");

      delete rooms[roomCode];

      console.log("Room Deleted :", roomCode);

      return;
    }

    if (room.guest === socket.id) {
      room.guest = null;

      io.to(roomCode).emit("guest-left");

      console.log("Guest Left :", roomCode);
    }
  });
});

/*
====================================
Start Server
====================================
*/

server.listen(3000, () => {
  console.log("Server Running on Port 3000");
});
