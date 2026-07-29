import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { API_BASE_URL } from "../../api/axios";
import { KENYA_COUNTIES } from "../../constants/counties";

const hashPhone = (phone) => {
  if (!phone) return "";
  const visible = phone.slice(-3);
  return "*".repeat(phone.length - 3) + visible;
};

// ── STK Push / Payment Modal ─────────────────────────────────────────────────
function SubscribeModal({ onClose, phone, onSuccess }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stkStep, setStkStep] = useState("plans"); // plans | waiting | success | failed
  const [paying, setPaying] = useState(null);
  const [message, setMessage] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api.get("/subscription/plans")
      .then(res => setPlans(res.data))
      .catch(() => setMessage("Could not load plans."))
      .finally(() => setLoading(false));
    return () => clearInterval(pollRef.current);
  }, []);

  const pollPaymentStatus = useCallback((pmtId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 24) { // 2 min max
        clearInterval(pollRef.current);
        setStkStep("failed");
        setMessage("Payment timed out. Please try again.");
        return;
      }
      try {
        const res = await api.get(`/subscription/payment/${pmtId}/status`);
        const status = res.data?.status;
        if (status === "completed") {
          clearInterval(pollRef.current);
          setStkStep("success");
          setTimeout(() => { onSuccess?.(); onClose(); }, 2500);
        } else if (status === "failed" || status === "cancelled") {
          clearInterval(pollRef.current);
          setStkStep("failed");
          setMessage("Payment was not completed. You can try again.");
        }
        // If still "pending", keep polling
      } catch {
        // Network hiccup — keep polling
      }
    }, 5000); // poll every 5s
  }, [onClose, onSuccess]);

  const handleSubscribe = async (plan) => {
    setPaying(plan.id);
    setMessage("");
    try {
      const res = await api.post("/subscription/subscribe", {
        plan_id: plan.id,
        phone_number: phone,
      });
      const data = res.data;
      setCheckoutRequestId(data.checkout_request_id);
      setPaymentId(data.payment_id);
      setStkStep("waiting");
      pollPaymentStatus(data.payment_id);  // poll by payment_id, not checkout_id
    } catch (err) {
      setMessage(err.response?.data?.error || err.response?.data?.message || "Payment initiation failed. Please try again.");
      setPaying(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-5 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold">Upgrade to Premium ✨</h2>
              <p className="text-pink-100 text-xs mt-0.5">Unlimited searches & more</p>
            </div>
            {stkStep !== "waiting" && (
              <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">×</button>
            )}
          </div>
        </div>

        <div className="p-5">
          {/* Step: Choose a plan */}
          {stkStep === "plans" && (
            <>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {plans.filter(p => p.name !== "free").map(plan => (
                    <div key={plan.id} className="border-2 border-gray-100 rounded-xl p-4 hover:border-pink-400 transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800 capitalize">{plan.name.replace("_", " ")}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <p className="font-bold text-pink-600 text-lg">KES {plan.price}</p>
                          <button
                            onClick={() => handleSubscribe(plan)}
                            disabled={paying === plan.id}
                            className="mt-1 bg-pink-600 text-white text-xs px-4 py-2 rounded-full font-bold hover:bg-pink-700 transition disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {paying === plan.id ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Sending...
                              </>
                            ) : "Pay via M-Pesa"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {message && (
                    <p className="text-sm text-center p-3 rounded-lg bg-red-50 text-red-600">{message}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step: Waiting for PIN */}
          {stkStep === "waiting" && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-500 rounded-full animate-spin" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">Check your phone! 📱</p>
                <p className="text-gray-500 text-sm mt-1">An M-Pesa STK push has been sent to</p>
                <p className="font-bold text-pink-600 mt-0.5">{phone}</p>
                <p className="text-gray-500 text-sm mt-3">Enter your M-Pesa PIN to complete payment.</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-green-700 text-xs">⏱ Waiting for confirmation... This may take up to 30 seconds after you enter your PIN.</p>
              </div>
              <button onClick={() => { clearInterval(pollRef.current); setStkStep("plans"); setPaying(null); }} className="text-gray-400 text-sm hover:underline">
                Cancel & go back
              </button>
            </div>
          )}

          {/* Step: Success */}
          {stkStep === "success" && (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-3xl">🎉</div>
              <p className="font-bold text-gray-800 text-lg">Payment Confirmed!</p>
              <p className="text-gray-500 text-sm">Welcome to Premium. Enjoy unlimited searches!</p>
            </div>
          )}

          {/* Step: Failed */}
          {stkStep === "failed" && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center text-3xl">❌</div>
              <div>
                <p className="font-bold text-gray-800">Payment Not Completed</p>
                <p className="text-gray-500 text-sm mt-1">{message}</p>
              </div>
              <button onClick={() => { setStkStep("plans"); setPaying(null); setMessage(""); }} className="bg-pink-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-pink-700 transition text-sm">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Search Limit Banner ───────────────────────────────────────────────────────
function SearchLimitBanner({ subscription, onUpgrade }) {
  if (!subscription || subscription.plan !== "free") return null;
  const { searches_used, searches_limit, coins } = subscription;
  const remaining = searches_limit - searches_used;
  const pct = Math.min((searches_used / searches_limit) * 100, 100);
  const isLow = remaining <= 1;
  const isOut = remaining <= 0;

  return (
    <div className={`rounded-xl p-4 mb-5 border ${isOut ? "bg-red-50 border-red-200" : isLow ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className={`text-sm font-bold ${isOut ? "text-red-600" : isLow ? "text-yellow-700" : "text-blue-700"}`}>
            {isOut ? "🚫 Daily search limit reached" : isLow ? "⚠️ Almost out of searches" : "🔍 Free Plan"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isOut ? "Upgrade to Premium for unlimited searches" : `${remaining} of ${searches_limit} daily searches remaining`}
          </p>
        </div>
        <button onClick={onUpgrade} className="bg-pink-600 text-white text-xs px-3 py-1.5 rounded-full font-bold hover:bg-pink-700 transition whitespace-nowrap ml-3">
          Upgrade ✨
        </button>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${isOut ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
      </div>
      {coins > 0 && (
        <p className="text-xs text-gray-400 mt-2">💰 You have {coins} coins — <button onClick={onUpgrade} className="text-pink-600 underline">use them to upgrade</button></p>
      )}
    </div>
  );
}

// ── Wallet Widget ─────────────────────────────────────────────────────────────
function WalletWidget({ coins, onTopUp }) {
  return (
    <button onClick={onTopUp} className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-yellow-100 transition" title="Coin wallet — click to top up">
      <span>💰</span>
      <span>{coins ?? 0}</span>
    </button>
  );
}

// ── Chat Thread List Item ─────────────────────────────────────────────────────
function ChatThreadItem({ thread, onClick }) {
  const { other_user, last_message, unread_count, interest_status } = thread;
  return (
    <button onClick={onClick} className="w-full bg-white rounded-xl shadow p-4 flex items-center gap-3 hover:shadow-md transition text-left border border-transparent hover:border-pink-200">
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white font-bold text-lg">
          {(other_user.name || "?")[0].toUpperCase()}
        </div>
        {unread_count > 0 && (
          <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unread_count}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className="font-bold text-gray-800 truncate">{other_user.name}</p>
          {last_message && (
            <p className="text-xs text-gray-400 flex-shrink-0 ml-2">
              {new Date(last_message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {last_message ? last_message.content : "No messages yet — say hello! 👋"}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${interest_status === "accepted" ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-700"}`}>
          {interest_status === "accepted" ? "Matched ✓" : "Interest sent"}
        </span>
      </div>
    </button>
  );
}

// ── Chat Window ───────────────────────────────────────────────────────────────
function ChatWindow({ thread, myPhone, onBack, onHasChatted }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/chat/messages/${thread.interest_request_id}/${myPhone}`);
      setMessages(res.data);
      const mySent = res.data.filter(m => m.sender_id !== thread.other_user.id).length;
      if (mySent > 0) onHasChatted?.(thread.interest_request_id);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setLoading(false);
    }
  }, [thread, myPhone, onHasChatted]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000); // poll every 4s
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    const optimistic = {
      id: `opt_${Date.now()}`,
      sender_id: null, // we'll detect by checking "not other_user.id"
      sender_name: "You",
      content,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages(prev => [...prev, { ...optimistic, sender_id: -1 }]);
    setInput("");
    try {
      const res = await api.post("/chat/send", {
        sender_phone: myPhone,
        interest_request_id: thread.interest_request_id,
        content,
      });
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimistic.id),
        res.data,
      ]);
      onHasChatted?.(thread.interest_request_id);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      alert(err.response?.data?.error || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isMe = (msg) => msg.sender_id !== thread.other_user.id;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      {/* Chat header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-pink-600 hover:text-pink-800 font-bold text-lg p-1">
          ← 
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white font-bold">
          {(thread.other_user.name || "?")[0].toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-800">{thread.other_user.name}</p>
          <p className="text-xs text-gray-400">Age {thread.other_user.age} · {thread.other_user.county}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full font-semibold ${thread.interest_status === "accepted" ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-700"}`}>
          {thread.interest_status === "accepted" ? "Matched ✓" : "Pending"}
        </span>
      </div>

      {/* Info banner */}
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-3 text-xs text-pink-700">
        💬 You can chat here while waiting for a response. Send at least one message to unlock the <strong>Accept/Decline</strong> flow.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">👋</p>
            <p className="text-sm">Say hello to {thread.other_user.name}!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${isMe(msg) ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe(msg) ? "bg-pink-600 text-white rounded-br-sm" : "bg-white shadow border border-gray-100 text-gray-800 rounded-bl-sm"}`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe(msg) ? "text-pink-200" : "text-gray-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message..."
          className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          maxLength={1000}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="bg-pink-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-pink-700 transition disabled:opacity-50 flex-shrink-0"
        >
          {sending ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function Matches() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    const user = localStorage.getItem("penzi_user");
    return user ? JSON.parse(user) : null;
  });
  const [phone] = useState(() => currentUser?.phone_number || "");

  // Search state
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [county, setCounty] = useState("");
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [interestStatus, setInterestStatus] = useState({});
  const [expandedMatches, setExpandedMatches] = useState({});

  // Interest state
  const [pendingInterests, setPendingInterests] = useState([]);
  const [acceptedInterests, setAcceptedInterests] = useState([]);
  const [responding, setResponding] = useState({});
  const [respondedInterests, setRespondedInterests] = useState([]);

  // Dashboard state
  const [sentInterests, setSentInterests] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardFilter, setDashboardFilter] = useState(null);

  // Chat state
  const [chatThreads, setChatThreads] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [chattedInterests, setChattedInterests] = useState(new Set()); // Set of interest_request_ids where user has chatted
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState("search");

  // Settings state
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picMessage, setPicMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ text: "", type: "" });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editMessage, setEditMessage] = useState({ text: "", type: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  // Subscription state
  const [subscription, setSubscription] = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchSubscription = useCallback(async () => {
    if (!phone) return;
    try {
      // GET /subscription/subscription/status  (JWT required — axios interceptor handles it)
      const res = await api.get("/subscription/subscription/status");
      const d = res.data;
      // Backend returns: { subscription, is_premium, coin_balance, searches_today, daily_search_limit }
      // Map to the flat shape the UI expects
      const planName = d.subscription?.plan?.name ?? "free";
      setSubscription({
        plan: planName,
        searches_used: d.searches_today ?? 0,
        searches_limit: d.daily_search_limit ?? 10,
        coins: d.coin_balance ?? 0,
        expires_at: d.subscription?.expires_at ?? null,
        is_premium: d.is_premium ?? false,
      });
    } catch (err) {
      console.error("Failed to fetch subscription", err);
    }
  }, [phone]);

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

  const fetchChatThreads = useCallback(async () => {
    if (!phone) return;
    setChatLoading(true);
    try {
      const res = await api.get(`/chat/threads/${phone}`);
      setChatThreads(res.data);
      // Track which interest IDs we've already chatted in
      const chatted = new Set(
        res.data.filter(t => t.last_message && t.last_message.sender_id !== t.other_user.id).map(t => t.interest_request_id)
      );
      setChattedInterests(chatted);
    } catch (err) {
      console.error("Failed to fetch chat threads", err);
    } finally {
      setChatLoading(false);
    }
  }, [phone]);

  const fetchUnreadCount = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await api.get(`/chat/unread-count/${phone}`);
      setUnreadChatCount(res.data.unread_count || 0);
    } catch { }
  }, [phone]);

  const fetchProfile = useCallback(async () => {
    if (!phone) return;
    setProfileLoading(true);
    try {
      const res = await api.get(`/users/phone/${phone}`);
      setProfileData(res.data);
      if (res.data?.profile_picture) {
        setProfilePicturePreview(`${API_BASE_URL}${res.data.profile_picture}`);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setProfileLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!currentUser) { navigate("/login"); return; }
    fetchPendingInterests();
    fetchAcceptedInterests();
    fetchSubscription();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchPendingInterests();
      fetchAcceptedInterests();
      fetchUnreadCount();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPendingInterests, fetchAcceptedInterests, fetchSubscription, fetchUnreadCount, currentUser, navigate]);

  // ── SMS helpers ────────────────────────────────────────────────────────────

  const sendSms = async (msg) =>
    await api.post("/webhook/onfon", { sender: phone, message: msg });

  const parseMatches = (text) => {
    const lines = text.split("\n").filter(line => line.includes("aged") && line.includes(","));
    return lines.map(line => {
      const parts = line.split(",");
      const phonePart = parts[1]?.trim();
      const nameParts = parts[0].split(" aged ");
      return { name: nameParts[0]?.trim(), age: nameParts[1]?.trim(), phone: phonePart };
    });
  };

  const handleSearch = async () => {
    if (!ageMin || !ageMax || !county) { setMessage("Please fill in all fields."); return; }
    const minAge = parseInt(ageMin, 10);
    const maxAge = parseInt(ageMax, 10);
    if (isNaN(minAge) || minAge < 18 || isNaN(maxAge) || maxAge < 18) {
      setMessage("Both ages must be 18 or older.");
      return;
    }
    if (minAge > maxAge) {
      setMessage("Minimum age cannot be greater than maximum age.");
      return;
    }
    if (subscription?.plan === "free" && subscription?.searches_used >= subscription?.searches_limit) {
      setShowSubscribeModal(true);
      return;
    }
    setLoading(true);
    setMessage("");
    setMatches([]);
    setExpandedMatches({});
    try {
      const msg = `match#${ageMin}-${ageMax}#${county}`;
      const res = await sendSms(msg);
      const text = res.data;
      setMessage(text);
      setMatches(parseMatches(text));
      setSearched(true);
      fetchSubscription();
    } catch (err) {
      if (err.response?.status === 409) {
        setMessage("You already have a match request for this county. Click Search Again to reset.");
        setSearched(true);
      } else if (err.response?.status === 429) {
        setShowSubscribeModal(true);
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
    } catch {
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
      setMessage(""); setSearched(false); setMatches([]);
      setAgeMin(""); setAgeMax(""); setCounty("");
      setInterestStatus({}); setExpandedMatches({});
    } catch {
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
      // After sending interest, refresh chat threads so the new thread appears
      setTimeout(fetchChatThreads, 1000);
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

  const handleRespond = async (interest, response) => {
    // Gate: require at least one chat message before accepting/declining
    const hasChat = chattedInterests.has(interest.interest_request_id);
    if (!hasChat) {
      alert("Please chat with this person first before accepting or declining their interest.");
      setActiveTab("chat");
      fetchChatThreads();
      return;
    }

    const interestRequestId = interest.interest_request_id;
    setResponding(prev => ({ ...prev, [interestRequestId]: true }));
    try {
      await sendSms(response);
      setPendingInterests(prev => prev.filter(i => i.interest_request_id !== interestRequestId));
      setRespondedInterests(prev => [...prev, { ...interest, myResponse: response === "YES" ? "accepted" : "declined" }]);
      fetchAcceptedInterests();
    } catch (err) {
      console.error("Failed to respond", err);
    } finally {
      setResponding(prev => ({ ...prev, [interestRequestId]: false }));
    }
  };

  const toggleExpanded = (key) => setExpandedMatches(prev => ({ ...prev, [key]: !prev[key] }));

  // Called from ChatWindow when user has sent a message
  const markHasChatted = useCallback((interestId) => {
    setChattedInterests(prev => new Set([...prev, interestId]));
  }, []);

  // ── Settings handlers ──────────────────────────────────────────────────────

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPicMessage("Please select a valid image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPicMessage("Image must be under 5MB."); return; }
    setProfilePicture(file);
    setProfilePicturePreview(URL.createObjectURL(file));
    setPicMessage("");
  };

  const handlePictureUpload = async () => {
    if (!profilePicture) return;
    setUploadingPic(true);
    setPicMessage("");
    try {
      const formData = new FormData();
      formData.append("profile_picture", profilePicture);
      formData.append("phone", phone);
      const res = await api.post("/users/profile-picture", formData);
      setPicMessage("Profile picture updated successfully!");
      setProfilePicturePreview(`${API_BASE_URL}${res.data.profile_picture}`);
      setProfilePicture(null);
    } catch (err) {
      setPicMessage(err.response?.data?.message || "Failed to upload picture. Please try again.");
    } finally {
      setUploadingPic(false);
    }
  };

  const handlePasswordReset = async () => {
    setPasswordMessage({ text: "", type: "" });
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ text: "Please fill in all password fields.", type: "error" }); return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ text: "New password must be at least 6 characters.", type: "error" }); return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", type: "error" }); return;
    }
    setPasswordLoading(true);
    try {
      await api.post("/users/change-password", { phone, current_password: currentPassword, new_password: newPassword });
      setPasswordMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({ text: err.response?.data?.message || "Failed to change password.", type: "error" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    setSavingProfile(true);
    setEditMessage({ text: "", type: "" });
    try {
      await api.post("/users/update-profile", { phone, ...editForm });
      setEditMessage({ text: "Profile updated successfully!", type: "success" });
      setEditingProfile(false);
      fetchProfile();
    } catch (err) {
      setEditMessage({ text: err.response?.data?.message || "Failed to update profile.", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const totalSent = sentInterests.length;
  const totalAccepted = sentInterests.filter(i => i.status === "accepted").length;
  const totalDeclined = sentInterests.filter(i => i.status === "declined").length;
  const totalPending = sentInterests.filter(i => i.status === "pending").length;
  const filteredSentInterests = dashboardFilter ? sentInterests.filter(i => i.status === dashboardFilter) : sentInterests;
  const isPremium = subscription?.plan && subscription.plan !== "free";

  const statusStyle = (status) => {
    switch (status) {
      case "accepted": return "text-green-600 bg-green-50";
      case "declined": return "text-red-500 bg-red-50";
      default: return "text-yellow-600 bg-yellow-50";
    }
  };

  const statCardClass = (filter) =>
    `bg-white rounded-xl shadow p-5 text-center cursor-pointer transition-all duration-150 ${dashboardFilter === filter ? "ring-2 ring-pink-400 scale-105" : "hover:scale-105"}`;

  const ProfileField = ({ label, value }) => (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="font-semibold text-gray-800">{value || <span className="text-gray-300 italic">Not set</span>}</p>
    </div>
  );

  const EyeIcon = ({ open }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {open
        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.293-3.95M6.938 6.938A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.456 2.888M3 3l18 18" />
      }
    </svg>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {showSubscribeModal && (
        <SubscribeModal
          phone={phone}
          onClose={() => setShowSubscribeModal(false)}
          onSuccess={() => fetchSubscription()}
        />
      )}

      {/* Header */}
      <div className="bg-pink-600 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Penzi</h1>
          {isPremium && (
            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full">✨ Premium</span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm opacity-90">{currentUser?.name}</span>
          <WalletWidget coins={subscription?.coins ?? 0} onTopUp={() => setShowSubscribeModal(true)} />
          {!isPremium && (
            <button onClick={() => setShowSubscribeModal(true)} className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-yellow-300 transition">
              Upgrade 
            </button>
          )}
          <button
            onClick={() => { setActiveTab("settings"); fetchProfile(); }}
            className={`p-2 rounded-full transition ${activeTab === "settings" ? "bg-white text-pink-600" : "hover:bg-pink-500 text-white"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0" />
            </svg>
          </button>
          <button
            onClick={() => { localStorage.removeItem("penzi_user"); localStorage.removeItem("penzi_token"); navigate("/login"); }}
            className="bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto flex overflow-x-auto">
          {[
            { key: "search", label: "Find Matches" },
            { key: "chat", label: "Chat", badge: unreadChatCount, badgeColor: "bg-pink-500" },
            { key: "interests", label: "Interests", badge: pendingInterests.length, badgeColor: "bg-red-500" },
            { key: "notifications", label: "Matches", badge: acceptedInterests.length, badgeColor: "bg-green-500" },
            { key: "dashboard", label: "Dashboard" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setActiveChatThread(null);
                if (tab.key === "interests") fetchPendingInterests();
                if (tab.key === "notifications") fetchAcceptedInterests();
                if (tab.key === "dashboard") fetchSentInterests();
                if (tab.key === "chat") fetchChatThreads();
              }}
              className={`flex-1 py-3 font-semibold text-sm relative whitespace-nowrap px-3 ${activeTab === tab.key ? "border-b-2 border-pink-600 text-pink-600" : "text-gray-500 hover:text-pink-600"}`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className={`absolute top-2 right-2 ${tab.badgeColor} text-white text-xs w-5 h-5 rounded-full flex items-center justify-center`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">

        {/* ── Find Matches Tab ── */}
        {activeTab === "search" && (
          <>
            <SearchLimitBanner subscription={subscription} onUpgrade={() => setShowSubscribeModal(true)} />
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <div className="space-y-4">
                <div className="bg-pink-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Searching as</p>
                  <p className="font-semibold text-pink-600">{currentUser?.name}</p>
                </div>
                <div>
                  <div className="flex gap-4">
                    <input placeholder="Min Age" type="number" inputMode="numeric" min="18" max="99" value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
                    <input placeholder="Max Age" type="number" inputMode="numeric" min="18" max="99" value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300" />
                  </div>
                  {(ageMin && parseInt(ageMin, 10) < 18) || (ageMax && parseInt(ageMax, 10) < 18) ? (
                    <p className="text-red-500 text-xs mt-1">Both ages must be 18 or older.</p>
                  ) : ageMin && ageMax && parseInt(ageMin, 10) > parseInt(ageMax, 10) ? (
                    <p className="text-red-500 text-xs mt-1">Minimum age cannot be greater than maximum age.</p>
                  ) : null}
                </div>
                <select value={county} onChange={(e) => setCounty(e.target.value)}
                  className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300 text-gray-700">
                  <option value="">Select County</option>
                  {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {subscription?.plan === "free" && subscription?.searches_used >= subscription?.searches_limit ? (
                  <button onClick={() => setShowSubscribeModal(true)} className="w-full bg-gray-200 text-gray-500 py-3 rounded-lg font-bold border-2 border-dashed border-gray-300 hover:border-pink-400 hover:text-pink-600 transition">
                    🔒 Upgrade to Search
                  </button>
                ) : (
                  <button
                    onClick={handleSearch}
                    disabled={loading || !ageMin || !ageMax || parseInt(ageMin, 10) < 18 || parseInt(ageMax, 10) < 18 || parseInt(ageMin, 10) > parseInt(ageMax, 10)}
                    className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
                    {loading ? "Searching..." : "Search Matches"}
                  </button>
                )}
              </div>
            </div>

            {message && matches.length === 0 && (
              <div className="bg-white rounded-xl shadow p-6 mb-4">
                <pre className="text-gray-600 whitespace-pre-wrap font-sans">{message}</pre>
              </div>
            )}

            {matches.length > 0 && (
              <div className="space-y-4 mb-6">
                <p className="text-gray-600 font-semibold">Found {matches.length} match(es):</p>
                {matches.map((match, index) => (
                  <div key={index} className="bg-white rounded-xl shadow border-l-4 border-pink-400 overflow-hidden">
                    <div className="flex items-center justify-between p-5">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{match.name}</h3>
                        <p className="text-gray-500 text-sm">Age: {match.age}</p>
                      </div>
                      <button onClick={() => toggleExpanded(index)} className="text-pink-600 text-sm font-semibold border border-pink-300 px-4 py-1.5 rounded-full hover:bg-pink-50 transition whitespace-nowrap">
                        {expandedMatches[index] ? "Hide" : "View details"}
                      </button>
                    </div>
                    {expandedMatches[index] && (
                      <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-3">
                        <p className="text-gray-400 text-sm">Phone: {hashPhone(match.phone)}</p>
                        {interestStatus[match.phone] && (
                          <p className="text-green-600 text-sm bg-green-50 p-2 rounded-lg">{interestStatus[match.phone]}</p>
                        )}
                        {interestStatus[match.phone] && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                            💬 Interest sent! Go to the <strong>Chat</strong> tab to start a conversation before they accept.
                          </div>
                        )}
                        <button
                          onClick={() => handleInterest(match.phone)}
                          disabled={loading || !!interestStatus[match.phone]}
                          className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 transition text-sm disabled:opacity-50"
                        >
                          {interestStatus[match.phone] ? "Interest Sent ✓" : "Send Interest"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searched && (
              <div className="flex gap-4">
                <button onClick={handleNext} disabled={loading} className="flex-1 bg-white border-2 border-pink-600 text-pink-600 py-3 rounded-lg font-bold hover:bg-pink-50 transition">
                  {loading ? "Loading..." : "Load More"}
                </button>
                <button onClick={handleSearchAgain} disabled={loading} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition">
                  Search Again
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Chat Tab ── */}
        {activeTab === "chat" && (
          <>
            {activeChatThread ? (
              <ChatWindow
                thread={activeChatThread}
                myPhone={phone}
                onBack={() => { setActiveChatThread(null); fetchChatThreads(); }}
                onHasChatted={markHasChatted}
              />
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-700">Messages</h2>
                  <button onClick={fetchChatThreads} className="text-pink-600 text-sm font-semibold hover:underline">Refresh</button>
                </div>

                <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4 text-xs text-pink-700">
                  💡 Chat with someone after sending an interest. You must send at least one message before accepting or declining.
                </div>

                {chatLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
                  </div>
                ) : chatThreads.length === 0 ? (
                  <div className="bg-white rounded-xl shadow p-8 text-center">
                    <p className="text-4xl mb-3">💬</p>
                    <p className="text-gray-600 font-semibold">No chats yet</p>
                    <p className="text-gray-400 text-sm mt-1">Send an interest to someone from the Find Matches tab to start chatting.</p>
                    <button onClick={() => setActiveTab("search")} className="mt-4 bg-pink-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-pink-700 text-sm">
                      Find Matches
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatThreads.map(thread => (
                      <ChatThreadItem
                        key={thread.interest_request_id}
                        thread={{ ...thread, interest_status: thread.interest_status }}
                        onClick={() => setActiveChatThread(thread)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Interests Tab ── */}
        {activeTab === "interests" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">People Interested in You</h2>
              <button onClick={fetchPendingInterests} className="text-pink-600 text-sm font-semibold hover:underline">Refresh</button>
            </div>

            {pendingInterests.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  Awaiting your response ({pendingInterests.length})
                </p>

                {/* Chat gate reminder */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
                  💬 <strong>Chat first!</strong> You need to send at least one message before you can accept or decline an interest. Go to the <button onClick={() => { setActiveTab("chat"); fetchChatThreads(); }} className="underline font-bold">Chat tab</button> to start a conversation.
                </div>

                <div className="space-y-4 mb-6">
                  {pendingInterests.map((interest) => {
                    const hasChatted = chattedInterests.has(interest.interest_request_id);
                    return (
                      <div key={interest.interest_request_id} className="bg-white rounded-xl shadow p-6 border-l-4 border-pink-400">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">{interest.requester_name}</h3>
                        <p className="text-gray-500">Age: {interest.requester_age}</p>
                        <p className="text-gray-500">County: {interest.requester_county}</p>
                        <p className="text-gray-500">Town: {interest.requester_town}</p>
                        <p className="text-gray-400 text-sm mb-3">Phone: {hashPhone(interest.requester_phone)}</p>
                        <p className="text-pink-600 font-semibold mb-3">{interest.requester_name} is interested in you.</p>

                        {!hasChatted ? (
                          <button
                            onClick={() => { setActiveTab("chat"); fetchChatThreads(); }}
                            className="w-full bg-blue-50 border-2 border-blue-300 text-blue-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-100 transition flex items-center justify-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Chat first to accept or decline
                          </button>
                        ) : (
                          <div className="flex gap-3">
                            <button onClick={() => handleRespond(interest, "YES")} disabled={responding[interest.interest_request_id]}
                              className="flex-1 bg-pink-600 text-white py-2 rounded-lg font-bold hover:bg-pink-700 transition">
                              {responding[interest.interest_request_id] ? "Processing..." : "Accept ✓"}
                            </button>
                            <button onClick={() => handleRespond(interest, "NO")} disabled={responding[interest.interest_request_id]}
                              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-300 transition">
                              {responding[interest.interest_request_id] ? "Processing..." : "Decline"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {respondedInterests.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Already responded ({respondedInterests.length})</p>
                <div className="space-y-3 mb-6">
                  {respondedInterests.map((interest, index) => (
                    <div key={index} className={`bg-white rounded-xl shadow p-5 border-l-4 ${interest.myResponse === "accepted" ? "border-green-400" : "border-red-300"}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-gray-800">{interest.requester_name}</h3>
                          <p className="text-gray-500 text-sm">Age: {interest.requester_age}</p>
                          <p className="text-gray-400 text-xs">Phone: {hashPhone(interest.requester_phone)}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${interest.myResponse === "accepted" ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>
                          {interest.myResponse === "accepted" ? "Accepted ✓" : "Declined"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {pendingInterests.length === 0 && respondedInterests.length === 0 && (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">No pending interest requests.</p>
              </div>
            )}
          </>
        )}

        {/* ── Matches Tab ── */}
        {activeTab === "notifications" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">Your Matches ({acceptedInterests.length})</h2>
              <button onClick={fetchAcceptedInterests} className="text-pink-600 text-sm font-semibold hover:underline">Refresh</button>
            </div>
            {acceptedInterests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">No accepted matches yet.</p>
                <button onClick={() => setActiveTab("search")} className="mt-4 bg-pink-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-pink-700 text-sm">Find Matches</button>
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedInterests.map((match, index) => (
                  <div key={index} className="bg-white rounded-xl shadow overflow-hidden border-l-4 border-green-400">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-gray-800 font-bold text-base">{match.name}, aged {match.age}</p>
                        <p className="text-green-600 text-xs mt-0.5">Accepted your interest ✓</p>
                      </div>
                      <button onClick={() => toggleExpanded(`acc_${index}`)} className="text-pink-600 text-sm font-semibold border border-pink-300 px-4 py-1.5 rounded-full hover:bg-pink-50 transition whitespace-nowrap ml-3">
                        {expandedMatches[`acc_${index}`] ? "Hide" : "View details"}
                      </button>
                    </div>
                    {expandedMatches[`acc_${index}`] && (
                      <div className="border-t border-gray-100 p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            ["Age", `${match.age} years`],
                            ["Gender", match.gender],
                            ["County", match.county],
                            ["Town", match.town],
                            match.profession && ["Profession", match.profession],
                            match.education && ["Education", match.education],
                            match.religion && ["Religion", match.religion],
                            match.ethnicity && ["Ethnicity", match.ethnicity],
                          ].filter(Boolean).map(([label, val]) => (
                            <div key={label} className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-400">{label}</p>
                              <p className="font-semibold text-gray-700">{val}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-xs text-green-600 font-semibold mb-1">Phone Number</p>
                          <p className="text-green-800 font-bold text-lg">{match.phone_number}</p>
                        </div>
                        <button onClick={() => navigate(`/profile/${match.phone_number}`)} className="w-full border-2 border-pink-600 text-pink-600 py-2 rounded-lg font-semibold hover:bg-pink-50 transition text-sm">
                          View Full Profile
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Dashboard Tab ── */}
        {activeTab === "dashboard" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">Your Activity</h2>
              <button onClick={fetchSentInterests} className="text-pink-600 text-sm font-semibold hover:underline">Refresh</button>
            </div>

            {subscription && (
              <div className={`rounded-xl p-4 mb-5 flex justify-between items-center ${isPremium ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white" : "bg-white shadow border border-gray-100"}`}>
                <div>
                  <p className={`font-bold text-sm ${isPremium ? "text-white" : "text-gray-700"}`}>
                    {isPremium ? "✨ Premium Member" : "Free Plan"}
                  </p>
                  <p className={`text-xs mt-0.5 ${isPremium ? "text-pink-100" : "text-gray-400"}`}>
                    {isPremium
                      ? `Expires: ${subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "Never"}`
                      : `${subscription.searches_used}/${subscription.searches_limit} searches used today`}
                  </p>
                </div>
                {!isPremium && (
                  <button onClick={() => setShowSubscribeModal(true)} className="bg-pink-600 text-white text-xs px-3 py-1.5 rounded-full font-bold hover:bg-pink-700 transition">
                    Upgrade
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-2">
              {[
                { filter: null, count: totalSent, label: "Total Sent", color: "text-pink-600" },
                { filter: "accepted", count: totalAccepted, label: "Accepted", color: "text-green-500" },
                { filter: "declined", count: totalDeclined, label: "Declined", color: "text-red-400" },
                { filter: "pending", count: totalPending, label: "Awaiting Reply", color: "text-yellow-500" },
              ].map(({ filter, count, label, color }) => (
                <div key={String(filter)} onClick={() => setDashboardFilter(dashboardFilter === filter && filter !== null ? null : filter)} className={statCardClass(filter)}>
                  <p className={`text-3xl font-bold ${color}`}>{count}</p>
                  <p className="text-gray-500 text-sm mt-1">{label}</p>
                  {dashboardFilter === filter && <p className={`text-xs mt-1 ${color}`}>Filtered ✓</p>}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center mb-5">
              {dashboardFilter ? "Tap the highlighted card again to clear filter" : "Tap a card to filter the list below"}
            </p>

            <h3 className="text-md font-bold text-gray-600 mb-3">Interest History</h3>
            {dashboardLoading ? (
              <div className="bg-white rounded-xl shadow p-8 text-center"><p className="text-gray-400">Loading...</p></div>
            ) : filteredSentInterests.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">{dashboardFilter ? `No ${dashboardFilter} interests yet.` : "You have not sent any interests yet."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSentInterests.map((interest, index) => (
                  <div key={index} className="bg-white rounded-xl shadow p-5 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-800">{interest.receiver_name}</h4>
                      <p className="text-gray-500 text-sm">Age: {interest.receiver_age} · {interest.receiver_county}</p>
                      <p className="text-gray-400 text-xs">Phone: {hashPhone(interest.receiver_phone)}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusStyle(interest.status)}`}>{interest.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-700">Settings</h2>

            {/* Profile Picture */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">1</span>
                Profile Picture
              </h3>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-pink-100 border-4 border-pink-200 flex items-center justify-center">
                    {profilePicturePreview ? (
                      <img src={profilePicturePreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-pink-400">{(currentUser?.name || "U")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-pink-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md hover:bg-pink-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0" />
                    </svg>
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
                {profilePicture && (
                  <div className="w-full space-y-2">
                    <p className="text-xs text-gray-500 text-center">Selected: {profilePicture.name}</p>
                    <button onClick={handlePictureUpload} disabled={uploadingPic} className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-semibold hover:bg-pink-700 transition text-sm disabled:opacity-60">
                      {uploadingPic ? "Uploading..." : "Save Profile Picture"}
                    </button>
                    <button onClick={() => { setProfilePicture(null); setPicMessage(""); }} className="w-full text-gray-500 text-sm hover:underline">Cancel</button>
                  </div>
                )}
                {picMessage && <p className={`text-sm text-center ${picMessage.includes("success") ? "text-green-600" : "text-red-500"}`}>{picMessage}</p>}
              </div>
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">2</span>
                Subscription & Wallet
              </h3>
              <div className={`rounded-xl p-4 mb-4 ${isPremium ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white" : "bg-gray-50 border border-gray-100"}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className={`font-bold ${isPremium ? "text-white" : "text-gray-800"}`}>{isPremium ? "✨ Premium" : "Free Plan"}</p>
                    <p className={`text-xs mt-0.5 ${isPremium ? "text-pink-100" : "text-gray-400"}`}>
                      {isPremium
                        ? `Active until ${subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "—"}`
                        : `${subscription?.searches_used ?? 0}/${subscription?.searches_limit ?? 3} daily searches used`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${isPremium ? "text-pink-100" : "text-gray-400"}`}>Coins</p>
                    <p className={`text-2xl font-bold ${isPremium ? "text-white" : "text-yellow-500"}`}>💰 {subscription?.coins ?? 0}</p>
                  </div>
                </div>
              </div>
              {!isPremium && (
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 rounded-lg font-bold hover:from-pink-600 hover:to-rose-600 transition shadow-md"
                >
                  Upgrade to Premium ✨ — Pay via M-Pesa
                </button>
              )}
            </div>

            {/* My Profile */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">3</span>
                  My Profile
                </h3>
                <div className="flex gap-3 items-center">
                  <button onClick={fetchProfile} className="text-pink-600 text-sm font-semibold hover:underline">Refresh</button>
                  {!editingProfile && (
                    <button
                      onClick={() => {
                        setEditForm({
                          name: profileData?.name || "",
                          town: profileData?.town || "",
                          county: profileData?.county || "",
                          education: profileData?.education || "",
                          profession: profileData?.profession || "",
                          marital_status: profileData?.marital_status || "",
                          religion: profileData?.religion || "",
                          ethnicity: profileData?.ethnicity || "",
                        });
                        setEditingProfile(true);
                        setEditMessage({ text: "", type: "" });
                      }}
                      className="bg-pink-600 text-white text-sm px-4 py-1.5 rounded-full font-semibold hover:bg-pink-700 transition"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {profileLoading ? (
                <div className="flex justify-center py-6"><div className="w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" /></div>
              ) : profileData ? (
                <>
                  {!editingProfile && (
                    <div className="grid grid-cols-2 gap-3">
                      <ProfileField label="Full Name" value={profileData.name} />
                      <ProfileField label="Phone Number" value={profileData.phone_number} />
                      <ProfileField label="Age" value={profileData.age ? `${profileData.age} years` : null} />
                      <ProfileField label="Gender" value={profileData.gender} />
                      <ProfileField label="County" value={profileData.county} />
                      <ProfileField label="Town" value={profileData.town} />
                      <ProfileField label="Profession" value={profileData.profession} />
                      <ProfileField label="Education" value={profileData.education} />
                      <ProfileField label="Marital Status" value={profileData.marital_status} />
                      <ProfileField label="Religion" value={profileData.religion} />
                      <ProfileField label="Ethnicity" value={profileData.ethnicity} />
                    </div>
                  )}
                  {editingProfile && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                          <p className="font-semibold text-gray-500 text-sm">{profileData.phone_number}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Age</p>
                          <p className="font-semibold text-gray-500 text-sm">{profileData.age} years</p>
                        </div>
                      </div>
                      {[
                        { key: "name", label: "Full Name" },
                        { key: "town", label: "Town" },
                        { key: "profession", label: "Profession" },
                        { key: "education", label: "Education Level" },
                        { key: "marital_status", label: "Marital Status" },
                        { key: "religion", label: "Religion" },
                        { key: "ethnicity", label: "Ethnicity" },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</label>
                          <input value={editForm[key]} onChange={(e) => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm" placeholder={label} />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase tracking-wide">County</label>
                        <select value={editForm.county} onChange={(e) => setEditForm(prev => ({ ...prev, county: e.target.value }))}
                          className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm text-gray-700">
                          <option value="">Select County</option>
                          {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {editMessage.text && (
                        <p className={`text-sm p-3 rounded-lg ${editMessage.type === "success" ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>{editMessage.text}</p>
                      )}
                      <div className="flex gap-3 pt-1">
                        <button onClick={handleProfileUpdate} disabled={savingProfile} className="flex-1 bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
                          {savingProfile ? "Saving..." : "Save Changes"}
                        </button>
                        <button onClick={() => { setEditingProfile(false); setEditMessage({ text: "", type: "" }); }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400">Could not load profile.</p>
                  <button onClick={fetchProfile} className="mt-2 text-pink-600 text-sm font-semibold hover:underline">Try again</button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">4</span>
                Change Password
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Current Password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPw, toggleShow: () => setShowCurrentPw(p => !p) },
                  { label: "New Password", value: newPassword, setter: setNewPassword, show: showNewPw, toggleShow: () => setShowNewPw(p => !p) },
                  { label: "Confirm New Password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPw, toggleShow: () => setShowConfirmPw(p => !p) },
                ].map(({ label, value, setter, show, toggleShow }) => (
                  <div key={label} className="relative">
                    <input type={show ? "text" : "password"} placeholder={label} value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-full border rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm" />
                    <button type="button" onClick={toggleShow} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <EyeIcon open={show} />
                    </button>
                  </div>
                ))}
                {passwordMessage.text && (
                  <p className={`text-sm p-3 rounded-lg ${passwordMessage.type === "success" ? "text-green-600 bg-green-50" : "text-red-500 bg-red-50"}`}>{passwordMessage.text}</p>
                )}
                <button onClick={handlePasswordReset} disabled={passwordLoading} className="w-full bg-pink-600 text-white py-3 rounded-lg font-bold hover:bg-pink-700 transition disabled:opacity-60">
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl shadow p-6 border border-red-100">
              <h3 className="font-bold text-red-500 mb-3">Account</h3>
              <button
                onClick={() => { localStorage.removeItem("penzi_user"); localStorage.removeItem("penzi_token"); navigate("/login"); }}
                className="w-full border-2 border-red-400 text-red-500 py-3 rounded-lg font-bold hover:bg-red-50 transition text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Matches;
