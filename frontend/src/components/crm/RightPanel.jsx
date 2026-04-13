import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User, BookOpen, Lock, Mail, Phone, AlertCircle, UserPlus, LogIn, X } from 'lucide-react';
import api from '../../api/axios';

export default function RightPanel({ selectedContact, loggedInUser }) {
  const [lmsData, setLmsData] = useState(null);
  const [lmsLoading, setLmsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingAuth, setUpdatingAuth] = useState(false);
  
  const [iframeUrl, setIframeUrl] = useState(null);

  useEffect(() => {
    const fetchLmsData = async () => {
      const phoneRaw = selectedContact?.phoneNumber || selectedContact?.phone_number;
      if (!phoneRaw) return;
      
      setLmsLoading(true); setLmsData(null); setIframeUrl(null);
      try {
        const cleanPhone = phoneRaw.replace(/\D/g, '').slice(-9);
        const { data } = await api.get(`/bridge/student/${cleanPhone}`);
        setLmsData(data);
      } catch (error) {
        console.error("LMS Sync Error", error);
      } finally {
        setLmsLoading(false);
      }
    };

    if (selectedContact) fetchLmsData();
  }, [selectedContact]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if(!newPassword) return toast.error("Enter a new password");
    setUpdatingAuth(true);
    const toastId = toast.loading("Updating Password...");
    try {
      await api.post('/bridge/update-password', { user_id: lmsData.student.id, new_password: newPassword });
      toast.success("Password Updated in LMS! ✅", { id: toastId });
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update", { id: toastId });
    } finally {
      setUpdatingAuth(false);
    }
  };

  const handleIframeGhostLogin = async () => {
    if (!lmsData?.student?.id) return;
    const toastId = toast.loading("Loading Student Dashboard...");
    try {
        // 🔥 FIX: Updated Backend route
        const res = await api.post(`/admin/ghost-login/${lmsData.student.id}`);
        setIframeUrl(`${window.location.origin}/student/dashboard?token=${res.data.token}&embedded=true`);
        toast.success("Access Granted!", { id: toastId });
    } catch (error) {
        toast.error("Failed to Ghost Login.", { id: toastId });
    }
  };

  if (iframeUrl) {
      return (
          <div className="w-[320px] lg:w-[400px] h-full flex flex-col bg-slate-900 border-l border-white/10 z-20 transition-all duration-300">
              <div className="p-3 border-b border-white/10 bg-slate-800 flex justify-between items-center shrink-0">
                  <h3 className="text-white text-sm font-bold flex items-center gap-2"><User size={16}/> Student View</h3>
                  <button onClick={() => setIframeUrl(null)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-1.5 rounded-lg transition-colors"><X size={16}/></button>
              </div>
              <iframe src={iframeUrl} className="flex-1 w-full h-full border-none bg-slate-950" title="Student Dashboard" />
          </div>
      );
  }

  return (
    <div className="w-[320px] h-full flex flex-col bg-slate-900 border-l border-white/10 shrink-0 shadow-2xl z-20 transition-all duration-300">
      
      <div className="p-5 border-b border-white/10 bg-slate-800/50 flex justify-between items-center shrink-0">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <User className="text-blue-400"/> Student Profile
        </h3>
        
        {lmsData && lmsData.found && (
          <button onClick={handleIframeGhostLogin} className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs font-bold" title="View Dashboard">
             <LogIn size={14}/> Dashboard
          </button>
        )}
      </div>
      
      {selectedContact ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-slate-900/80">
          {lmsLoading ? (
            <div className="flex flex-col items-center justify-center mt-20 opacity-70">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <span className="text-blue-400 text-sm font-bold animate-pulse tracking-widest uppercase">Syncing LMS...</span>
            </div>
          ) : lmsData && lmsData.found ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg ring-4 ring-slate-900">
                    {lmsData.student.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg leading-tight">{lmsData.student.name}</h4>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-block mt-1 shadow-sm">
                      Registered
                    </span>
                  </div>
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-white/5 relative z-10">
                    <p className="text-xs text-slate-300 flex items-center gap-2"><Phone size={14} className="text-slate-500"/> {lmsData.student.phone || selectedContact.phoneNumber}</p>
                    <p className="text-xs text-slate-300 flex items-center gap-2"><User size={14} className="text-slate-500"/> ID: #{lmsData.student.id} | NIC: {lmsData.student.nic || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 shadow-inner">
                <h5 className="text-slate-400 font-bold text-xs mb-3 uppercase tracking-widest flex items-center gap-2"><Lock size={14} className="text-orange-400"/> Account Security</h5>
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-2">
                  <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Type new password..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
                  <button type="submit" disabled={updatingAuth} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg">Reset Password</button>
                </form>
              </div>

              <div>
                  <h5 className="text-slate-400 font-bold text-xs mb-3 uppercase tracking-widest flex items-center gap-2"><BookOpen size={14} className="text-purple-400"/> Active Enrollments</h5>
                  <div className="space-y-3">
                    {lmsData.student.courses?.map((course, idx) => (
                      <div key={idx} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 shadow-md">
                        <div className="mb-3">
                            <h6 className="text-blue-300 font-bold text-sm leading-tight">{course.course_name}</h6>
                            <p className="text-slate-500 text-[10px] mt-0.5">{course.batch_name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/50">
                            <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Course Fee</span>
                                <span className="text-xs text-white font-bold">Rs. {course.course_price}</span>
                            </div>
                            <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center justify-center">
                                <span className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Plan Type</span>
                                <span className={`text-xs font-bold ${course.plan_type === 1 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                    {course.plan_type === 1 ? 'Full Payment' : 'Monthly'}
                                </span>
                            </div>
                        </div>
                      </div>
                    ))}
                    {(!lmsData.student.courses || lmsData.student.courses.length === 0) && (
                        <div className="text-center p-6 border border-dashed border-slate-700 rounded-xl">
                            <p className="text-slate-500 text-xs">No active enrollments found.</p>
                        </div>
                    )}
                  </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700 shadow-inner">
                  <AlertCircle size={32} className="text-slate-500" />
              </div>
              <h4 className="text-white font-bold text-lg mb-1">Not Registered</h4>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                  WhatsApp Number: {selectedContact.phoneNumber || selectedContact.phone_number} is not in the LMS.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/50 p-6 text-center">
          <p className="text-slate-500 text-sm font-medium">Select a chat to view details.</p>
        </div>
      )}
    </div>
  );
}