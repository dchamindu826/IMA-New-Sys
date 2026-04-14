import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User, BookOpen, Lock, Phone, AlertCircle, LogIn, X, BadgeCheck, CreditCard, DollarSign, Layers } from 'lucide-react';
import api from '../../../api/axios'; 

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
    const toastId = toast.loading("Accessing Student Account...");
    try {
        const res = await api.post(`/admin/ghost-login/${lmsData.student.id}`);
        const frontendUrl = window.location.origin; 
        const url = `${frontendUrl}/student/dashboard?token=${res.data.token}&embedded=true`; 
        
        setIframeUrl(url);
        toast.success("Access Granted!", { id: toastId });
    } catch (error) {
        console.error("Ghost Login Failed:", error);
        toast.error("Failed to authenticate Ghost Login.", { id: toastId });
    }
  };

  if (iframeUrl) {
      return (
          <div className="w-[320px] lg:w-[450px] h-full flex flex-col bg-slate-900 border-l border-slate-700 z-20 transition-all duration-300 shadow-2xl">
              <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center shrink-0">
                  <div>
                      <h3 className="text-white text-sm font-bold flex items-center gap-2"><User size={16} className="text-blue-400"/> Student Dashboard View</h3>
                      <p className="text-[10px] text-emerald-400 font-mono mt-1">Ghost Access Active</p>
                  </div>
                  <button onClick={() => setIframeUrl(null)} className="bg-slate-700 hover:bg-red-500 text-slate-300 hover:text-white p-2 rounded-xl transition-all shadow-md">
                      <X size={18}/>
                  </button>
              </div>
              <div className="flex-1 w-full bg-slate-950 relative">
                  <iframe src={iframeUrl} className="absolute inset-0 w-full h-full border-none" title="Student Dashboard Ghost View" />
              </div>
          </div>
      );
  }

  return (
      <div className="w-[320px] h-full flex flex-col bg-slate-900 border-l border-slate-700/50 shrink-0 shadow-2xl z-20 transition-all duration-300">
        
        <div className="p-5 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center shrink-0 backdrop-blur-md">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <User className="text-blue-400"/> LMS Profile
          </h3>
          
          {lmsData && lmsData.found && (
            <button onClick={handleIframeGhostLogin} className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1.5 text-xs font-bold group" title="Ghost Login to Dashboard">
              <LogIn size={14} className="group-hover:scale-110 transition-transform"/> Login
            </button>
          )}
        </div>
        
        {selectedContact ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-gradient-to-b from-slate-900 to-slate-950">
            
            {lmsLoading ? (
              <div className="flex flex-col items-center justify-center mt-24 opacity-80">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                <span className="text-blue-400 text-xs font-bold tracking-widest uppercase animate-pulse">Syncing Database...</span>
              </div>
            ) : 
            
            lmsData && lmsData.found ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                  
                  <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-lg border-2 border-slate-700">
                      {lmsData.student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-lg leading-tight flex items-center gap-1.5">
                          {lmsData.student.name} <BadgeCheck size={16} className="text-blue-400"/>
                      </h4>
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-block mt-1 shadow-sm">
                        Registered Student
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5 mt-4 pt-4 border-t border-slate-700/50 relative z-10">
                      <p className="text-xs text-slate-300 flex items-center gap-2.5 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                          <Phone size={14} className="text-blue-400"/> <span className="font-mono tracking-wider">{lmsData.student.phone || selectedContact.phoneNumber}</span>
                      </p>
                      <p className="text-xs text-slate-300 flex items-center gap-2.5 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                          <User size={14} className="text-purple-400"/> <span className="font-mono tracking-wider">ID: #{lmsData.student.id} | NIC: {lmsData.student.nic || 'N/A'}</span>
                      </p>
                  </div>
                </div>

                <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 shadow-inner">
                  <h5 className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest flex items-center gap-1.5">
                      <Lock size={12} className="text-orange-400"/> Account Security
                  </h5>
                  <form onSubmit={handleUpdatePassword} className="flex flex-col gap-2.5">
                    <input 
                      type="text" 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="Type new password..." 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner placeholder:text-slate-600" 
                    />
                    <button type="submit" disabled={updatingAuth} className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg border border-orange-500/20">
                        Reset Password
                    </button>
                  </form>
                </div>

                <div>
                    <h5 className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest flex items-center gap-1.5">
                        <BookOpen size={12} className="text-blue-400"/> Active Enrollments
                    </h5>
                    
                    <div className="space-y-3">
                      {lmsData.student.courses?.map((course, idx) => {
                          
                          // 🔥 Payment Type Logic 🔥
                          let payTypeStr = "Monthly";
                          let typeColor = "text-blue-400 border-blue-500/20 bg-blue-500/10";
                          
                          const pt = String(course.plan_type).toLowerCase();
                          if (pt === '1' || pt === 'full') {
                              payTypeStr = "Full Payment";
                              typeColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
                          } else if (pt === '3' || pt === 'installment' || pt === 'inst') {
                              payTypeStr = "Installment";
                              typeColor = "text-orange-400 border-orange-500/20 bg-orange-500/10";
                          }

                          return (
                            <div key={idx} className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 shadow-md hover:border-blue-500/20 transition-colors relative overflow-hidden">
                              
                              <div className="mb-3 relative z-10">
                                  <p className="text-slate-400 text-[10px] mb-1 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                      <Layers size={12} className="text-slate-500"/> {course.batch_name || 'Enrolled Batch'}
                                  </p>
                                  <h6 className="text-white font-bold text-sm leading-snug pr-2">{course.course_name}</h6>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/50 relative z-10">
                                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                          <DollarSign size={10}/> Course Fee
                                      </span>
                                      <span className="text-sm text-white font-black tracking-wide">
                                          Rs. {course.course_price ? parseFloat(course.course_price).toLocaleString() : '0'}
                                      </span>
                                  </div>
                                  
                                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                                          <CreditCard size={10}/> Plan Type
                                      </span>
                                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${typeColor}`}>
                                          {payTypeStr}
                                      </span>
                                  </div>
                              </div>
                            </div>
                          );
                      })}
                      
                      {(!lmsData.student.courses || lmsData.student.courses.length === 0) && (
                          <div className="text-center p-8 border border-dashed border-slate-700 rounded-2xl bg-slate-800/20">
                              <BookOpen size={24} className="text-slate-600 mx-auto mb-2"/>
                              <p className="text-slate-400 text-xs font-medium">No active enrollments found for this student.</p>
                          </div>
                      )}
                    </div>
                </div>
              </div>
            ) : 
            (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700 shadow-inner relative">
                    <div className="absolute inset-0 border border-slate-600 rounded-full animate-ping opacity-20"></div>
                    <AlertCircle size={40} className="text-slate-500" />
                </div>
                <h4 className="text-white font-bold text-xl mb-2">Unregistered Lead</h4>
                <p className="text-slate-400 text-xs mb-6 leading-relaxed max-w-[250px]">
                    The number <span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{selectedContact?.phoneNumber || selectedContact?.phone_number}</span> is not associated with an active LMS account.
                </p>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold border border-slate-700 px-3 py-1.5 rounded-lg bg-slate-800/30">
                    Potential New Student
                </div>
              </div>
            )}
          </div>
        ) : 
        (
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center">
            <User size={48} className="text-slate-700 mb-4 opacity-50"/>
            <p className="text-slate-500 text-sm font-medium max-w-[200px]">Select a conversation from the left to view student details.</p>
          </div>
        )}
      </div>
  );
}