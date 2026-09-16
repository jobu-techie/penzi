import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

// ── OTP Input — 6 individual boxes ───────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleChange = (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    onChange(next.join(""));
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      const next = [...digits];
      next[i - 1] = "";
      onChange(next.join(""));
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-all duration-200
            ${d ? "border-pink-500 bg-pink-50 text-pink-700" : "border-gray-200 bg-gray-50 text-gray-800"}
            focus:border-pink-500 focus:bg-white focus:shadow-lg focus:shadow-pink-100`}
        />
      ))}
    </div>
  );
}

// ── Resend Timer ──────────────────────────────────────────────────────────────
function ResendTimer({ onResend, resending }) {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    setSeconds(60);
    const iv = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(iv); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onResend]); // reset timer each time resend is triggered

  if (seconds > 0) {
    return (
      <p className="text-sm text-gray-400 text-center">
        Resend code in <span className="font-bold text-pink-500">{seconds}s</span>
      </p>
    );
  }

  return (
    <button
      onClick={onResend}
      disabled={resending}
      className="w-full text-sm text-pink-600 font-semibold hover:underline disabled:opacity-50"
    >
      {resending ? "Sending..." : "Resend code"}
    </button>
  );
}

// ── Main Login Component ──────────────────────────────────────────────────────
function Login() {
  const navigate = useNavigate();

  // Step: "credentials" | "otp"
  const [step, setStep] = useState("credentials");

  // Credentials step
  const [phone, setPhone] = useState(() => {
    const saved = sessionStorage.getItem("prefill_phone") || "";
    sessionStorage.removeItem("prefill_phone");
    return saved;
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP step
  const [otpId, setOtpId] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [devOtp, setDevOtp] = useState(""); // sandbox only

  // ── Step 1: verify credentials → request OTP ─────────────────────────────
  const handleLogin = async () => {
    if (!phone || !password) { setError("Please enter both phone number and password."); return; }
    if (phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/request-otp", {
        phone_number: phone,
        password,
      });
      setOtpId(res.data.otp_id);
      if (res.data._dev_otp) setDevOtp(res.data._dev_otp); // sandbox helper
      setStep("otp");
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Phone number not found. Please register first.");
      } else if (err.response?.status === 401) {
        setError("Incorrect password. Please try again.");
      } else if (err.response?.status === 403) {
        sessionStorage.setItem("prefill_phone", phone);
        navigate("/set-password");
      } else {
        setError(err.response?.data?.error || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP → get JWT ─────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { setOtpError("Please enter the full 6-digit code."); return; }

    setVerifying(true);
    setOtpError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        otp_id: otpId,
        code: otpCode,
      });
      const { token, user } = res.data;
      localStorage.setItem("penzi_token", token);
      localStorage.setItem("penzi_user", JSON.stringify(user));
      navigate("/matches");
    } catch (err) {
      setOtpError(err.response?.data?.error || "Invalid code. Please try again.");
      setOtpCode("");
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true);
    setOtpError("");
    setOtpCode("");
    try {
      const res = await api.post("/auth/resend-otp", { otp_id: otpId });
      setOtpId(res.data.otp_id);
      if (res.data._dev_otp) setDevOtp(res.data._dev_otp);
    } catch (err) {
      setOtpError(err.response?.data?.error || "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : "";

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-8 text-center">
          <h1 className="text-4xl font-black text-white tracking-tight">Penzi</h1>
          <p className="text-pink-100 mt-1 text-sm">
            {step === "credentials" ? "Welcome back!" : "Verify it's you"}
          </p>
        </div>

        <div className="p-8">

          {/* ── STEP 1: Credentials ── */}
          {step === "credentials" && (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-5 text-center">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="e.g. 0712345678"
                    maxLength={10}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-pink-400 transition text-gray-800"
                  />
                  <p className="text-xs text-gray-400 mt-1">{phone.length}/10 digits</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-gray-700">Password</label>
                    <button onClick={() => navigate("/forgot-password")} className="text-xs text-pink-600 hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      className="w-full border-2 border-gray-200 rounded-xl p-3.5 pr-12 focus:outline-none focus:border-pink-400 transition text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3.5 rounded-xl font-bold hover:from-pink-600 hover:to-rose-600 transition shadow-lg shadow-pink-200 disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending code...
                    </span>
                  ) : "Continue →"}
                </button>
              </div>

              <div className="mt-6 text-center space-y-2">
                <p className="text-gray-500 text-sm">
                  Don't have an account?{" "}
                  <button onClick={() => navigate("/register")} className="text-pink-600 font-semibold hover:underline">
                    Register here
                  </button>
                </p>
                <p className="text-gray-500 text-sm">
                  No password yet?{" "}
                  <button
                    onClick={() => { sessionStorage.setItem("prefill_phone", phone); navigate("/set-password"); }}
                    className="text-pink-600 font-semibold hover:underline"
                  >
                    Set password
                  </button>
                </p>
                <button onClick={() => navigate("/")} className="text-gray-400 text-sm hover:text-pink-600 transition">
                  ← Back to Home
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: OTP Verification ── */}
          {step === "otp" && (
            <>
              {/* Phone icon + info */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">📱</span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  We sent a 6-digit code to<br />
                  <span className="font-bold text-gray-800">{maskedPhone}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Valid for 5 minutes</p>
              </div>

              {/* Sandbox dev helper */}
              {devOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center">
                  <p className="text-xs text-amber-700 font-semibold">🧪 Sandbox mode — your OTP:</p>
                  <p className="text-2xl font-black text-amber-600 tracking-widest mt-1">{devOtp}</p>
                  <p className="text-xs text-amber-500 mt-1">Remove in production</p>
                </div>
              )}

              {otpError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4 text-center">
                  {otpError}
                </div>
              )}

              {/* OTP boxes */}
              <div className="mb-6">
                <OtpInput value={otpCode} onChange={setOtpCode} />
              </div>

              {/* Verify button */}
              <button
                onClick={handleVerifyOtp}
                disabled={verifying || otpCode.length !== 6}
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3.5 rounded-xl font-bold hover:from-pink-600 hover:to-rose-600 transition shadow-lg shadow-pink-200 disabled:opacity-60 mb-4"
              >
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : "Verify & Login ✓"}
              </button>

              {/* Resend */}
              <ResendTimer key={otpId} onResend={handleResend} resending={resending} />

              {/* Back */}
              <button
                onClick={() => { setStep("credentials"); setOtpCode(""); setOtpError(""); setDevOtp(""); }}
                className="w-full text-gray-400 text-sm mt-4 hover:text-pink-600 transition"
              >
                ← Use a different number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
