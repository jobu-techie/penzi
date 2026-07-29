import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { KENYA_COUNTIES } from "../../constants/counties";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    phone: "",
    name: "",
    age: "",
    gender: "Male",
    county: "",
    town: "",
    education: "",
    profession: "",
    maritalStatus: "",
    religion: "",
    ethnicity: "",
    description: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const sendSms = async (message) => {
    return await api.post("/webhook/onfon", {
      sender: form.phone,
      message,
    });
  };

  const handleStep1 = async () => {
    if (!form.phone || !form.name || !form.age || !form.county || !form.town) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }
    const age = parseInt(form.age);
    if (isNaN(age) || age < 18) {
      setError("You must be at least 18 years old to register.");
      return;
    }
    if (age > 99) {
      setError("Please enter a valid age.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const msg = `start#${form.name}#${form.age}#${form.gender}#${form.county}#${form.town}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data || "Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!form.education || !form.profession || !form.maritalStatus || !form.religion || !form.ethnicity) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const msg = `details#${form.education}#${form.profession}#${form.maritalStatus}#${form.religion}#${form.ethnicity}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data || "Failed to save details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!form.description) {
      setError("Please write a description.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const msg = `MYSELF ${form.description}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data || "Failed to save description. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    if (!form.password || !form.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/register", {
        phone_number: form.phone,
        password: form.password,
      });
      setStep(5);
    } catch (err) {
      if (err.response?.status === 409) {
        setError("Password already set for this account. Please login instead.");
      } else if (err.response?.status === 404) {
        setError("Account not found. Please complete previous steps first.");
      } else {
        setError("Failed to set password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const EyeButton = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-600 transition"
    >
      {show ? (
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
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-pink-600">Penzi</h1>
          <p className="text-gray-500 mt-1">Create your profile</p>
        </div>

        {/* Progress */}
        <div className="flex justify-between mb-8">
          {["Basic Info", "Details", "About Me", "Password", "Done"].map((label, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > i + 1 ? "bg-pink-600 text-white" :
                step === i + 1 ? "bg-pink-600 text-white" :
                "bg-gray-200 text-gray-500"
              }`}>
                {i + 1}
              </div>
              <span className="text-xs text-gray-500 mt-1">{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-3 rounded-lg">
            {error}
          </p>
        )}

        {/* Step 1 - Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <input
              name="phone"
              placeholder="Phone Number (e.g. 0712345678)"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                setForm({ ...form, phone: val });
              }}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <input name="name" placeholder="Full Name"
              value={form.name} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <div>
              <input
                name="age"
                placeholder="Age (must be 18+)"
                type="number"
                inputMode="numeric"
                min="18"
                max="99"
                value={form.age}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setForm({ ...form, age: val });
                }}
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              {form.age && parseInt(form.age, 10) < 18 && (
                <p className="text-red-500 text-xs mt-1">You must be at least 18 years old to register.</p>
              )}
            </div>
            <select name="gender" value={form.gender} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <select name="county" value={form.county} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-700">
              <option value="">Select County</option>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input name="town" placeholder="Town"
              value={form.town} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <button
              onClick={handleStep1}
              disabled={loading || (form.age !== "" && parseInt(form.age, 10) < 18)}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
              {loading ? "Saving..." : "Next"}
            </button>
          </div>
        )}

        {/* Step 2 - Details */}
        {step === 2 && (
          <div className="space-y-4">
            <input name="education" placeholder="Education Level"
              value={form.education} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="profession" placeholder="Profession"
              value={form.profession} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="maritalStatus" placeholder="Marital Status"
              value={form.maritalStatus} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="religion" placeholder="Religion"
              value={form.religion} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="ethnicity" placeholder="Ethnicity"
              value={form.ethnicity} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <button onClick={handleStep2} disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
              {loading ? "Saving..." : "Next"}
            </button>
          </div>
        )}

        {/* Step 3 - About Me */}
        {step === 3 && (
          <div className="space-y-4">
            <textarea name="description" placeholder="Describe yourself..."
              value={form.description} onChange={handleChange} rows={5}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <button onClick={handleStep3} disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
              {loading ? "Saving..." : "Next"}
            </button>
          </div>
        )}

        {/* Step 4 - Set Password */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm text-center mb-2">
              Almost done! Set a password to secure your account.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <EyeButton show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onKeyDown={(e) => e.key === "Enter" && handleStep4()}
                  className="w-full border rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <EyeButton show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
              </div>
            </div>
            <button onClick={handleStep4} disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
              {loading ? "Setting password..." : "Set Password"}
            </button>
          </div>
        )}

        {/* Step 5 - Done */}
        {step === 5 && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-pink-600">You're all set!</h2>
            <p className="text-gray-500">Your profile and password have been created successfully.</p>
            sessionStorage.setItem("prefill_phone", phone);
            <button
  onClick={() => {
    sessionStorage.setItem("prefill_phone", form.phone);
    navigate("/login");
  }}
  className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition"
>
  Login to Find Matches
</button>
          </div>
        )}

        {step < 5 && (
          <button onClick={() => navigate("/")}
            className="w-full mt-4 text-gray-400 text-sm hover:text-pink-600 transition">
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default Register;
