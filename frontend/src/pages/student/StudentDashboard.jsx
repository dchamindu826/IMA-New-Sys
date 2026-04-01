import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { Menu, LogOut, AlertTriangle, Info, Lock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import Sidebar from './components/Sidebar';
import EnrollmentTab from './components/EnrollmentTab';
import PaymentHistory from './components/PaymentHistory';
import MyClassroom from './components/MyClassroom'; 
import StudentOverview from './components/StudentOverview';
import DeliveryHub from './components/DeliveryHub';
import ProfileSettings from './components/ProfileSettings';

const StudentDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate(); 
  
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'home'); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [businesses, setBusinesses] = useState([]);
  const [alerts, setAlerts] = useState([]); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const enrollRes = await axios.get('/student/available-enrollments');
        setBusinesses(enrollRes.data.businesses || []);
        const dashRes = await axios.get('/student/dashboard');
        setAlerts(dashRes.data?.alerts || []);
      } catch (error) {
        console.error('API Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 🚀 FIX: Hard redirect to clear all cached states instantly 🚀
      window.location.href = '/login';
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-red-500 font-bold text-xl tracking-wide animate-pulse">Loading Workspace...</div>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 md:p-8 relative overflow-hidden">
      
      <div className="glass-container w-full max-w-[1600px] h-[98vh] md:h-[92vh] rounded-3xl md:rounded-[2.5rem] flex overflow-hidden relative z-10">
          
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} handleLogout={handleLogout} />

          <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 w-full">
            
            <header className="lg:hidden bg-black/40 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-30">
              <img src="/logo.png" alt="IMA Campus" className="h-8 w-auto" />
              <div className="flex items-center gap-3">
                  <button onClick={handleLogout} className="text-white/70 hover:text-red-500 p-2 bg-white/5 rounded-xl transition-colors"><LogOut size={20}/></button>
                  <button onClick={() => setSidebarOpen(true)} className="text-white p-2 bg-red-600/20 rounded-xl transition-colors"><Menu size={24} /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scroll-smooth w-full custom-scrollbar">
              <div className="w-full h-full max-w-7xl mx-auto">
                
                {activeTab !== 'home' && alerts.length > 0 && (
                    <div className="mb-8 space-y-4">
                        {alerts.map((alert, idx) => (
                            <div key={idx} className={`p-5 rounded-2xl flex items-start gap-4 glass-card border-l-4
                                ${alert.type === 'danger' ? 'border-l-red-500' : alert.type === 'locked' ? 'border-l-red-600' : 'border-l-yellow-400'}`}>
                                <div className={`p-2.5 rounded-xl shrink-0 bg-white/10 ${alert.type === 'danger' ? 'text-red-400' : alert.type === 'locked' ? 'text-red-500' : 'text-yellow-400'}`}>
                                  {alert.type === 'danger' && <AlertTriangle size={20} />}
                                  {alert.type === 'locked' && <Lock size={20} />}
                                  {alert.type === 'warning' && <Info size={20} />}
                                </div>
                                <div>
                                    <h4 className={`font-bold uppercase tracking-widest text-xs mb-1 ${alert.type === 'locked' ? 'text-red-500' : alert.type === 'danger' ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {alert.type === 'locked' ? 'Action Required' : 'Notice'}
                                    </h4>
                                    <p className="text-sm font-medium text-white/80 leading-relaxed">{alert.msg}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="w-full h-full animate-fade-in">
                  {activeTab === 'home' && <StudentOverview />}
                  {activeTab === 'courses' && <EnrollmentTab businesses={businesses} setActiveTab={setActiveTab} />}
                  {activeTab === 'history' && <PaymentHistory />}
                  {activeTab === 'mycourses' && <MyClassroom setActiveTab={setActiveTab} />} 
                  {activeTab === 'delivery' && <DeliveryHub />} 
                  {activeTab === 'profile' && <ProfileSettings />}
                </div>
                
              </div>
            </div>
          </main>
      </div>
    </div>
  );
};

export default StudentDashboard;