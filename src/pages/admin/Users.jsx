import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get("/users");
        setUsers(res.data.users || res.data);
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
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
        <h2 className="text-xl font-bold text-gray-700 mb-6">👥 All Users</h2>

        {loading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-pink-50 text-pink-700">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Age</th>
                  <th className="p-4">Gender</th>
                  <th className="p-4">County</th>
                  <th className="p-4">Town</th>
                  <th className="p-4">Phone</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="p-4">{user.id}</td>
                    <td className="p-4 font-semibold">{user.name}</td>
                    <td className="p-4">{user.age}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        user.gender === "MALE" || user.gender === "Male"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}>
                        {user.gender}
                      </span>
                    </td>
                    <td className="p-4">{user.county}</td>
                    <td className="p-4">{user.town}</td>
                    <td className="p-4">{user.phone_number}</td>
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

export default Users;