import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// --- Web Pages ---
import Home from './web/pages/Home';

// --- Student Pages (🔥 මේ Imports ටික අනිවාර්යයි 🔥) ---
import StudentDashboard from './pages/student/StudentDashboard';
import CourseView from "./pages/student/components/CourseView";  

// --- Shared imports ---
import ContentHub from './pages/manager/ContentHub';

// --- Layouts ---
import MainLayout from './layouts/MainLayout';

// --- Auth Pages ---
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// --- Admin Pages (System Admin / Director) ---
import AdminDashboard from './pages/admin/AdminDashboard';
import PaymentHub from './pages/admin/PaymentHub';
import StaffManager from './pages/admin/StaffManager';
import BatchManager from './pages/admin/BatchManager';

// --- Manager Pages (Head Manager / Ass Manager) ---
import ManagerDashboard from './pages/manager/ManagerDashboard'; 
import ManagerTimetable from './pages/manager/ManagerTimetable';
import ManagerStaff from './pages/manager/ManagerStaff';
import ManagerTasks from './pages/manager/ManagerTasks';
import ManagerPayments from './pages/manager/ManagerPayments';
import ManagerCRM from './pages/manager/ManagerCRM';

// --- Coordinators imports ---
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import CoordinatorTasks from './pages/coordinator/CoordinatorTasks';
import StaffCRM from "./pages/coordinator/StaffCRM";

// --- Finance Department ---
import FinanceDashboard from './pages/finance/FinanceDashboard';
import SlipVerification from './pages/finance/SlipVerification';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      setLoggedInUser(JSON.parse(user));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setLoggedInUser(null);
  };

  // Role-based Default Route
  const getDefaultDashboard = (role) => {
      // 🔥 FIX: 'superadmin' කියන Role එකත් මෙතනට ඇතුලත් කරා 🔥
      if(role === 'System Admin' || role === 'superadmin' || role === 'Director') return "/admin/dashboard";
      if(role === 'Manager' || role === 'Ass Manager') return "/manager/dashboard";
      if(role === 'Coordinator' || role === 'Staff') return "/coordinator/dashboard";
      if(role === 'Finance') return "/admin/finance";
      if(role === 'user' || role === 'student') return "/student/dashboard"; 
      return "/login"; // Default
  };

  if (loading) return <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

  return (
    <Router>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: { background: 'rgba(30, 41, 59, 0.8)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '16px' }
        }} 
      />

      <Routes>
        {/* PUBLIC WEBSITE ROUTES  */}
        <Route path="/" element={<Home loggedInUser={loggedInUser} />} />

        {/* AUTH ROUTES */}
        <Route path="/login" element={!loggedInUser ? <Login setLoggedInUser={setLoggedInUser} /> : <Navigate to={getDefaultDashboard(loggedInUser?.role)} replace />} />
        <Route path="/register" element={!loggedInUser ? <Register /> : <Navigate to={getDefaultDashboard(loggedInUser?.role)} replace />} />

        {/* PROTECTED ROUTES (MainLayout එක ඇතුලේ) */}
        <Route element={loggedInUser ? <MainLayout loggedInUser={loggedInUser} handleLogout={handleLogout} /> : <Navigate to="/login" replace />}>

          {/* --- ADMIN ROUTES --- */}
          <Route path="admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/payments" element={<PaymentHub />} />
          <Route path="admin/staff" element={<StaffManager />} />
          <Route path="admin/batches/:businessId" element={<BatchManager />} />
          <Route path="admin/content-hub" element={<ContentHub />} />

          {/* --- MANAGER ROUTES --- */}
          <Route path="manager/dashboard" element={<ManagerDashboard />} />
          <Route path="manager/timetable" element={<ManagerTimetable />} />
          <Route path="manager/tasks" element={<ManagerTasks />} />
          <Route path="manager/staff" element={<ManagerStaff />} />
          <Route path="manager/content-hub" element={<ContentHub />} />
          <Route path="manager/payments" element={<ManagerPayments />} />
          <Route path="manager/crm" element={<ManagerCRM />} />

          {/* --- COORDINATOR ROUTES --- */}
          <Route path="coordinator/dashboard" element={<CoordinatorDashboard />} />
          <Route path="coordinator/my-tasks" element={<CoordinatorTasks />} />
          <Route path="coordinator/content-hub" element={<ContentHub />} />
          <Route path="staff/crm" element={<StaffCRM loggedInUser={loggedInUser} />} />

          {/* --- FINANCE DEPARTMENT --- */}
          <Route path="admin/finance" element={<FinanceDashboard />} />
          <Route path="admin/finance/verify" element={<SlipVerification />} />

        </Route>

        {/* Default Catch-all Route (වැරදි ලින්ක් එකකට ගියොත් Home එකට යවනවා) */}
        <Route path="*" element={<Navigate to="/" replace />} />

        {/* --- STUDENT ROUTES (මේ ටික <Routes> ඇතුළට ගත්තා) --- */}
        <Route path="student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/course/:courseId" element={<CourseView />} />
        
      </Routes> {/* <-- Routes tag එක close වෙන්නේ මෙතනින් */}
    </Router>
  );
}

export default App;