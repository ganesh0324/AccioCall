import { useState } from "react";

function ResetPasswordForm({ apiRequest, token, onDone }) {
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
      setError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-5 py-8 text-white">
      <img src="/Print.png" alt="AccioCall logo" className="mb-8 h-20 w-auto object-contain md:h-24" />

      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 text-zinc-950 shadow-2xl">
        {success ? (
          <>
            <h2 className="text-2xl font-bold">Password reset</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Your password has been updated. You can log in with it now.
            </p>
            <button
              className="mt-6 h-12 w-full rounded-lg bg-cyan-600 font-bold text-white transition hover:bg-cyan-500"
              onClick={onDone}
              type="button"
            >
              Go to login
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold">Choose a new password</h2>

            <label className="mt-6 block text-sm font-semibold text-zinc-700">
              New password
              <input
                autoFocus
                className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                minLength={6}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                required
                type="password"
                value={newPassword}
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-zinc-700">
              Confirm new password
              <input
                className="mt-2 h-12 w-full rounded-lg border border-zinc-200 px-4 text-base outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              className="mt-6 h-12 w-full rounded-lg bg-cyan-600 font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Reset password"}
            </button>

            <button
              className="mt-4 w-full text-center text-sm font-semibold text-zinc-500 transition hover:text-zinc-800"
              onClick={onDone}
              type="button"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default ResetPasswordForm;
