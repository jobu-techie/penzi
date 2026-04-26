import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const sendSms = async (message) => {
    return await api.post("/webhook/onfon", {
      sender: form.phone,
      message,
    }, {
      headers: { "X-Webhook-Token": "jobu" },
    });
  };

  const handleStep1 = async () => {
    setLoading(true);
    setError("");
    try {
      const msg = `start#${form.name}#${form.age}#${form.gender}#${form.county}#${form.town}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(2);
    } catch (err) {
      setError("Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    setLoading(true);
    setError("");
    try {
      const msg = `details#${form.education}#${form.profession}#${form.maritalStatus}#${form.religion}#${form.ethnicity}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(3);
    } catch (err) {
      setError("Failed to save details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    setError("");
    try {
      const msg = `MYSELF ${form.description}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setStep(4);
    } catch (err) {
      setError("Failed to save description. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-pink-600">💕 PENZI</h1>
          <p className="text-gray-500 mt-1">Create your profile</p>
        </div>

        {/* Progress */}
        <div className="flex justify-between mb-8">
          {["Basic Info", "Details", "About Me", "Done"].map((label, i) => (
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

        {/* Error/Success messages */}
        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <input name="phone" placeholder="Phone Number (e.g. 254712345678)"
              value={form.phone} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="name" placeholder="Full Name"
              value={form.name} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="age" placeholder="Age" type="number"
              value={form.age} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <select name="gender" value={form.gender} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300">
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input name="county" placeholder="County"
              value={form.county} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <input name="town" placeholder="Town"
              value={form.town} onChange={handleChange}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <button onClick={handleStep1} disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition">
              {loading ? "Saving..." : "Next →"}
            </button>
          </div>
        )}

        {/* Step 2: Details */}
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
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition">
              {loading ? "Saving..." : "Next →"}
            </button>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="space-y-4">
            <textarea name="description" placeholder="Describe yourself..."
              value={form.description} onChange={handleChange} rows={5}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
            <button onClick={handleStep3} disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition">
              {loading ? "Saving..." : "Complete Registration"}
            </button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-pink-600">You're registered!</h2>
            <p className="text-gray-500">{message}</p>
            <button onClick={() => navigate("/matches")}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition">
              Find Matches →
            </button>
          </div>
        )}

        {/* Back to home */}
        {step < 4 && (
          <button onClick={() => navigate("/")}
            className="w-full mt-4 text-gray-400 text-sm hover:text-pink-600 transition">
            ← Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default Register;