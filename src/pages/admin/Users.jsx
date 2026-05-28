import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionUser, setActionUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "active"
  const [toast, setToast] = useState(null);
  const [addForm, setAddForm] = useState({
    name: "", age: "", gender: "MALE", county: "", town: "", phone_number: "", password: ""
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === "active" ? "/admin/users/active" : "/admin/users";
      const res = await api.get(endpoint);
      const data = Array.isArray(res.data) ? res.data : [];
      setUsers(data);
      setFiltered(data);
    } catch (err) {
      showToast("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const handleSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setSearch(e.target.value);
    setFiltered(users.filter(u =>
      u.name?.toLowerCase().includes(q) || u.phone_number?.includes(q)
    ));
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await api.post(`/admin/users/${user.id}/toggle`);
      showToast(`User ${res.data.is_active ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch {
      showToast("Failed to update user", "error");
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    try {
      await api.post(`/admin/users/${actionUser.id}/set-password`, { password: newPassword });
      showToast("Password updated successfully");
      setShowPasswordModal(false);
      setNewPassword("");
      setActionUser(null);
    } catch {
      showToast("Failed to update password", "error");
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/users/${actionUser.id}`);
      showToast("User deleted successfully");
      setShowDeleteConfirm(false);
      setActionUser(null);
      setSelectedUser(null);
      fetchUsers();
    } catch {
      showToast("Failed to delete user", "error");
    }
  };

  const handleAddUser = async () => {
    const required = ["name", "age", "gender", "county", "town", "phone_number"];
    for (const f of required) {
      if (!addForm[f]) { showToast(`${f} is required`, "error"); return; }
    }
    try {
      await api.post("/admin/users/add", addForm);
      showToast("User added successfully");
      setShowAddModal(false);
      setAddForm({ name: "", age: "", gender: "MALE", county: "", town: "", phone_number: "", password: "" });
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add user", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-semibold transition-all ${
          toast.type === "error" ? "bg-red-500" : "bg-green-500"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white px-8 py-5 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">👥 Member Management</h1>
          <p className="text-pink-100 text-sm mt-0.5">{filtered.length} members shown</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50 text-sm"
          >
            + Add Member
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="bg-pink-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-pink-800 text-sm"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Left panel - list */}
        <div className={`${selectedUser ? "w-1/2" : "w-full"} p-6 transition-all`}>
          {/* Tabs + Search */}
          <div className="flex gap-2 mb-4">
            {["all", "active"].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedUser(null); }}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-pink-600 text-white shadow"
                    : "bg-white text-gray-500 border hover:border-pink-300"
                }`}
              >
                {tab === "all" ? "All Members" : "Active Members"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={handleSearch}
              className="w-full focus:outline-none text-gray-700 text-sm"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-pink-50 text-pink-700">
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Gender</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No members found</td></tr>
                  ) : filtered.map((user, i) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`cursor-pointer border-t border-gray-50 hover:bg-pink-50 transition ${
                        selectedUser?.id === user.id ? "bg-pink-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="p-3 font-medium text-gray-800">{user.name}</td>
                      <td className="p-3 text-gray-500">{user.phone_number}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.gender === "MALE" || user.gender === "Male"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-pink-100 text-pink-700"
                        }`}>{user.gender}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`text-xs px-2 py-1 rounded-lg font-semibold ${
                              user.is_active
                                ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                                : "bg-green-100 text-green-600 hover:bg-green-200"
                            }`}
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => { setActionUser(user); setShowPasswordModal(true); }}
                            className="text-xs px-2 py-1 rounded-lg font-semibold bg-blue-100 text-blue-600 hover:bg-blue-200"
                          >
                            🔑 Password
                          </button>
                          <button
                            onClick={() => { setActionUser(user); setShowDeleteConfirm(true); }}
                            className="text-xs px-2 py-1 rounded-lg font-semibold bg-red-100 text-red-600 hover:bg-red-200"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel - user detail */}
        {selectedUser && (
          <div className="w-1/2 p-6 border-l border-gray-200 bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">Member Details</h2>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-2xl font-bold">
                {selectedUser.name?.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedUser.name}</h3>
                <p className="text-gray-500 text-sm">{selectedUser.phone_number}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selectedUser.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                }`}>
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: "Age", value: selectedUser.age },
                { label: "Gender", value: selectedUser.gender },
                { label: "County", value: selectedUser.county },
                { label: "Town", value: selectedUser.town },
                { label: "Last Login", value: selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleDateString() : "Never" },
                { label: "Joined", value: selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="font-semibold text-gray-700">{value || "—"}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleToggleActive(selectedUser)}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm ${
                  selectedUser.is_active
                    ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                    : "bg-green-100 text-green-600 hover:bg-green-200"
                }`}
              >
                {selectedUser.is_active ? "⛔ Deactivate Member" : "✅ Activate Member"}
              </button>
              <button
                onClick={() => { setActionUser(selectedUser); setShowPasswordModal(true); }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-blue-100 text-blue-600 hover:bg-blue-200"
              >
                🔑 Set Password
              </button>
              <button
                onClick={() => { setActionUser(selectedUser); setShowDeleteConfirm(true); }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-red-100 text-red-600 hover:bg-red-200"
              >
                🗑️ Delete Member
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-800">Add New Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              {[
                { key: "name", label: "Full Name", type: "text" },
                { key: "age", label: "Age", type: "number" },
                { key: "county", label: "County", type: "text" },
                { key: "town", label: "Town", type: "text" },
                { key: "phone_number", label: "Phone Number", type: "text" },
                { key: "password", label: "Password (optional)", type: "password" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type={type}
                    value={addForm[key]}
                    onChange={e => setAddForm({ ...addForm, [key]: e.target.value })}
                    className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                <select
                  value={addForm.gender}
                  onChange={e => setAddForm({ ...addForm, gender: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border text-gray-500 font-semibold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddUser} className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white font-semibold text-sm hover:bg-pink-700">Add Member</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {showPasswordModal && actionUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-800">Set Password</h3>
              <button onClick={() => { setShowPasswordModal(false); setNewPassword(""); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Setting password for <span className="font-semibold text-gray-700">{actionUser.name}</span></p>
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowPasswordModal(false); setNewPassword(""); }} className="flex-1 py-2.5 rounded-xl border text-gray-500 font-semibold text-sm">Cancel</button>
              <button onClick={handleSetPassword} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700">Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && actionUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-800">Delete Member?</h3>
              <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete <span className="font-semibold text-gray-700">{actionUser.name}</span>? This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl border text-gray-500 font-semibold text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
