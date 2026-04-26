import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Welcome from './pages/user/Welcome';
import Register from './pages/user/Register';
import Matches from './pages/user/Matches';
import Dashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import SmsLogs from './pages/admin/SmsLogs';

function App() {
  return (
    <Router>
      <Routes>
        {/* User routes */}
        <Route path="/" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/matches" element={<Matches />} />

        {/* Admin routes */}
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/sms-logs" element={<SmsLogs />} />
      </Routes>
    </Router>
  );
}

export default App;