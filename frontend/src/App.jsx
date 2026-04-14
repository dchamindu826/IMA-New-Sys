import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// --- Web Pages ---
import Home from './web/pages/Home';

// --- Student Pages ---
import StudentDashboard from './pages/student/StudentDashboard';
import CourseView from "./pages/student/components/CourseView";  

// --- Shared imports ---
import ContentHub from './pages/manager/ContentHub';
// 🔥 NEW: Staff Progress Import Eka 🔥
import StaffProgress from './pages/manager/StaffProgress';

// --- Layouts ---
import MainLayout from './layouts/MainLayout';

// --- Auth Pages ---
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// --- Admin Pages ---
import AdminDashboard from './pages/admin/AdminDashboard';
import PaymentHub from './pages/admin/PaymentHub';
import StaffManager from './pages/admin/StaffManager';
import BatchManager from './pages/admin/BatchManager';
import AdminCrmSetup from './pages/admin/AdminCrmSetup'; 
import StudentManager from './pages/admin/StudentManager';

// --- Manager Pages ---
import ManagerDashboard from './pages/manager/ManagerDashboard'; 
import ManagerTimetable from './pages/manager/ManagerTimetable';
import ManagerStaff from './pages/manager/ManagerStaff';
import ManagerTasks from './pages/manager/ManagerTasks';
import ManagerPayments from './pages/manager/ManagerPayments';

// --- Coordinators Pages ---
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import CoordinatorTasks from './pages/coordinator/CoordinatorTasks';

// --- CRM Pages ---
import StaffCRM from "./pages/crm/StaffCRM";
import ManagerCRM from "./pages/crm/ManagerCRM";

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

  const getDefaultDashboard = (role) => {
      if (!role) return "/"; 
      
      const r = role.toLowerCase().trim();
      if(r === 'system admin' || r === 'superadmin' || r === 'director' || r === 'admin') return "/admin/dashboard";
      if(r === 'manager' || r === 'ass manager') return "/manager/dashboard";
      if(r === 'coordinator' || r === 'staff' || r === 'agent') return "/coordinator/dashboard";
      
      if(r === 'finance') return "/admin/payments"; 
      if(r === 'user' || r === 'student') return "/student/dashboard"; 
      
      return "/"; 
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
        <Route path="/" element={<Home loggedInUser={loggedInUser} />} />
        <Route path="/login" element={!loggedInUser ? <Login setLoggedInUser={setLoggedInUser} /> : <Navigate to={getDefaultDashboard(loggedInUser?.role)} replace />} />
        <Route path="/register" element={!loggedInUser ? <Register /> : <Navigate to={getDefaultDashboard(loggedInUser?.role)} replace />} />

        <Route element={loggedInUser ? <MainLayout loggedInUser={loggedInUser} handleLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          
          <Route path="admin/dashboard" element={<AdminDashboard />} />
          <Route path="admin/payments" element={<PaymentHub />} />
          <Route path="admin/staff" element={<StaffManager />} />
          <Route path="admin/batches/:businessId" element={<BatchManager />} />
          <Route path="admin/content-hub" element={<ContentHub />} />
          <Route path="admin/coordinator-tasks" element={<CoordinatorTasks />} />
          <Route path="admin/student-manager" element={<StudentManager loggedInUser={loggedInUser} />} />
          
          {/* 🔥 NEW: Admin ta Staff Progress eka balanna 🔥 */}
          <Route path="admin/staff-progress" element={<StaffProgress />} />
          
          <Route path="admin/staff-crm" element={<StaffCRM loggedInUser={loggedInUser} />} />
          <Route path="admin/crm-setup" element={<AdminCrmSetup />} />

          <Route path="manager/dashboard" element={<ManagerDashboard />} />
          <Route path="manager/timetable" element={<ManagerTimetable />} />
          <Route path="manager/tasks" element={<ManagerTasks />} />
          <Route path="manager/staff" element={<ManagerStaff />} />
          <Route path="manager/content-hub" element={<ContentHub />} />
          <Route path="manager/payments" element={<ManagerPayments />} />
          <Route path="manager/crm" element={<ManagerCRM loggedInUser={loggedInUser} />} />
          
          {/* 🔥 NEW: Manager ta Staff Progress eka balanna 🔥 */}
          <Route path="manager/staff-progress" element={<StaffProgress />} />

          <Route path="coordinator/dashboard" element={<CoordinatorDashboard />} />
          <Route path="coordinator/my-tasks" element={<CoordinatorTasks />} />
          <Route path="coordinator/content-hub" element={<ContentHub />} />

          {/* Staff CRM Routes */}
          <Route path="staff/crm" element={<StaffCRM loggedInUser={loggedInUser} />} />
          <Route path="coordinator/crm" element={<StaffCRM loggedInUser={loggedInUser} />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/course/:courseId" element={<CourseView />} />
        
      </Routes>
    </Router>
  );
}

export default App;