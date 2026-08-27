import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const TOKEN_KEY = "acciocall_token";

function formatClock(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [roomName, setRoomName] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [callStatus, setCallStatus] = useState("Standby");
  const [isJoining, setIsJoining] = useState(false);
  const [remoteName, setRemoteName] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [localActive, setLocalActive] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);
  const peerConnection = useRef(null);
  const socketRef = useRef(null);
  const activeRoomRef = useRef("");
  const joinedNameRef = useRef("");

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
    setLocalActive(false);
  }, []);

  const closePeerConnection = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteActive(false);
  }, []);

  const leaveRoom = useCallback(() => {
    if (activeRoomRef.current) {
      socketRef.current?.emit("leave-room", activeRoomRef.current);
    }

    closePeerConnection();
    stopMedia();
    activeRoomRef.current = "";
    setActiveRoom("");
    setRemoteName("");
    setElapsed(0);
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
      setRemoteActive(true);
      setCallStatus("Connected");
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

      const target = users[0];
      setRemoteName(target.name || "Participant");
      createPeerConnection(target.id);

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socketRef.current?.emit("offer", { target: target.id, offer });
      setCallStatus(`Calling ${target.name || "participant"}`);
    },
    [createPeerConnection],
  );

  const handleUserJoined = useCallback((data) => {
    setCallStatus(`${data.name || "Participant"} joined`);
    setRemoteName(data.name || "Participant");
  }, []);

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
    socket.on("connect", () => setCallStatus("Standby"));
    socket.on("all-users", handleAllUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", () => {
      closePeerConnection();
      setRemoteName("");
      setCallStatus("Participant left. Waiting again");
    });
    socket.on("offer", handleReceiveOffer);
    socket.on("answer", handleReceiveAnswer);
    socket.on("ice-candidate", handleNewIceCandidate);
    socket.io.on("reconnect", () => {
      if (activeRoomRef.current) {
        socket.emit("join-room", {
          roomName: activeRoomRef.current,
          name: joinedNameRef.current,
        });
      }
    });

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
    if (!isInRoom) return undefined;

    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [isInRoom]);

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
          body: JSON.stringify({ email, password, fullName }),
        });
      }

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user || { email });
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
    setFullName("");
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
    setLocalActive(true);
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    const nextRoom = roomName.trim();
    if (!nextRoom) return;

    setIsJoining(true);
    setCallStatus("Opening camera");
    setElapsed(0);

    try {
      if (!localStream.current) {
        await startLocalMedia();
      }

      activeRoomRef.current = nextRoom;
      joinedNameRef.current = user?.fullName || "Participant";
      setActiveRoom(nextRoom);
      socketRef.current?.emit("join-room", {
        roomName: nextRoom,
        name: user?.fullName || "Participant",
      });
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
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-5 py-8 text-white">
        <img src="/Print.png" alt="AccioCall logo" className="mb-8 h-20 w-auto object-contain md:h-24" />

        <form
          className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 text-zinc-950 shadow-2xl"
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
            </div>

            {authMode === "register" && (
              <label className="mt-6 block text-sm font-semibold text-zinc-700">
                Full name
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Harry Potter"
                  required
                  type="text"
                  value={fullName}
                />
              </label>
            )}

            <label
              className={`block text-sm font-semibold text-zinc-700 ${
                authMode === "register" ? "mt-4" : "mt-6"
              }`}
            >
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
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <img src="/Print.png" alt="AccioCall logo" className="h-full w-full object-contain" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-amber-400">AccioCall</h1>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Video room</p>
            </div>
          </div>
          <button
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
            onClick={logout}
            type="button"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <form className="p-5" onSubmit={joinRoom}>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Room
            </p>
            <label className="mt-4 flex h-12 items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-4">
              <span className="h-2 w-2 rounded-full bg-zinc-600" />
              <input
                className="h-full w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-600"
                disabled={isInRoom}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="room-name"
                value={roomName}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                disabled={isJoining || isInRoom}
                type="submit"
              >
                <span className="h-2 w-2 rounded-full bg-zinc-950/70" />
                {isJoining ? "Joining..." : "Join"}
              </button>
              <button
                className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-rose-400 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-600"
                disabled={!isInRoom}
                onClick={leaveRoom}
                type="button"
              >
                Leave
              </button>
            </div>
          </form>

          <div className="border-t border-zinc-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Status
            </p>
            <p className="mt-3 flex items-center gap-2.5 text-lg font-bold">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  callStatus.startsWith("Connected")
                    ? "bg-emerald-400"
                    : "bg-zinc-500"
                }`}
              />
              {callStatus}
            </p>
            {activeRoom && (
              <p className="mt-1 font-mono text-xs text-zinc-500">
                Room: {activeRoom}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-dashed border-zinc-800 pt-3 font-mono text-xs text-zinc-500">
              <span>On air</span>
              <span>{formatClock(elapsed)}</span>
            </div>
          </div>
        </aside>

        <section className="grid gap-5 xl:grid-cols-2">
          <VideoPanel
            active={localActive}
            clock={formatClock(elapsed)}
            label={`${user?.fullName || "You"} (You)`}
            placeholder={user?.fullName?.charAt(0).toUpperCase() || "Y"}
            videoRef={localVideoRef}
            muted
          />
          <VideoPanel
            active={remoteActive}
            clock={remoteActive ? formatClock(elapsed) : "—"}
            label={remoteName || "Waiting for participant"}
            placeholder="···"
            videoRef={remoteVideoRef}
          />
        </section>
      </section>
    </main>
  );
}

function VideoPanel({
  label,
  videoRef,
  muted = false,
  active = false,
  clock = "00:00:00",
  placeholder = "···",
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-zinc-500" />
        <p className="text-sm font-bold text-white">{label}</p>
      </div>
      <div className="relative aspect-video bg-[#0d1016]">
        <video
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${
            active ? "" : "opacity-0"
          }`}
          muted={muted}
          playsInline
          ref={videoRef}
        />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-zinc-700 font-mono text-xl text-zinc-500">
              {placeholder}
            </span>
            {!muted && (
              <p className="font-mono text-xs text-zinc-600">
                No one else has joined yet
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2.5 font-mono text-xs text-zinc-500">
        <span>{clock}</span>
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <rect height="5" rx="0.5" width="2.5" x="1" y="10" />
          <rect height="8" rx="0.5" width="2.5" x="6" y="7" />
          <rect height="11" rx="0.5" width="2.5" x="11" y="4" />
        </svg>
      </div>
    </div>
  );
}

export default App;
