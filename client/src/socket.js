import { io } from "socket.io-client";

const socket = io("https://peer-share-mu.vercel.app/");

export default socket;