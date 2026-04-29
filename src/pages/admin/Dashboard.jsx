import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: 0,
    smsLogs: 0,
    smsOutbox: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersRes = await api.get("/users");
        const logsRes = await api.get("/sms/logs");
        const outboxRes = await api.get("/sms/outbox");
        setStats({
          users: usersRes.data.total || usersRes.data.length,
          smsLogs: logsRes.data.length,
          smsOutbox: outboxRes.data.length,
        });
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold"> Penzi Admin</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back to Home
        </button>
      </div>

      {/* Stats Cards */}
      <div className="p-8">
        <h2 className="text-xl font-bold text-gray-700 mb-6">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div
            onClick={() => navigate("/admin/users")}
            className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-500 cursor-pointer hover:shadow-lg transition hover:border-pink-700"
          >
            <p className="text-gray-500 text-sm">Total Users</p>
            <p className="text-4xl font-bold text-pink-600">{stats.users}</p>
            <p className="text-pink-400 text-sm mt-2">Click to view users →</p>
          </div>
          <div
            onClick={() => navigate("/admin/sms-logs")}
            className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition hover:border-blue-700"
          >
            <p className="text-gray-500 text-sm">SMS Logs</p>
            <p className="text-4xl font-bold text-blue-600">{stats.smsLogs}</p>
            <p className="text-blue-400 text-sm mt-2">Click to view logs →</p>
          </div>
          <div
            onClick={() => navigate("/admin/sms-outbox")}
            className="bg-white rounded-xl shadow p-6 border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition hover:border-green-700"
          >
            <p className="text-gray-500 text-sm">SMS Outbox</p>
            <p className="text-4xl font-bold text-green-600">{stats.smsOutbox}</p>
            <p className="text-green-400 text-sm mt-2">Click to view outbox →</p>
          </div>
        </div>

        {/* Navigation Cards */}
        <h2 className="text-xl font-bold text-gray-700 mb-6">Manage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            onClick={() => navigate("/admin/users")}
            className="bg-white rounded-xl shadow p-6 cursor-pointer hover:shadow-lg transition border hover:border-pink-300"
          >
            <h3 className="text-lg font-bold text-gray-700 mb-2">👥 Users</h3>
            <p className="text-gray-500">View and manage all registered users.</p>
          </div>
          <div
            onClick={() => navigate("/admin/sms-logs")}
            className="bg-white rounded-xl shadow p-6 cursor-pointer hover:shadow-lg transition border hover:border-blue-300"
          >
            <h3 className="text-lg font-bold text-gray-700 mb-2">📨 SMS Logs</h3>
            <p className="text-gray-500">View all incoming and outgoing SMS messages.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;