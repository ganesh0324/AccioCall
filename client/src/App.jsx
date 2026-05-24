import { useEffect, useRef, useState } from "react";

import { io } from "socket.io-client";


const socket = io("http://192.168.1.89:5000");


function App() {

  const [roomName, setRoomName] = useState("");

  const localVideoRef = useRef(null);

  const remoteVideoRef = useRef(null);

  const localStream = useRef(null);

  const peerConnection = useRef(null);



  useEffect(() => {

    startVideo();

    socket.on("all-users", handleAllUsers);

    socket.on("user-joined", handleUserJoined);

    socket.on("offer", handleReceiveOffer);

    socket.on("answer", handleReceiveAnswer);

    socket.on(
      "ice-candidate",
      handleNewICECandidate
    );


    return () => {

      socket.off("all-users");

      socket.off("user-joined");

      socket.off("offer");

      socket.off("answer");

      socket.off("ice-candidate");
    };

  }, []);




  // START CAMERA
  const startVideo = async () => {

    try {

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

      localStream.current = stream;

      localVideoRef.current.srcObject = stream;

    } catch (error) {

      console.log(error);
    }
  };




  // CREATE PEER CONNECTION
  const createPeerConnection = (targetSocketId) => {

    peerConnection.current =
      new RTCPeerConnection({

        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302"
          }
        ]
      });


    // LOCAL TRACKS
    localStream.current
      .getTracks()
      .forEach((track) => {

        peerConnection.current.addTrack(
          track,
          localStream.current
        );
      });


    // REMOTE STREAM
    peerConnection.current.ontrack =
      (event) => {

        remoteVideoRef.current.srcObject =
          event.streams[0];
      };


    // ICE CANDIDATES
    peerConnection.current.onicecandidate =
      (event) => {

        if (event.candidate) {

          socket.emit("ice-candidate", {
            target: targetSocketId,
            candidate: event.candidate
          });
        }
      };
  };




  // JOIN ROOM
  const joinRoom = () => {

    socket.emit("join-room", roomName);
  };




  // EXISTING USERS
  const handleAllUsers = async (users) => {

    if (users.length === 0) return;

    const targetSocketId = users[0];

    createPeerConnection(targetSocketId);

    const offer =
      await peerConnection.current.createOffer();

    await peerConnection.current
      .setLocalDescription(offer);

    socket.emit("offer", {
      target: targetSocketId,
      offer
    });
  };




  // NEW USER JOINED
  const handleUserJoined = async (socketId) => {

    createPeerConnection(socketId);

    const offer =
      await peerConnection.current.createOffer();

    await peerConnection.current
      .setLocalDescription(offer);

    socket.emit("offer", {
      target: socketId,
      offer
    });
  };




  // RECEIVE OFFER
  const handleReceiveOffer = async (data) => {

    createPeerConnection(data.sender);

    await peerConnection.current
      .setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

    const answer =
      await peerConnection.current.createAnswer();

    await peerConnection.current
      .setLocalDescription(answer);

    socket.emit("answer", {
      target: data.sender,
      answer
    });
  };




  // RECEIVE ANSWER
  const handleReceiveAnswer = async (data) => {

    await peerConnection.current
      .setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
  };




  // RECEIVE ICE
  const handleNewICECandidate =
    async (data) => {

      try {

        await peerConnection.current
          .addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );

      } catch (error) {

        console.log(error);
      }
    };




  return (

    <div style={{ padding: "20px" }}>

      <h1>AccioCall</h1>

      <input
        type="text"
        placeholder="Enter Room"
        value={roomName}
        onChange={(e) =>
          setRoomName(e.target.value)
        }
      />

      <button onClick={joinRoom}>
        Join Room
      </button>

      <hr />

      <h2>Local Video</h2>

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        width="400"
      />

      <h2>Remote Video</h2>

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        width="400"
      />

    </div>
  );
}

export default App;