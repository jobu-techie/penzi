import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

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
    fetchProfile();
  }, [phone]);

  const handleInterest = async () => {
    try {
      const res = await api.post("/webhook/onfon", {
        sender: senderPhone,
        message: phone,
      }, {
        headers: { "X-Webhook-Token": "jobu" },
      });
      setInterestSent(true);
      setInterestMessage(res.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setInterestSent(true);
        setInterestMessage("Interest already sent.");
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center text-gray-500">Profile not found.</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Penzi</h1>
        <button
          onClick={() => navigate(-1)}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back
        </button>
      </div>

      <div className="p-8 max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl font-bold text-pink-600">
                {profile.name.charAt(0)}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
            <p className="text-gray-500">{profile.gender} · {profile.age} years old</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">County</span>
              <span className="font-semibold text-gray-700">{profile.county}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Town</span>
              <span className="font-semibold text-gray-700">{profile.town}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Phone</span>
              <span className="font-semibold text-gray-700">{profile.phone_number}</span>
            </div>

            {profile.details && (
              <>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Education</span>
                  <span className="font-semibold text-gray-700">{profile.details.education_level}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Profession</span>
                  <span className="font-semibold text-gray-700">{profile.details.profession}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Marital Status</span>
                  <span className="font-semibold text-gray-700">{profile.details.marital_status}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Religion</span>
                  <span className="font-semibold text-gray-700">{profile.details.religion}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Ethnicity</span>
                  <span className="font-semibold text-gray-700">{profile.details.ethnicity}</span>
                </div>
              </>
            )}

            {profile.description && (
              <div className="pt-2">
                <p className="text-gray-500 mb-1">About</p>
                <p className="text-gray-700 italic">"{profile.description}"</p>
              </div>
            )}
          </div>
        </div>

        {interestMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-green-700 text-center">{interestMessage}</p>
          </div>
        )}

        {senderPhone !== profile.phone_number && (
          <button
            onClick={handleInterest}
            disabled={interestSent}
            className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold hover:bg-pink-700 transition disabled:opacity-50"
          >
            {interestSent ? "Interest Sent" : "Send Interest"}
          </button>
        )}
      </div>
    </div>
  );
}

export default Profile;