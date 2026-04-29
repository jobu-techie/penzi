import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Matches() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user).phone_number : "";
  });
  const [userName, setUserName] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user).name : "";
  });
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [county, setCounty] = useState("");
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [interestStatus, setInterestStatus] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);

  // If name is not in localStorage, fetch it from the API
  useEffect(() => {
    if (!phone) return;
    if (userName) return;

    const fetchUserName = async () => {
      try {
        const res = await api.get(`/users/phone/${phone}`);
        setUserName(res.data.name || "");
      } catch (err) {
        console.error("Failed to fetch user name", err);
      }
    };

    fetchUserName();
  }, [phone]);

  // Fetch both pending requests AND accepted interests, combine for badge count
  useEffect(() => {
    if (!phone) return;

    const fetchUnreadCount = async () => {
      try {
        const [pendingRes, acceptedRes] = await Promise.all([
          api.get(`/interest/pending/${phone}`),
          api.get(`/interest/accepted-by-me/${phone}`),
        ]);
        const pendingCount = Array.isArray(pendingRes.data) ? pendingRes.data.length : 0;
        const acceptedCount = Array.isArray(acceptedRes.data) ? acceptedRes.data.length : 0;
        setUnreadCount(pendingCount + acceptedCount);
      } catch (err) {
        console.error("Failed to fetch notification count", err);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [phone]);

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
    if (!phone || !ageMin || !ageMax || !county) {
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
      const usersRes = await api.get(`/users/phone/${phone}`);
      const user = usersRes.data;
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

  const handleDescribe = (matchPhone) => {
    navigate(`/profile/${matchPhone}`);
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Penzi</h1>
          {userName && (
            <p className="text-pink-200 text-sm mt-0.5">
              Welcome back, <span className="text-white font-semibold">{userName}</span> 👋
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">

          {/* Bell icon with combined unread count badge */}
          <button
            onClick={() => {
              setUnreadCount(0);
              navigate("/notifications");
            }}
            className="relative p-2 rounded-full hover:bg-pink-700 transition"
            aria-label="Notifications"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              localStorage.removeItem("penzi_user");
              navigate("/login");
            }}
            className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
          >
            Logout
          </button>
          <button
            onClick={() => navigate("/")}
            className="border border-white text-white px-4 py-2 rounded-full hover:bg-pink-700"
          >
            Home
          </button>
        </div>
      </div>

      <div className="p-8 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-gray-700 mb-6">Find Matches</h2>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="space-y-4">
            <input
              placeholder="Your Phone Number (e.g. 254712345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <div className="flex gap-4">
              <input
                placeholder="Min Age"
                type="number"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              <input
                placeholder="Max Age"
                type="number"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <input
              placeholder="County"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition"
            >
              {loading ? "Searching..." : "Search Matches"}
            </button>
          </div>
        </div>

        {/* Summary message */}
        {message && matches.length === 0 && (
          <div className="bg-white rounded-xl shadow p-6 mb-4">
            <pre className="text-gray-600 whitespace-pre-wrap font-sans">{message}</pre>
          </div>
        )}

        {/* Match Cards */}
        {matches.length > 0 && (
          <div className="space-y-4 mb-6">
            <p className="text-gray-600 font-semibold">
              Found {matches.length} match(es):
            </p>
            {matches.map((match, index) => (
              <div key={index} className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-400">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{match.name}</h3>
                    <p className="text-gray-500">Age: {match.age}</p>
                    <p className="text-gray-500">Phone: {match.phone}</p>
                  </div>
                </div>

                {/* Interest status */}
                {interestStatus[match.phone] && (
                  <p className="text-green-600 text-sm mb-3 bg-green-50 p-2 rounded-lg">
                    {interestStatus[match.phone]}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDescribe(match.phone)}
                    disabled={loading}
                    className="flex-1 border-2 border-pink-600 text-pink-600 py-2 rounded-lg font-semibold hover:bg-pink-50 transition text-sm"
                  >
                    View Description
                  </button>
                  <button
                    onClick={() => handleInterest(match.phone)}
                    disabled={loading || !!interestStatus[match.phone]}
                    className="flex-1 bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 transition text-sm disabled:opacity-50"
                  >
                    {interestStatus[match.phone] ? "Interest Sent" : "Send Interest"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
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
      </div>
    </div>
  );
}

export default Matches;