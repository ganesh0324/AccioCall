import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminPanel({ apiRequest, currentUserId, onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tab, setTab] = useState("users");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([apiRequest("/admin/users"), apiRequest("/admin/rooms")])
      .then(([usersRes, roomsRes]) => {
        if (cancelled) return;
        setUsers(usersRes.users || []);
        setRooms(roomsRes.rooms || []);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load admin data");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiRequest, reloadKey]);

  const toggleRole = async (targetUser) => {
    const nextRole = targetUser.role === "ADMIN" ? "USER" : "ADMIN";
    setBusyId(targetUser.id);
    setError("");
    try {
      await apiRequest(`/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u)),
      );
    } catch (err) {
      setError(err.message || "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (targetUser) => {
    if (!window.confirm(`Delete ${targetUser.email}? This also deletes their rooms.`)) return;

    setBusyId(targetUser.id);
    setError("");
    try {
      await apiRequest(`/admin/users/${targetUser.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
    } catch (err) {
      setError(err.message || "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  };

  const removeRoom = async (room) => {
    if (!window.confirm(`Delete room "${room.roomName}"?`)) return;

    setBusyId(room.id);
    setError("");
    try {
      await apiRequest(`/admin/rooms/${room.id}`, { method: "DELETE" });
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (err) {
      setError(err.message || "Failed to delete room");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-amber-400">AccioCall</h1>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-zinc-500">
              Admin portal
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
              onClick={onBack}
              type="button"
            >
              Back to room
            </button>
            <button
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
              onClick={onLogout}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex items-center gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === "users"
                ? "bg-amber-400 text-zinc-950"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
            onClick={() => setTab("users")}
            type="button"
          >
            Users ({users.length})
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === "rooms"
                ? "bg-amber-400 text-zinc-950"
                : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            }`}
            onClick={() => setTab("rooms")}
            type="button"
          >
            Rooms ({rooms.length})
          </button>
        </div>

        {error && (
          <p className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-400">
            {error}
            <button
              className="shrink-0 rounded-md border border-rose-800 px-3 py-1 text-xs font-bold text-rose-300 transition hover:bg-rose-900/40"
              onClick={() => {
                setIsLoading(true);
                setReloadKey((k) => k + 1);
              }}
              type="button"
            >
              Retry
            </button>
          </p>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_48px_-28px_rgba(0,0,0,0.65)]">
          {isLoading ? (
            <p className="p-6 font-mono text-sm text-zinc-500">Loading…</p>
          ) : tab === "users" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Rooms</th>
                    <th className="px-5 py-3.5">Joined</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-800/70 last:border-0">
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {u.fullName || "—"}
                        {u.id === currentUserId && (
                          <span className="ml-2 font-mono text-[10px] text-zinc-500">(you)</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] ${
                            u.role === "ADMIN"
                              ? "bg-amber-400/10 text-amber-400"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400">{u._count?.rooms ?? 0}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={busyId === u.id || u.id === currentUserId}
                            onClick={() => toggleRole(u)}
                            type="button"
                          >
                            {u.role === "ADMIN" ? "Demote" : "Promote"}
                          </button>
                          <button
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={busyId === u.id || u.id === currentUserId}
                            onClick={() => removeUser(u)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 font-mono text-sm text-zinc-500" colSpan={6}>
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                    <th className="px-5 py-3.5">Room</th>
                    <th className="px-5 py-3.5">Host</th>
                    <th className="px-5 py-3.5">Created</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-zinc-800/70 last:border-0">
                      <td className="px-5 py-3.5 font-mono text-white">{room.roomName}</td>
                      <td className="px-5 py-3.5 text-zinc-400">
                        {room.host?.fullName || room.host?.email || "—"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-zinc-500">
                        {formatDate(room.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <button
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={busyId === room.id}
                            onClick={() => removeRoom(room)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 font-mono text-sm text-zinc-500" colSpan={4}>
                        No rooms created via the API yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default AdminPanel;
