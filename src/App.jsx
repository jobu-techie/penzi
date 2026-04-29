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
      </Routes>
    </Router>
  );
}

export default App;