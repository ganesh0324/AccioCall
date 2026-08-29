import { useState } from "react";

function ChangePasswordModal({ apiRequest, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_24px_48px_-28px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-amber-400">
            Change password
          </h2>
          <button
            className="text-zinc-500 transition hover:text-white"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="p-6">
            <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-400">
              Password updated successfully.
            </p>
            <button
              className="mt-5 h-11 w-full rounded-lg bg-amber-400 text-sm font-extrabold text-zinc-950 transition hover:bg-amber-300"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        ) : (
          <form className="p-6" onSubmit={handleSubmit}>
            <label className="block text-xs font-semibold text-zinc-400">
              Current password
              <input
                autoFocus
                className="mt-2 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white outline-none focus:border-amber-400"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>

            <label className="mt-4 block text-xs font-semibold text-zinc-400">
              New password
              <input
                className="mt-2 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white outline-none focus:border-amber-400"
                minLength={6}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                required
                type="password"
                value={newPassword}
              />
            </label>

            <label className="mt-4 block text-xs font-semibold text-zinc-400">
              Confirm new password
              <input
                className="mt-2 h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white outline-none focus:border-amber-400"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            {error && (
              <p className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                className="h-11 flex-1 rounded-lg border border-zinc-700 bg-transparent text-sm font-bold text-zinc-300 transition hover:bg-zinc-800"
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-11 flex-1 rounded-lg bg-amber-400 text-sm font-extrabold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ChangePasswordModal;
