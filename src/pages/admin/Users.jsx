import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 100;

  const fetchUsers = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/users?page=${currentPage}&per_page=${perPage}`);
      const data = res.data.users || res.data;
      setUsers(data);
      setFiltered(data);
      setTotal(res.data.total || data.length);
      setTotalPages(res.data.pages || Math.ceil((res.data.total || data.length) / perPage));
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearch(query);
    if (query === "") {
      setFiltered(users);
    } else {
      const results = users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.phone_number.includes(query)
      );
      setFiltered(results);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Penzi Admin</h1>
        <button
          onClick={() => navigate("/admin")}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-700">
            All Users ({total} total)
          </h2>
          <p className="text-gray-500 text-sm">
            Page {page} of {totalPages}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <input
            type="text"
            placeholder="Search by name or phone number..."
            value={search}
            onChange={handleSearch}
            className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-700"
          />
        </div>

        {loading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow overflow-hidden mb-6">
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        No users found matching "{search}"
                      </td>
                    </tr>
                  ) : (
                    filtered.map((user, index) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-6 py-2 rounded-lg bg-white shadow text-pink-600 font-semibold border border-pink-300 hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <p className="text-gray-600 font-semibold">
                Page {page} of {totalPages}
              </p>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-6 py-2 rounded-lg bg-pink-600 shadow text-white font-semibold hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Users;