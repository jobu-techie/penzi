import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function SetPassword() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    const saved = sessionStorage.getItem("prefill_phone") || "";
    sessionStorage.removeItem("prefill_phone");
    return saved;
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSetPassword = async () => {
    if (!phone || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", {
        phone_number: phone,
        password: password,
      });
      setSuccess("Password set successfully! You can now login.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Phone number not found. Please register via SMS first.");
      } else if (err.response?.status === 409) {
        setError("Password already set. Please login instead.");
      } else {
        setError("Failed to set password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-pink-600">Penzi</h1>
          <p className="text-gray-500 mt-1">Set your password</p>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-3 rounded-lg">
            {error}
          </p>
        )}
        {success && (
          <p className="text-green-600 text-sm mb-4 text-center bg-green-50 p-3 rounded-lg">
            {success}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="e.g. 0712345678"
              maxLength={10}
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(val);
              }}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <p className="text-xs text-gray-400 mt-1">{phone.length}/10 digits</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <button
            onClick={handleSetPassword}
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60"
          >
            {loading ? "Setting password..." : "Set Password"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/login")}
            className="text-gray-400 text-sm hover:text-pink-600 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default SetPassword;
