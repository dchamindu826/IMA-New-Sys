import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { User, BookOpen, Lock, Phone, LogIn, AlertCircle, CreditCard, X } from 'lucide-react';
import api from '../../../api/axios';

export default function StaffRightPanel({ selectedContact }) {
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
      } catch (error) { console.error(error); } 
      finally { setLmsLoading(false); }
    };
    if (selectedContact) fetchLmsData();
  }, [selectedContact]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if(!newPassword) return toast.error("Enter a new password");
    setUpdatingAuth(true);
    const toastId = toast.loading("Updating...");
    try {
      await api.post('/bridge/update-password', { user_id: lmsData.student.id, new_password: newPassword });
      toast.success("Updated! ✅", { id: toastId });
      setNewPassword('');
    } catch (error) { toast.error("Failed", { id: toastId }); } 
    finally { setUpdatingAuth(false); }
  };

  const handleGhostLogin = async () => {
    if (!lmsData?.student?.id) return;
    const toastId = toast.loading("Loading Dashboard...");
    try {
        const res = await api.post(`/admin/ghost-login/${lmsData.student.id}`);
        // 🔥 FIX: Iframe එක ඇතුලෙම ලෝඩ් වෙනවා. Business ID එකත් යවනවා "Select Institute" එක මඟහරින්න! 🔥
        // Student එකේ පළවෙනි course එකේ business_id එක ගන්නවා. නැත්නම් '1' යවනවා.
        const bizId = lmsData.student.courses?.[0]?.business_id || '1'; 
        
        setIframeUrl(`${window.location.origin}/student/dashboard?token=${res.data.token}&embedded=true&businessId=${bizId}`);
        toast.success("Loaded!", { id: toastId });
    } catch (error) { toast.error("Login Failed.", { id: toastId }); }
  };

  // 🔥 Iframe එක Right Panel එක ඇතුලෙම (වෙනම ටැබ් එකක නෙමෙයි) ලෝඩ් වෙනවා 🔥
  if (iframeUrl) {
      return (
        <div className="w-[300px] lg:w-[320px] h-full flex flex-col bg-[#111827] border-l border-white/10 shrink-0 z-20 transition-all duration-300">
            <div className="p-3 border-b border-white/10 bg-[#1e293b] flex justify-between items-center shrink-0">
                <h3 className="text-white text-[13px] font-bold flex items-center gap-2"><User size={16}/> Dashboard View</h3>
                <button onClick={() => setIframeUrl(null)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-1.5 rounded-lg transition-colors"><X size={14}/></button>
            </div>
            {/* Iframe එක පැනල් එක ඇතුලෙම (Mobile view එකට සමාන පළලකින්) */}
            <div className="flex-1 w-full bg-slate-950 overflow-hidden relative">
                <iframe src={iframeUrl} className="absolute top-0 left-0 w-full h-full border-none" title="Student Dashboard" />
            </div>
        </div>
      );
  }

  if (!selectedContact) {
    return (
      <div className="w-[300px] lg:w-[320px] h-full flex flex-col bg-[#111827] border-l border-white/10 shrink-0 z-20 items-center justify-center text-slate-500">
        <User size={40} className="mb-3 opacity-30"/>
        <p className="text-[11px] font-bold uppercase tracking-widest">Profile Details</p>
      </div>
    );
  }

  return (
    <div className="w-[300px] lg:w-[320px] h-full flex flex-col bg-[#111827] border-l border-white/10 shrink-0 z-20 transition-all duration-300">
      
      <div className="p-4 border-b border-white/10 bg-[#1e293b] flex justify-between items-center shrink-0">
        <h3 className="text-white font-bold text-[14px] flex items-center gap-2">
          <User className="text-blue-400" size={16}/> Student Profile
        </h3>
        {lmsData && lmsData.found && (
          <button onClick={handleGhostLogin} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold shadow-md">
             <LogIn size={12}/> Login
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-transparent overflow-x-hidden">
        {lmsLoading ? (
          <div className="flex flex-col items-center justify-center mt-20 opacity-70">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Syncing LMS...</span>
          </div>
        ) : lmsData && lmsData.found ? (
          <div className="space-y-4 animate-in fade-in pr-1">
            
            <div className="bg-[#1e293b] p-4 rounded-xl border border-white/5 shadow-lg w-full">
              <div className="space-y-2">
                  <h4 className="text-white font-bold text-[13px] leading-tight truncate mb-2">{lmsData.student.name}</h4>
                  <p className="text-[11px] text-slate-300 flex items-center gap-2"><Phone size={12} className="text-slate-500 shrink-0"/> <span className="truncate">{lmsData.student.phone}</span></p>
                  <p className="text-[11px] text-slate-300 flex items-center gap-2"><User size={12} className="text-slate-500 shrink-0"/> <span className="truncate">ID: #{lmsData.student.id} | NIC: {lmsData.student.nic || 'N/A'}</span></p>
              </div>
            </div>

            <div className="bg-[#1e293b] p-4 rounded-xl border border-white/5 shadow-lg w-full">
              <h5 className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest flex items-center gap-1.5"><Lock size={12} className="text-orange-500"/> Security</h5>
              <form onSubmit={handleUpdatePassword} className="flex gap-2">
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password..." className="flex-1 min-w-0 bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white text-[11px] outline-none focus:border-blue-500 transition-colors" />
                <button type="submit" disabled={updatingAuth} className="bg-[#ff5722] hover:bg-[#e64a19] text-white px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 shrink-0">Save</button>
              </form>
            </div>

            <div className="w-full">
                <h5 className="text-slate-400 font-bold text-[10px] mb-3 uppercase tracking-widest flex items-center gap-1.5"><BookOpen size={12} className="text-purple-500"/> Enrollments</h5>
                <div className="space-y-3">
                  {lmsData.student.courses?.map((course, idx) => (
                    <div key={idx} className="bg-[#1e293b] p-3.5 rounded-xl border border-white/5 shadow-lg w-full relative overflow-hidden group">
                      
                      <div className="absolute right-0 top-0 h-full w-1 bg-blue-500 group-hover:bg-emerald-500 transition-colors"></div>
                      
                      <div className="mb-2 pr-2">
                          <h6 className="text-blue-300 font-bold text-[12px] leading-tight line-clamp-2">{course.course_name}</h6>
                          <p className="text-slate-500 text-[9px] mt-1 uppercase tracking-wider truncate">{course.batch_name || 'General Batch'}</p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold">
                              <CreditCard size={12} className="text-emerald-500"/> 
                              Rs. {course.course_price}
                          </div>
                          <div className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-black/40 border ${course.plan_type === 1 ? 'text-emerald-400 border-emerald-500/20' : 'text-blue-400 border-blue-500/20'}`}>
                              {course.plan_type === 1 ? 'Full' : 'Installment'}
                          </div>
                      </div>

                    </div>
                  ))}
                  {(!lmsData.student.courses || lmsData.student.courses.length === 0) && (
                      <div className="text-center p-5 border border-dashed border-slate-700 rounded-xl bg-[#1e293b]">
                          <p className="text-slate-500 text-[10px]">No Enrollments.</p>
                      </div>
                  )}
                </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-80 mt-10">
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700 shadow-inner">
                <AlertCircle size={24} className="text-slate-400" />
            </div>
            <h4 className="text-white font-bold text-[13px] mb-1">Not Registered</h4>
            <p className="text-slate-400 text-[10px] leading-relaxed">
                {selectedContact.phoneNumber || selectedContact.phone_number} is not in LMS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}