import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Welcome from './pages/user/Welcome';
import Register from './pages/user/Register';
import Matches from './pages/user/Matches';
import Login from './pages/user/Login';
import Notifications from './pages/user/Notifications';
import Profile from './pages/user/Profile';
import Dashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import SmsLogs from './pages/admin/SmsLogs';
import SmsOutbox from './pages/admin/SmsOutbox';
import Support from './pages/admin/Support';
import SetPassword from "./pages/auth/SetPassword";
import ForgotPassword from "./pages/auth/ForgotPassword";
import AdminLogin from "./pages/admin/AdminLogin";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile/:phone" element={<Profile />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/sms-logs" element={<SmsLogs />} />
        <Route path="/admin/sms-outbox" element={<SmsOutbox />} />
        <Route path="/admin/support" element={<Support />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin/login" element={<AdminLogin />} />
      </Routes>
    </Router>
  );
}

export default App;