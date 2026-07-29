import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api, { API_BASE_URL } from "../../api/axios";

// ── Subscription Modal (inline, lightweight) ──────────────────────────────────
function SubscribePrompt({ phone, onClose }) {
  const [plans, setPlans] = useState([]);
  const [paying, setPaying] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/subscription/plans")
      .then(res => setPlans(res.data.filter(p => p.name !== "free")))
      .catch(() => setMessage("Could not load plans."));
  }, []);

  const handleSubscribe = async (planId) => {
    setPaying(planId);
    setMessage("");
    try {
      await api.post("/subscription/subscribe", { plan_id: planId, phone_number: phone });
      setMessage("✅ M-Pesa prompt sent! Enter your PIN on your phone.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Payment failed. Please try again.");
      setPaying(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Premium Feature 🔒</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upgrade to send interests to more profiles</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">×</button>
        </div>
        <div className="p-5 space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="border-2 border-pink-100 rounded-xl p-4 hover:border-pink-400 transition">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800 capitalize">{plan.name}</p>
                  <p className="text-xs text-gray-400">{plan.description || "Unlimited interests & premium features"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-pink-600">KES {plan.price}</p>
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!paying}
                    className="mt-1 bg-pink-600 text-white text-xs px-4 py-1.5 rounded-full font-bold hover:bg-pink-700 transition disabled:opacity-60"
                  >
                    {paying === plan.id ? "Processing..." : "Pay via M-Pesa"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {message && (
            <p className={`text-sm text-center p-3 rounded-lg ${message.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const { phone } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [senderPhone] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user).phone_number : "";
  });
  const [interestSent, setInterestSent] = useState(false);
  const [interestMessage, setInterestMessage] = useState("");

  // ── NEW: subscription state ──
  const [subscription, setSubscription] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/users/profile/${phone}`);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchSubscription = async () => {
      if (!senderPhone) return;
      try {
        // JWT-scoped (identifies the caller from the Authorization header,
        // not the phone number) — matches the pattern used in Matches.jsx.
        const res = await api.get("/subscription/subscription/status");
        setSubscription(res.data);
      } catch (err) {
        console.error("Failed to fetch subscription", err);
      }
    };

    fetchProfile();
    fetchSubscription();
  }, [phone, senderPhone]);

  const handleInterest = async () => {
    // Gate: free users who've hit their limit must upgrade
    if (subscription?.plan === "free" && subscription?.searches_used >= subscription?.searches_limit) {
      setShowUpgradePrompt(true);
      return;
    }

    try {
      const res = await api.post("/webhook/onfon", {
        sender: senderPhone,
        message: phone,
      });
      setInterestSent(true);
      setInterestMessage(res.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setInterestSent(true);
        setInterestMessage("Interest already sent.");
      } else if (err.response?.status === 429) {
        // Backend-enforced limit
        setShowUpgradePrompt(true);
      }
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-lg">Profile not found.</p>
      <button onClick={() => navigate(-1)} className="text-pink-600 font-semibold hover:underline">Go back</button>
    </div>
  );

  const isPremium = subscription?.plan && subscription.plan !== "free";
  const profilePicUrl = profile.profile_picture
    ? `${API_BASE_URL}${profile.profile_picture}`
    : null;

  const fields = [
    ["County", profile.county],
    ["Town", profile.town],
    ["Phone", profile.phone_number],
    profile.details && ["Education", profile.details.education_level],
    profile.details && ["Profession", profile.details.profession],
    profile.details && ["Marital Status", profile.details.marital_status],
    profile.details && ["Religion", profile.details.religion],
    profile.details && ["Ethnicity", profile.details.ethnicity],
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Upgrade prompt modal */}
      {showUpgradePrompt && (
        <SubscribePrompt
          phone={senderPhone}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}

      {/* Header */}
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Penzi</h1>
        <button
          onClick={() => navigate(-1)}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50 transition"
        >
          ← Back
        </button>
      </div>

      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          {/* Avatar / Profile Picture */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-pink-100 border-4 border-pink-200 flex items-center justify-center mx-auto mb-3">
              {profilePicUrl && !imgError ? (
                <img
                  src={profilePicUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-3xl font-bold text-pink-400">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
            <p className="text-gray-500">{profile.gender} · {profile.age} years old</p>

            {/* Premium badge if viewer is premium */}
            {isPremium && (
              <span className="inline-block mt-1 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">
                ✨ Premium Member
              </span>
            )}
          </div>

          {/* Profile fields */}
          <div className="space-y-3">
            {fields.map(([label, val]) => val ? (
              <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-700">{val}</span>
              </div>
            ) : null)}

            {profile.description && (
              <div className="pt-2">
                <p className="text-gray-500 mb-1">About</p>
                <p className="text-gray-700 italic">"{profile.description}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Interest feedback */}
        {interestMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-green-700 text-center">{interestMessage}</p>
          </div>
        )}

        {/* Send Interest / Upgrade CTA */}
        {senderPhone !== profile.phone_number && (
          <>
            {/* Free user who's hit the limit — show locked state */}
            {!isPremium && subscription?.searches_used >= subscription?.searches_limit && !interestSent ? (
              <button
                onClick={() => setShowUpgradePrompt(true)}
                className="w-full bg-gray-100 border-2 border-dashed border-gray-300 text-gray-500 py-3 rounded-xl font-bold hover:border-pink-400 hover:text-pink-600 transition"
              >
                🔒 Upgrade to Send Interest
              </button>
            ) : (
              <button
                onClick={handleInterest}
                disabled={interestSent}
                className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold hover:bg-pink-700 transition disabled:opacity-50"
              >
                {interestSent ? "✓ Interest Sent" : "Send Interest"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
