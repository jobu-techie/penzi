import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Matches() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user).phone_number : "";
  });
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [county, setCounty] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const sendSms = async (msg) => {
    return await api.post("/webhook/onfon", {
      sender: phone,
      message: msg,
    }, {
      headers: { "X-Webhook-Token": "jobu" },
    });
  };

  const handleSearch = async () => {
    if (!phone || !ageMin || !ageMax || !county) {
      setMessage("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const msg = `match#${ageMin}-${ageMax}#${county}`;
      const res = await sendSms(msg);
      setMessage(res.data);
      setSearched(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setMessage("You already have a match request for this county. Click 'Search Again' to reset.");
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
      setMessage(res.data);
    } catch (err) {
      setMessage("No more matches available.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAgain = async () => {
    setLoading(true);
    try {
      // Get all users with large per_page to find our user
      const usersRes = await api.get("/users?per_page=100");
      const users = usersRes.data.users || usersRes.data;
      const user = users.find(u => u.phone_number === phone);

      if (!user) {
        setMessage("User not found. Make sure your phone number is correct.");
        return;
      }

      await api.delete(`/match/reset/${user.id}`);
      setMessage("");
      setSearched(false);
      setAgeMin("");
      setAgeMax("");
      setCounty("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to reset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold"> PENZI</h1>
        <div className="flex gap-2">
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
        <h2 className="text-xl font-bold text-gray-700 mb-6">🔍 Find Matches</h2>

        {/* Search Form */}
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

        {/* Results */}
        {message && (
          <div className="bg-white rounded-xl shadow p-6 mb-4">
            <h3 className="font-bold text-gray-700 mb-2">Results:</h3>
            <pre className="text-gray-600 whitespace-pre-wrap font-sans">{message}</pre>
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
              {loading ? "Loading..." : "Load More →"}
            </button>
            <button
              onClick={handleSearchAgain}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
            >
              🔄 Search Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Matches;