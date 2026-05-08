import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita Taveta", "Tana River",
  "Tharaka Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot"
];

const hashPhone = (phone) => {
  if (!phone) return "";
  const visible = phone.slice(-3);
  return "*".repeat(phone.length - 3) + visible;
};

function Matches() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user) : null;
  });
  const [phone] = useState(() => currentUser?.phone_number || "");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [county, setCounty] = useState("");
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [interestStatus, setInterestStatus] = useState({});
  const [pendingInterests, setPendingInterests] = useState([]);
  const [acceptedInterests, setAcceptedInterests] = useState([]);
  const [responding, setResponding] = useState({});
  const [activeTab, setActiveTab] = useState("search");
  const [sentInterests, setSentInterests] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchPendingInterests = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await api.get(`/interest/pending/${phone}`);
      setPendingInterests(res.data);
    } catch (err) {
      console.error("Failed to fetch pending interests", err);
    }
  }, [phone]);

  const fetchAcceptedInterests = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await api.get(`/interest/accepted/${phone}`);
      setAcceptedInterests(res.data);
    } catch (err) {
      console.error("Failed to fetch accepted interests", err);
    }
  }, [phone]);

  const fetchSentInterests = useCallback(async () => {
    if (!phone) return;
    setDashboardLoading(true);
    try {
      const res = await api.get(`/interest/sent/${phone}`);
      setSentInterests(res.data);
    } catch (err) {
      console.error("Failed to fetch sent interests", err);
    } finally {
      setDashboardLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    fetchPendingInterests();
    fetchAcceptedInterests();
    const interval = setInterval(() => {
      fetchPendingInterests();
      fetchAcceptedInterests();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPendingInterests, fetchAcceptedInterests, currentUser, navigate]);

  const sendSms = async (msg) => {
    return await api.post("/webhook/onfon", {
      sender: phone,
      message: msg,
    }, {
      headers: { "X-Webhook-Token": "jobu" },
    });
  };

  const parseMatches = (text) => {
    const lines = text.split("\n").filter(line =>
      line.includes("aged") && line.includes(",")
    );
    return lines.map(line => {
      const parts = line.split(",");
      const phonePart = parts[1]?.trim();
      const nameParts = parts[0].split(" aged ");
      return {
        name: nameParts[0]?.trim(),
        age: nameParts[1]?.trim(),
        phone: phonePart,
      };
    });
  };

  const handleSearch = async () => {
    if (!ageMin || !ageMax || !county) {
      setMessage("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setMessage("");
    setMatches([]);
    try {
      const msg = `match#${ageMin}-${ageMax}#${county}`;
      const res = await sendSms(msg);
      const text = res.data;
      setMessage(text);
      setMatches(parseMatches(text));
      setSearched(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setMessage("You already have a match request for this county. Click Search Again to reset.");
        setSearched(true);
      } else {
        setMessage("Failed to search. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const res = await sendSms("NEXT");
      const text = res.data;
      setMessage(text);
      setMatches(prev => [...prev, ...parseMatches(text)]);
    } catch (err) {
      setMessage("No more matches available.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAgain = async () => {
    setLoading(true);
    try {
      const userRes = await api.get(`/users/phone/${phone}`);
      const user = userRes.data;
      await api.delete(`/match/reset/${user.id}`);
      setMessage("");
      setSearched(false);
      setMatches([]);
      setAgeMin("");
      setAgeMax("");
      setCounty("");
      setInterestStatus({});
    } catch (err) {
      setMessage("Failed to reset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async (matchPhone) => {
    setLoading(true);
    try {
      const res = await sendSms(matchPhone);
      setInterestStatus(prev => ({ ...prev, [matchPhone]: res.data }));
    } catch (err) {
      if (err.response?.status === 409) {
        setInterestStatus(prev => ({ ...prev, [matchPhone]: "Interest already sent." }));
      } else {
        setInterestStatus(prev => ({ ...prev, [matchPhone]: "Failed to send interest." }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (interestRequestId, response) => {
    setResponding(prev => ({ ...prev, [interestRequestId]: true }));
    try {
      await sendSms(response);
      setPendingInterests(prev => prev.filter(i => i.interest_request_id !== interestRequestId));
      fetchAcceptedInterests();
    } catch (err) {
      console.error("Failed to respond", err);
    } finally {
      setResponding(prev => ({ ...prev, [interestRequestId]: false }));
    }
  };

  const totalSent = sentInterests.length;
  const totalAccepted = sentInterests.filter(i => i.status === "accepted").length;
  const totalDeclined = sentInterests.filter(i => i.status === "declined").length;
  const totalPending = sentInterests.filter(i => i.status === "pending").length;

  const statusStyle = (status) => {
    switch (status) {
      case "accepted": return "text-green-600 bg-green-50";
      case "declined": return "text-red-500 bg-red-50";
      default: return "text-yellow-600 bg-yellow-50";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Penzi</h1>
        <div className="flex gap-2 items-center">
          <span className="text-sm opacity-100">{currentUser?.name}</span>
          <button
            onClick={() => {
              localStorage.removeItem("penzi_user");
              navigate("/login");
            }}
            className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto flex">
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-3 font-semibold text-sm ${
              activeTab === "search"
                ? "border-b-2 border-pink-600 text-pink-600"
                : "text-gray-500 hover:text-pink-600"
            }`}
          >
            Find Matches
          </button>
          <button
            onClick={() => {
              setActiveTab("interests");
              fetchPendingInterests();
            }}
            className={`flex-1 py-3 font-semibold text-sm relative ${
              activeTab === "interests"
                ? "border-b-2 border-pink-600 text-pink-600"
                : "text-gray-500 hover:text-pink-600"
            }`}
          >
            Interests
            {pendingInterests.length > 0 && (
              <span className="absolute top-2 right-8 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {pendingInterests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("notifications");
              fetchAcceptedInterests();
            }}
            className={`flex-1 py-3 font-semibold text-sm relative ${
              activeTab === "notifications"
                ? "border-b-2 border-pink-600 text-pink-600"
                : "text-gray-500 hover:text-pink-600"
            }`}
          >
            Matches
            {acceptedInterests.length > 0 && (
              <span className="absolute top-2 right-8 bg-green-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {acceptedInterests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              fetchSentInterests();
            }}
            className={`flex-1 py-3 font-semibold text-sm ${
              activeTab === "dashboard"
                ? "border-b-2 border-pink-600 text-pink-600"
                : "text-gray-500 hover:text-pink-600"
            }`}
          >
            Dashboard
          </button>
        </div>
      </div>

      <div className="p-8 max-w-2xl mx-auto">

        {/* Search Tab */}
        {activeTab === "search" && (
          <>
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <div className="space-y-4">
                <div className="bg-pink-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Searching as</p>
                  <p className="font-semibold text-pink-600">{currentUser?.name}</p>
                </div>
                <div className="flex gap-4">
                  <input
                    placeholder="Min Age"
                    type="number"
                    inputMode="numeric"
                    min="18"
                    max="99"
                    value={ageMin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setAgeMin(val);
                    }}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <input
                    placeholder="Max Age"
                    type="number"
                    inputMode="numeric"
                    min="18"
                    max="99"
                    value={ageMax}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setAgeMax(val);
                    }}
                    className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>

                {/* County Dropdown */}
                <select
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-700"
                >
                  <option value="">Select County</option>
                  {KENYA_COUNTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition"
                >
                  {loading ? "Searching..." : "Search Matches"}
                </button>
              </div>
            </div>

            {message && matches.length === 0 && (
              <div className="bg-white rounded-xl shadow p-6 mb-4">
                <pre className="text-gray-600 whitespace-pre-wrap font-sans">{message}</pre>
              </div>
            )}

            {matches.length > 0 && (
              <div className="space-y-4 mb-6">
                <p className="text-gray-600 font-semibold">
                  Found {matches.length} match(es):
                </p>
                {matches.map((match, index) => (
                  <div key={index} className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-400">
                    <div className="mb-3">
                      <h3 className="text-lg font-bold text-gray-800">{match.name}</h3>
                      <p className="text-gray-500">Age: {match.age}</p>
                      <p className="text-gray-400 text-sm">Phone: {hashPhone(match.phone)}</p>
                    </div>
                    {interestStatus[match.phone] && (
                      <p className="text-green-600 text-sm mb-3 bg-green-50 p-2 rounded-lg">
                        {interestStatus[match.phone]}
                      </p>
                    )}
                    <button
                      onClick={() => handleInterest(match.phone)}
                      disabled={loading || !!interestStatus[match.phone]}
                      className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 transition text-sm disabled:opacity-50"
                    >
                      {interestStatus[match.phone] ? "Interest Sent" : "Send Interest"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searched && (
              <div className="flex gap-4">
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-pink-600 text-pink-600 py-3 rounded-lg font-bold hover:bg-pink-50 transition"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
                <button
                  onClick={handleSearchAgain}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
                >
                  Search Again
                </button>
              </div>
            )}
          </>
        )}

        {/* Interests Tab */}
        {activeTab === "interests" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">
                People Interested in You ({pendingInterests.length})
              </h2>
              <button
                onClick={fetchPendingInterests}
                className="text-pink-600 text-sm font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>

            {pendingInterests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">No pending interest requests.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingInterests.map((interest) => (
                  <div key={interest.interest_request_id} className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-400">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                      {interest.requester_name}
                    </h3>
                    <p className="text-gray-500">Age: {interest.requester_age}</p>
                    <p className="text-gray-500">County: {interest.requester_county}</p>
                    <p className="text-gray-500">Town: {interest.requester_town}</p>
                    <p className="text-gray-400 text-sm mb-3">
                      Phone: {hashPhone(interest.requester_phone)}
                    </p>
                    <p className="text-pink-600 font-semibold mb-4">
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
          </>
        )}

        {/* Notifications/Matches Tab */}
        {activeTab === "notifications" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">
                Your Matches ({acceptedInterests.length})
              </h2>
              <button
                onClick={fetchAcceptedInterests}
                className="text-pink-600 text-sm font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>

            {acceptedInterests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">No accepted matches yet.</p>
                <p className="text-gray-400 text-sm mt-2">Send interests to potential matches to get started!</p>
                <button
                  onClick={() => setActiveTab("search")}
                  className="mt-4 bg-pink-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-pink-700 text-sm"
                >
                  Find Matches
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedInterests.map((match, index) => (
                  <div key={index} className="bg-white rounded-xl shadow overflow-hidden">
                    {/* Match header */}
                    <div className="bg-pink-600 p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xl font-bold text-white">{match.name}</h3>
                          <p className="text-pink-200 text-sm">Accepted your interest</p>
                        </div>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                          <span className="text-pink-600 text-xl font-bold">
                            {match.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Match details */}
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Age</p>
                          <p className="font-semibold text-gray-700">{match.age} years</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Gender</p>
                          <p className="font-semibold text-gray-700">{match.gender}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">County</p>
                          <p className="font-semibold text-gray-700">{match.county}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">Town</p>
                          <p className="font-semibold text-gray-700">{match.town}</p>
                        </div>
                        {match.profession && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400">Profession</p>
                            <p className="font-semibold text-gray-700">{match.profession}</p>
                          </div>
                        )}
                        {match.education && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400">Education</p>
                            <p className="font-semibold text-gray-700">{match.education}</p>
                          </div>
                        )}
                        {match.religion && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400">Religion</p>
                            <p className="font-semibold text-gray-700">{match.religion}</p>
                          </div>
                        )}
                        {match.ethnicity && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400">Ethnicity</p>
                            <p className="font-semibold text-gray-700">{match.ethnicity}</p>
                          </div>
                        )}
                      </div>

                      {/* Phone number - shown fully since they accepted */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-xs text-green-600 font-semibold mb-1">Phone Number</p>
                        <p className="text-green-800 font-bold text-lg">{match.phone_number}</p>
                        <p className="text-green-600 text-xs mt-1">
                          This person accepted your interest. Feel free to connect!
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/profile/${match.phone_number}`)}
                        className="w-full border-2 border-pink-600 text-pink-600 py-2 rounded-lg font-semibold hover:bg-pink-50 transition text-sm"
                      >
                        View Full Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">Your Activity</h2>
              <button
                onClick={fetchSentInterests}
                className="text-pink-600 text-sm font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-pink-600">{totalSent}</p>
                <p className="text-gray-500 text-sm mt-1">Total Sent</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-green-500">{totalAccepted}</p>
                <p className="text-gray-500 text-sm mt-1">Accepted</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-red-400">{totalDeclined}</p>
                <p className="text-gray-500 text-sm mt-1">Declined</p>
              </div>
              <div className="bg-white rounded-xl shadow p-5 text-center">
                <p className="text-3xl font-bold text-yellow-500">{totalPending}</p>
                <p className="text-gray-500 text-sm mt-1">Awaiting Reply</p>
              </div>
            </div>

            <h3 className="text-md font-bold text-gray-600 mb-3">Interest History</h3>
            {dashboardLoading ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400">Loading...</p>
              </div>
            ) : sentInterests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">You have not sent any interests yet.</p>
                <button
                  onClick={() => setActiveTab("search")}
                  className="mt-4 bg-pink-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-pink-700 transition text-sm"
                >
                  Find Matches
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sentInterests.map((interest, index) => (
                  <div key={index} className="bg-white rounded-xl shadow p-5 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-800">{interest.receiver_name}</h4>
                      <p className="text-gray-500 text-sm">Age: {interest.receiver_age}</p>
                      <p className="text-gray-500 text-sm">County: {interest.receiver_county}</p>
                      <p className="text-gray-400 text-xs">Phone: {hashPhone(interest.receiver_phone)}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusStyle(interest.status)}`}>
                      {interest.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Matches;
