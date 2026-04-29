import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!phone) {
      setError("Please enter your phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/users/phone/${phone}`);
      const user = res.data;
      localStorage.setItem("penzi_user", JSON.stringify(user));
      navigate("/matches");
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Phone number not found. Please register first.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-pink-600"> PENZI</h1>
          <p className="text-gray-500 mt-1">Welcome back!</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-3 rounded-lg">
            {error}
          </p>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="e.g. 254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-500 text-sm">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/register")}
              className="text-pink-600 font-semibold hover:underline"
            >
              Register here
            </button>
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 text-sm hover:text-pink-600 transition"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;