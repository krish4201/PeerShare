let peerConnection = null;
let dataChannel = null;

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

export function createPeerConnection(socket) {
  // Reuse existing connection
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(configuration);

  console.log("RTCPeerConnection created");

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE Candidate");

      socket.emit("ice-candidate", {
        candidate: event.candidate,
      });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(
      "Connection State:",
      peerConnection.connectionState
    );
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log(
      "ICE Connection State:",
      peerConnection.iceConnectionState
    );
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(
      "ICE Gathering State:",
      peerConnection.iceGatheringState
    );
  };

  peerConnection.onsignalingstatechange = () => {
    console.log(
      "Signaling State:",
      peerConnection.signalingState
    );
  };

  return peerConnection;
}

export function getPeerConnection() {
  return peerConnection;
}

export function setDataChannel(channel) {
  dataChannel = channel;

  console.log("DataChannel assigned");
}

export function getDataChannel() {
  return dataChannel;
}

export function sendMessage(message) {

    if (!dataChannel) {

        console.log("No DataChannel");

        return false;

    }

    if (dataChannel.readyState !== "open") {

        console.log("DataChannel not open");

        return false;

    }

    dataChannel.send(message);

    console.log("Sent :", message);

    return true;

}

export function closePeerConnection() {
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  console.log("Peer connection closed");
}