import { io } from "socket.io-client";

const socket = io("https://peershare-0fn3.onrender.com:3000");

export default socket;