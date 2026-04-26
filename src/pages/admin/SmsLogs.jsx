import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function SmsLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get("/sms/logs");
        setLogs(res.data);
      } catch (err) {
        console.error("Failed to fetch logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.direction === filter;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">💕 Penzi Admin</h1>
        <button
          onClick={() => navigate("/admin")}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-700">📨 SMS Logs</h2>

          {/* Filter buttons */}
          <div className="flex gap-2">
            {["all", "inbound", "outbound"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition ${
                  filter === f
                    ? "bg-pink-600 text-white"
                    : "bg-white text-gray-600 hover:bg-pink-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading logs...</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-pink-50 text-pink-700">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Direction</th>
                  <th className="p-4">Sender</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Message</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr
                    key={log.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="p-4">{log.id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        log.direction === "inbound"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {log.direction}
                      </span>
                    </td>
                    <td className="p-4">{log.sender}</td>
                    <td className="p-4">{log.recipient}</td>
                    <td className="p-4 max-w-xs truncate">{log.message}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        log.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : log.status === "received"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{log.created_at || "-"}</td>
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

export default SmsLogs;