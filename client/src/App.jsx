import { useEffect, useRef, useState } from "react";
import socket from "./socket";
import {
  createPeerConnection,
  getPeerConnection,
  getDataChannel,
  sendMessage,
  setDataChannel,
} from "./webrtc";
//111
function App() {
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const selectedFileRef = useRef(null);
  const incomingFileRef = useRef(null);

  const [messages, setMessages] = useState([]);

  const isHost = useRef(false);

  const receivedChunks = useRef([]);

  const receivedSize = useRef(0);

  const sendMetadata = () => {
    if (!selectedFile) {
      alert("Select a file");
      return;
    }

    const metadata = {
      type: "metadata",
      name: selectedFile.name,
      size: selectedFile.size,
      mime: selectedFile.type,
    };

    sendMessage(JSON.stringify(metadata));

    console.log("Metadata Sent", metadata);
  };

  const handleChannelMessage = async (event) => {
    console.log("Received:", event.data);

    // JSON messages
    if (typeof event.data === "string") {
      const data = JSON.parse(event.data);
      console.log(typeof event.data);

      switch (data.type) {
        case "metadata":
          console.log("Metadata Received");
          setIncomingFile(data);
          incomingFileRef.current = data;
          break;

        case "accept":
          console.log("Receiver Accepted");
          // console.log("Selected File :", selectedFile);
          // if (selectedFile) {
          startFileTransfer();
          // }

          break;

        case "reject":
          console.log("Receiver Rejected");

          alert("Receiver rejected the file.");

          setIncomingFile(null);

          break;

        case "file-end":
          console.log("Transfer Complete");

          const blob = new Blob(receivedChunks.current);

          const url = URL.createObjectURL(blob);

          const a = document.createElement("a");

          a.href = url;
          a.download = incomingFileRef.current.name;

          document.body.appendChild(a);

          a.click();

          document.body.removeChild(a);

          URL.revokeObjectURL(url);

          receivedChunks.current = [];
          receivedSize.current = 0;

          setIncomingFile(null);
          incomingFileRef.current = null;

          alert("File Downloaded");

          break;

        default:
          console.log("Unknown Message", data);
      }

      return;
    }

    // Binary chunks
    receivedChunks.current.push(event.data);

    receivedSize.current += event.data.byteLength;

    console.log(`Received ${receivedSize.current} bytes`);
  };

  const CHUNK_SIZE = 64 * 1024;

  const startFileTransfer = () => {
    console.log("========== START FILE TRANSFER ==========");

    const file = selectedFileRef.current;

    if (!file) {
      console.log("No selected file");
      return;
    }

    const channel = getDataChannel();

    console.log("Channel:", channel);
    console.log("State:", channel.readyState);

    let offset = 0;

    const reader = new FileReader();

    reader.onload = (e) => {
      channel.send(e.target.result);

      offset += e.target.result.byteLength;

      console.log(`Sent ${offset} / ${file.size}`);

      if (offset < file.size) {
        readSlice(offset);
      } else {
        console.log("Sending file-end");

        sendMessage(
          JSON.stringify({
            type: "file-end",
          }),
        );
      }
    };

    function readSlice(offset) {
      console.log("Reading slice:", offset);

      // IMPORTANT: use file, not selectedFile
      const slice = file.slice(offset, offset + CHUNK_SIZE);

      reader.readAsArrayBuffer(slice);
    }

    readSlice(0);
  };

  useEffect(() => {
    socket.on("room-created", (code) => {
      console.log("Room Created:", code);

      isHost.current = true;

      setRoomCode(code);
      setStatus("Waiting for another user...");
    });

    socket.on("room-joined", (code) => {
      console.log("Joined:", code);

      setRoomCode(code);
      setStatus("Joined Room");
    });

    socket.on("peer-ready", async () => {
      console.log("Peer Ready");

      setStatus("Connecting...");

      const pc = createPeerConnection(socket);

      if (!isHost.current) return;

      console.log("Creating Data Channel");

      const channel = pc.createDataChannel("file");

      setDataChannel(channel);

      channel.onopen = () => {
        console.log("Data Channel Open");
        setStatus("Connected");
      };

      channel.onclose = () => {
        console.log("Data Channel Closed");
      };

      channel.onerror = (err) => {
        console.error("DataChannel Error:", err);
      };

      channel.onmessage = handleChannelMessage;

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      socket.emit("offer", offer);

      console.log("Offer Sent");
    });

    socket.on("offer", async (offer) => {
      console.log("Offer Received");

      const pc = createPeerConnection(socket);

      pc.ondatachannel = (event) => {
        console.log("Received Data Channel");

        const channel = event.channel;

        setDataChannel(channel);

        channel.onopen = () => {
          console.log("Data Channel Open");
          setStatus("Connected");
        };

        channel.onclose = () => {
          console.log("Data Channel Closed");
        };

        channel.onerror = (err) => {
          console.error("DataChannel Error:", err);
        };

        channel.onmessage = handleChannelMessage;
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      socket.emit("answer", answer);

      console.log("Answer Sent");
    });

    socket.on("answer", async (answer) => {
      console.log("Answer Received");

      const pc = getPeerConnection();

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async (candidate) => {
      console.log("ICE Candidate");

      const pc = getPeerConnection();

      if (!pc) return;

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate.candidate));
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("room-full", () => {
      alert("Room Full");
    });

    socket.on("room-not-found", () => {
      alert("Room Not Found");
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  const createRoom = () => {
    socket.emit("create-room");
  };

  const joinRoom = () => {
    socket.emit("join-room", joinCode);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>PeerShare</h1>

      <button onClick={createRoom}>Create Room</button>

      <br />
      <br />

      <input
        placeholder="Room Code"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
      />

      <button onClick={joinRoom}>Join</button>

      <hr />

      <h2>Room</h2>

      <h1>{roomCode}</h1>

      <h2>Status</h2>

      <h2>{status}</h2>

      {/* <hr />

      <h2>Chat</h2>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message"
      />

      <button onClick={send}>Send</button>

      <hr />

      {messages.map((m, index) => (
        <div key={index}>{m}</div>
      ))} */}

      <hr />

      <h2>Send File</h2>

      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files[0];

          setSelectedFile(file);
          selectedFileRef.current = file;

          console.log("While Selecting File:", file);
        }}
      />

      <button onClick={sendMetadata}>Send File</button>

      <h3>
        Sending
        {progress}%
      </h3>

      {incomingFile && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            border: "1px solid black",
          }}
        >
          <h2>Incoming File</h2>

          <p>Name : {incomingFile.name}</p>

          <p>Size : {(incomingFile.size / 1024 / 1024).toFixed(2)} MB</p>

          <p>Type : {incomingFile.mime}</p>

          <button
            onClick={() => {
              sendMessage(
                JSON.stringify({
                  type: "accept",
                }),
              );
            }}
          >
            Accept
          </button>

          <button
            onClick={() => {
              sendMessage(
                JSON.stringify({
                  type: "reject",
                }),
              );

              setIncomingFile(null);
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
