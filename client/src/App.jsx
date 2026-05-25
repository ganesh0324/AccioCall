import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, "");
const TOKEN_KEY = "acciocall_token";

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [roomName, setRoomName] = useState("demo-room");
  const [activeRoom, setActiveRoom] = useState("");
  const [callStatus, setCallStatus] = useState("Ready to join");
  const [isJoining, setIsJoining] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);
  const peerConnection = useRef(null);
  const socketRef = useRef(null);
  const activeRoomRef = useRef("");

  const isLoggedIn = Boolean(token);
  const isInRoom = Boolean(activeRoom);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  );

  const apiRequest = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...options.headers,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }

      return data;
    },
    [authHeaders],
  );

  const stopMedia = useCallback(() => {
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const closePeerConnection = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const leaveRoom = useCallback(() => {
    if (activeRoomRef.current) {
      socketRef.current?.emit("leave-room", activeRoomRef.current);
    }

    closePeerConnection();
    stopMedia();
    activeRoomRef.current = "";
    setActiveRoom("");
    setCallStatus("You left the call");
  }, [closePeerConnection, stopMedia]);

  const createPeerConnection = useCallback((targetSocketId) => {
    closePeerConnection();

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStream.current?.getTracks().forEach((track) => {
      connection.addTrack(track, localStream.current);
    });

    connection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setCallStatus("Connected with another participant");
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          target: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.current = connection;
  }, [closePeerConnection]);

  const handleAllUsers = useCallback(
    async (users) => {
      if (!users.length) {
        setCallStatus("Waiting for someone to join");
        return;
      }

      const targetSocketId = users[0];
      createPeerConnection(targetSocketId);

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socketRef.current?.emit("offer", { target: targetSocketId, offer });
      setCallStatus("Calling participant");
    },
    [createPeerConnection],
  );

  const handleUserJoined = useCallback(
    async (socketId) => {
      setCallStatus("Participant joined");
      createPeerConnection(socketId);

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socketRef.current?.emit("offer", { target: socketId, offer });
    },
    [createPeerConnection],
  );

  const handleReceiveOffer = useCallback(
    async (data) => {
      createPeerConnection(data.sender);

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(data.offer),
      );

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socketRef.current?.emit("answer", {
        target: data.sender,
        answer,
      });
      setCallStatus("Answering call");
    },
    [createPeerConnection],
  );

  const handleReceiveAnswer = useCallback(async (data) => {
    await peerConnection.current?.setRemoteDescription(
      new RTCSessionDescription(data.answer),
    );
    setCallStatus("Connected");
  }, []);

  const handleNewIceCandidate = useCallback(async (data) => {
    try {
      await peerConnection.current?.addIceCandidate(
        new RTCIceCandidate(data.candidate),
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    apiRequest("/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      });
  }, [apiRequest, token]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
    });

    socketRef.current = socket;
    socket.on("connect", () => setCallStatus("Ready to join"));
    socket.on("all-users", handleAllUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", () => {
      closePeerConnection();
      setCallStatus("Participant left. Waiting again");
    });
    socket.on("offer", handleReceiveOffer);
    socket.on("answer", handleReceiveAnswer);
    socket.on("ice-candidate", handleNewIceCandidate);

    return () => {
      socket.off("all-users", handleAllUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left");
      socket.off("offer", handleReceiveOffer);
      socket.off("answer", handleReceiveAnswer);
      socket.off("ice-candidate", handleNewIceCandidate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    closePeerConnection,
    handleAllUsers,
    handleNewIceCandidate,
    handleReceiveAnswer,
    handleReceiveOffer,
    handleUserJoined,
    token,
  ]);

  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    setIsAuthLoading(true);

    try {
      if (authMode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      }

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser({ email });
      setPassword("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = () => {
    leaveRoom();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setEmail("");
    setPassword("");
  };

  const startLocalMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    const nextRoom = roomName.trim();
    if (!nextRoom) return;

    setIsJoining(true);
    setCallStatus("Opening camera");

    try {
      if (!localStream.current) {
        await startLocalMedia();
      }

      activeRoomRef.current = nextRoom;
      setActiveRoom(nextRoom);
      socketRef.current?.emit("join-room", nextRoom);
      setCallStatus(`Joined ${nextRoom}`);
    } catch (error) {
      console.error(error);
      setCallStatus("Camera or microphone permission was blocked");
      stopMedia();
    } finally {
      setIsJoining(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-7">
            <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              Secure video rooms
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-bold tracking-normal text-white md:text-7xl">
                AccioCall
              </h1>
              <p className="max-w-xl text-lg leading-8 text-zinc-300">
                Sign in, choose a room, and start a direct browser video call
                with clean WebRTC signaling.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {["JWT auth", "Room calls", "Leave cleanup"].map((item) => (
                <div
                  className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm font-semibold text-zinc-200"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form
            className="rounded-lg border border-white/10 bg-white p-6 text-zinc-950 shadow-2xl"
            onSubmit={handleAuth}
          >
            <div className="mb-6 flex rounded-lg bg-zinc-100 p-1 text-sm font-semibold">
              <button
                className={`flex-1 rounded-md px-4 py-2 ${
                  authMode === "login" ? "bg-zinc-950 text-white" : ""
                }`}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={`flex-1 rounded-md px-4 py-2 ${
                  authMode === "register" ? "bg-zinc-950 text-white" : ""
                }`}
                onClick={() => setAuthMode("register")}
                type="button"
              >
                Register
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">
                {authMode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-sm text-zinc-500">
                Use the backend auth API to get a JWT for protected routes.
              </p>
            </div>

            <label className="mt-6 block text-sm font-semibold text-zinc-700">
              Email
              <input
                className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-zinc-700">
              Password
              <input
                className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                minLength="6"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                required
                type="password"
                value={password}
              />
            </label>

            {authError && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {authError}
              </p>
            )}

            <button
              className="mt-6 h-12 w-full rounded-lg bg-cyan-600 font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isAuthLoading}
              type="submit"
            >
              {isAuthLoading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Register and login"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-cyan-700">AccioCall</p>
            <h1 className="text-2xl font-bold">Video room</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-600 sm:inline-flex">
              {user?.email || `User ${user?.userId || ""}`}
            </span>
            <button
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold hover:bg-zinc-50"
              onClick={logout}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <form
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            onSubmit={joinRoom}
          >
            <label className="block text-sm font-bold text-zinc-700">
              Room name
              <input
                className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                disabled={isInRoom}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="daily-standup"
                value={roomName}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-lg bg-cyan-600 px-4 text-sm font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={isJoining || isInRoom}
                type="submit"
              >
                {isJoining ? "Joining..." : "Join"}
              </button>
              <button
                className="h-11 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={!isInRoom}
                onClick={leaveRoom}
                type="button"
              >
                Leave
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-zinc-500">Status</p>
            <p className="mt-2 text-lg font-bold text-zinc-950">
              {callStatus}
            </p>
            {activeRoom && (
              <p className="mt-2 text-sm text-zinc-500">Room: {activeRoom}</p>
            )}
          </div>
        </aside>

        <section className="grid gap-5 xl:grid-cols-2">
          <VideoPanel label="You" videoRef={localVideoRef} muted />
          <VideoPanel label="Remote participant" videoRef={remoteVideoRef} />
        </section>
      </section>
    </main>
  );
}

function VideoPanel({ label, videoRef, muted = false }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-white">{label}</p>
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
      </div>
      <div className="aspect-video bg-zinc-900">
        <video
          autoPlay
          className="h-full w-full object-cover"
          muted={muted}
          playsInline
          ref={videoRef}
        />
      </div>
    </div>
  );
}

export default App;
