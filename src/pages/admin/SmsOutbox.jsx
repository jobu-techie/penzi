import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function SmsOutbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOutbox = async () => {
      try {
        const res = await api.get("/sms/outbox");
        setItems(res.data);
      } catch (err) {
        console.error("Failed to fetch outbox", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOutbox();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold"> Penzi Admin</h1>
        <button
          onClick={() => navigate("/admin")}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="p-8">
        <h2 className="text-xl font-bold text-gray-700 mb-6">📤 SMS Outbox</h2>

        {loading ? (
          <p className="text-gray-500">Loading outbox...</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-pink-50 text-pink-700">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Message</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="p-4">{item.id}</td>
                    <td className="p-4">{item.recipient}</td>
                    <td className="p-4 max-w-xs truncate">{item.message}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        item.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : item.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{item.created_at || "-"}</td>
                    <td className="p-4 text-sm text-gray-500">{item.sent_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SmsOutbox;