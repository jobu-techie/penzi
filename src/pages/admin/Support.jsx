import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

function Support() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selected, setSelected] = useState(null); // { id, name, phone_number }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem("penzi_admin_token")) {
      navigate("/admin/login");
    }
  }, [navigate]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await api.get("/admin/support/threads");
      setThreads(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore transient errors, keep showing last known list
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 10000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  const fetchMessages = useCallback(async (userId) => {
    try {
      const res = await api.get(`/admin/support/messages/${userId}`);
      setMessages(res.data.messages || []);
      fetchThreads(); // refresh unread badges in the list
    } catch {
      // ignore
    }
  }, [fetchThreads]);

  const openThread = (thread) => {
    setSelected({ id: thread.user_id, name: thread.user_name, phone_number: thread.user_phone });
    setMessages([]);
  };

  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id);
    pollRef.current = setInterval(() => fetchMessages(selected.id), 5000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    const content = input.trim();
    if (!content || sending || !selected) return;
    setSending(true);
    setInput("");
    try {
      const res = await api.post("/admin/support/send", { user_id: selected.id, content });
      setMessages((prev) => [...prev, res.data]);
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-pink-600 text-white p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Penzi Admin — Support</h1>
        <button
          onClick={() => navigate("/admin")}
          className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="p-6 flex gap-4 h-[calc(100vh-96px)]">
        {/* Thread list */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl shadow overflow-y-auto">
          {loadingThreads ? (
            <p className="text-gray-400 text-sm p-4">Loading...</p>
          ) : threads.length === 0 ? (
            <p className="text-gray-400 text-sm p-4">No support messages yet.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => openThread(t)}
                className={`w-full text-left p-4 border-b hover:bg-pink-50 transition ${
                  selected?.id === t.user_id ? "bg-pink-50" : ""
                }`}
              >
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-gray-800 truncate">{t.user_name}</p>
                  {t.unread_count > 0 && (
                    <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                      {t.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{t.user_phone}</p>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {t.last_message ? t.last_message.content : "No messages"}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 bg-white rounded-xl shadow flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation to view messages
            </div>
          ) : (
            <>
              <div className="p-4 border-b">
                <p className="font-bold text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-400">{selected.phone_number}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[60%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.sender === "admin" ? "bg-pink-600 text-white" : "bg-white border text-gray-700"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="p-4 border-t flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  placeholder="Type a reply..."
                  className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !input.trim()}
                  className="bg-pink-600 text-white rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Support;
