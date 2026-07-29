import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Notifications() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user).phone_number : "";
  });
  const [interests, setInterests] = useState([]);
  const [acceptedByMe, setAcceptedByMe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});

  useEffect(() => {
    if (!phone) {
      navigate("/login");
      return;
    }
    fetchInterests();
    fetchAcceptedByMe();
  }, []);

  const fetchInterests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/interest/pending/${phone}`);
      setInterests(res.data);
    } catch (err) {
      console.error("Failed to fetch interests", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAcceptedByMe = async () => {
    try {
      const res = await api.get(`/interest/accepted-by-me/${phone}`);
      setAcceptedByMe(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch accepted interests", err);
    }
  };

  const handleRespond = async (interestRequestId, response) => {
    setResponding(prev => ({ ...prev, [interestRequestId]: true }));
    try {
      await api.post("/webhook/onfon", {
        sender: phone,
        message: response,
      });
      setInterests(prev => prev.filter(i => i.interest_request_id !== interestRequestId));
    } catch (err) {
      console.error("Failed to respond", err);
    } finally {
      setResponding(prev => ({ ...prev, [interestRequestId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-pink-700 transition"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Penzi</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/matches")}
            className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
          >
            Find Matches
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("penzi_user");
              navigate("/login");
            }}
            className="border border-white text-white px-4 py-2 rounded-full hover:bg-pink-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-8 max-w-2xl mx-auto">

        {/* ── Section 1: Someone is interested in you ── */}
        <h2 className="text-xl font-bold text-gray-700 mb-6">
          Interest Requests
          {interests.length > 0 && (
            <span className="ml-2 bg-pink-600 text-white text-sm px-2 py-1 rounded-full">
              {interests.length}
            </span>
          )}
        </h2>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : interests.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center mb-8">
            <p className="text-gray-400 text-lg">No pending interest requests.</p>
            <button
              onClick={() => navigate("/matches")}
              className="mt-4 bg-pink-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-pink-700"
            >
              Find Matches
            </button>
          </div>
        ) : (
          <div className="space-y-4 mb-10">
            {interests.map((interest) => (
              <div key={interest.interest_request_id} className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-400">
                <h3 className="text-lg font-bold text-gray-800 mb-1">
                  {interest.requester_name}
                </h3>
                <p className="text-gray-500">Age: {interest.requester_age}</p>
                <p className="text-gray-500">County: {interest.requester_county}</p>
                <p className="text-gray-500">Town: {interest.requester_town}</p>
                <p className="text-gray-500">Phone: {interest.requester_phone}</p>

                <p className="text-pink-600 font-semibold mt-3 mb-4">
                  {interest.requester_name} is interested in you. Do you accept?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleRespond(interest.interest_request_id, "YES")}
                    disabled={responding[interest.interest_request_id]}
                    className="flex-1 bg-pink-600 text-white py-2 rounded-lg font-bold hover:bg-pink-700 transition"
                  >
                    {responding[interest.interest_request_id] ? "Processing..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleRespond(interest.interest_request_id, "NO")}
                    disabled={responding[interest.interest_request_id]}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-300 transition"
                  >
                    {responding[interest.interest_request_id] ? "Processing..." : "Decline"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Section 2: Your interests that were accepted ── */}
        <h2 className="text-xl font-bold text-gray-700 mb-6">
          My Accepted Interests
          {acceptedByMe.length > 0 && (
            <span className="ml-2 bg-green-500 text-white text-sm px-2 py-1 rounded-full">
              {acceptedByMe.length}
            </span>
          )}
        </h2>

        {acceptedByMe.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-400 text-lg">None of your interests have been accepted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {acceptedByMe.map((item) => (
              <div key={item.interest_request_id} className="bg-white rounded-xl shadow p-6 border-l-4 border-green-400">
                {/* Green accepted banner */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-green-100 rounded-full p-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-green-600 font-semibold text-sm">Your interest was accepted!</span>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-1">{item.acceptor_name}</h3>
                <p className="text-gray-500">Age: {item.acceptor_age}</p>
                <p className="text-gray-500">County: {item.acceptor_county}</p>
                <p className="text-gray-500">Town: {item.acceptor_town}</p>
                <p className="text-gray-500">Phone: {item.acceptor_phone}</p>

                <p className="text-green-700 font-semibold mt-3">
                  🎉 {item.acceptor_name} accepted your request! You can now reach out to them.
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default Notifications;