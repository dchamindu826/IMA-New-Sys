import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, Clock, Lock, UploadCloud, Link as LinkIcon, AlertTriangle, FileText, X, AlertCircle, Building2, Filter } from 'lucide-react';
import api from '../../api/axios'; 

export default function CoordinatorTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const loggedInUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = ['System Admin', 'Director', 'Admin'].includes(loggedInUser?.role);
  
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all'); 
  const [allBatches, setAllBatches] = useState([]); 
  const [filteredBatches, setFilteredBatches] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('all');

  const [submitModal, setSubmitModal] = useState({ isOpen: false, taskId: null, taskName: '', type: 'link', link: '', file: null, contentTitle: '', contentType: 'live' });
  const [unlockModal, setUnlockModal] = useState({ isOpen: false, taskId: null, taskName: '', reason: '' });

  useEffect(() => {
      if (isAdmin) {
          const fetchAdminFilters = async () => {
              try {
                  // 💡 URL එක හරියටම දුන්නා 💡
                  const batchRes = await api.get('/admin/manager/batches-full');
                  const fetchedBatches = batchRes.data || [];
                  setAllBatches(fetchedBatches);
                  
                  const uniqueBusinesses = [];
                  const map = new Map();
                  fetchedBatches.forEach(item => {
                      if (item.business && !map.has(item.business.id)) {
                          map.set(item.business.id, true);
                          uniqueBusinesses.push(item.business);
                      }
                  });
                  setBusinesses(uniqueBusinesses);
                  if (uniqueBusinesses.length > 0) setSelectedBusiness(uniqueBusinesses[0].id.toString());
                  
                  // 💡 URL එක හරියටම දුන්නා (taskRoutes එකට යන්න ඕන නිසා) 💡
                  const staffRes = await api.get('/tasks/manager/staff-list').catch(()=>({data:[]}));
                  const allUsers = staffRes.data || [];
                  setStaffList(allUsers.filter(u => ['Coordinator', 'Staff'].includes(u.role)));
              } catch(e) { console.error("Admin Filters Error:", e); }
          };
          fetchAdminFilters();
      }
  }, [isAdmin]);

  useEffect(() => {
      if (isAdmin && selectedBusiness !== 'all') {
          const bList = allBatches.filter(b => b.business_id.toString() === selectedBusiness);
          setFilteredBatches(bList);
          if (bList.length > 0) setSelectedBatch(bList[0].id.toString());
          else setSelectedBatch('all');
      } else if (isAdmin && selectedBusiness === 'all') {
          setFilteredBatches(allBatches);
          setSelectedBatch('all');
      }
  }, [selectedBusiness, allBatches, isAdmin]);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const endpoint = isAdmin ? `/tasks/my-tasks?staffId=${selectedStaff}&batchId=${selectedBatch}` : '/tasks/my-tasks';
      const res = await api.get(endpoint);
      const sortedTasks = (res.data?.tasks || []).sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date));
      setTasks(sortedTasks);
    } catch (error) { toast.error("Failed to load tasks."); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMyTasks(); }, [selectedStaff, selectedBatch]);

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (submitModal.type === 'link' && !submitModal.link) return toast.error("Please enter a valid link!");
    if (submitModal.type === 'file' && !submitModal.file) return toast.error("Please select a file to upload!");

    const formData = new FormData();
    formData.append('task_id', submitModal.taskId);
    formData.append('contentTitle', submitModal.contentTitle);
    formData.append('contentType', submitModal.contentType);
    
    if (submitModal.type === 'file') formData.append('file', submitModal.file);
    else formData.append('proof', submitModal.link);

    try {
      await api.post('/tasks/complete', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success("Task Submitted & Sent to Content Hub!");
      setSubmitModal({ isOpen: false, taskId: null, taskName: '', type: 'link', link: '', file: null, contentTitle: '', contentType: 'live' });
      fetchMyTasks(); 
    } catch (error) { toast.error("Failed to submit task."); }
  };

  const handleRequestUnlock = async (e) => {
    e.preventDefault();
    if (!unlockModal.reason) return toast.error("Please provide a reason!");
    try {
      await api.post('/tasks/request-unlock', { task_id: unlockModal.taskId, reason: unlockModal.reason });
      toast.success("Unlock request sent!");
      setUnlockModal({ isOpen: false, taskId: null, taskName: '', reason: '' });
      fetchMyTasks();
    } catch (error) { toast.error("Failed to send unlock request."); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

  const pendingCount = tasks.filter(t => !t.is_completed && !t.is_locked).length;
  const lockedCount = tasks.filter(t => t.is_locked).length;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-6">
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3"><CheckCircle2 className="text-blue-400" size={32}/> {isAdmin ? "Staff Tasks View" : "My Daily Tasks"}</h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">Complete assigned tasks & update content hub automatically.</p>
        </div>
        
        <div className="flex gap-4 items-center">
          {isAdmin && (
             <div className="flex gap-2">
                 <div className="bg-slate-800/40 border border-white/10 p-2 rounded-xl flex flex-col shadow-lg">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Building2 size={12}/> Business</label>
                    <select className="bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1" value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)}>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="bg-slate-800/40 border border-white/10 p-2 rounded-xl flex flex-col shadow-lg">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Batch</label>
                    <select className="bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                      <option value="all">All Batches</option>
                      {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="bg-slate-800/40 border border-white/10 p-2 rounded-xl flex flex-col shadow-lg">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Filter size={12}/> Staff</label>
                    <select className="bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                      <option value="all">All Coordinators</option>
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.fName} {s.lName}</option>)}
                    </select>
                 </div>
             </div>
          )}

          <div className="bg-slate-800/60 border border-white/10 px-5 py-2.5 rounded-xl text-center"><span className="block text-2xl font-black text-orange-400">{pendingCount}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span></div>
          <div className="bg-red-950/30 border border-red-500/20 px-5 py-2.5 rounded-xl text-center"><span className="block text-2xl font-black text-red-500">{lockedCount}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Locked</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tasks.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-slate-800/40 rounded-2xl border border-white/5"><CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500/50" /><h3 className="text-xl font-bold text-slate-300">No tasks found.</h3></div>
        ) : (
          tasks.map(task => {
            const isLocked = task.is_locked;
            const isWaiting = task.manager_status === 'WAITING_APPROVAL';
            const isApproved = task.manager_status === 'APPROVED';
            const isRejected = task.manager_status === 'REJECTED';
            const deadlineDate = new Date(task.deadline_date);
            const isOverdue = new Date() > deadlineDate && !task.is_completed;

            let subTasksArray = [];
            try { subTasksArray = JSON.parse(task.description); } catch(e) { subTasksArray = null; }

            return (
              <div key={task.id} className={`p-6 rounded-2xl border relative flex flex-col transition-all ${isLocked ? 'bg-red-950/20 border-red-900/50' : isApproved ? 'bg-emerald-950/20 border-emerald-900/50' : isWaiting ? 'bg-orange-950/20 border-orange-900/50' : isRejected ? 'bg-rose-950/20 border-rose-500/50' : 'bg-slate-800/50 border-white/10 hover:border-blue-500/50'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-md bg-black/40 border border-white/5 shadow-sm text-white">{task.task_type}</span>
                  {isLocked && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-1 rounded"><Lock size={12}/> Locked</span>}
                  {isWaiting && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-1 rounded"><Clock size={12}/> Under Review</span>}
                  {isApproved && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"><CheckCircle2 size={12}/> Published</span>}
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-tight">{Array.isArray(subTasksArray) ? 'Multi-step Task' : task.description}</h3>
                
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 bg-slate-950/40 w-max px-3 py-1.5 rounded-lg border border-white/5">
                  <Clock size={14} className={isOverdue && !isApproved && !isWaiting ? 'text-red-500' : 'text-blue-400'}/> 
                  <span className={isOverdue && !isApproved && !isWaiting ? 'text-red-400' : ''}>Deadline: {task.end_time || deadlineDate.toLocaleTimeString()}</span>
                </div>

                {isRejected && (
                  <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <p className="text-[10px] uppercase font-bold text-rose-400 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Manager Rejected</p>
                    <p className="text-xs text-rose-200">{task.reject_reason}</p>
                  </div>
                )}

                <div className="mt-auto">
                  {isLocked ? (
                    <button onClick={() => setUnlockModal({ isOpen: true, taskId: task.id, taskName: task.task_type, reason: '' })} className="w-full bg-red-500/10 text-red-400 font-bold text-sm py-2.5 rounded-xl border border-red-500/30" disabled={task.unlock_status === 'REQUESTED'}>
                      {task.unlock_status === 'REQUESTED' ? 'Unlock Requested...' : 'Request Unlock'}
                    </button>
                  ) : isApproved || isWaiting ? (
                    <div className="w-full bg-black/20 text-slate-500 font-bold text-sm py-2.5 rounded-xl border border-white/5 text-center">Action Completed</div>
                  ) : (
                    <button onClick={() => {
                        let defaultType = 'live';
                        if(task.task_type.toLowerCase().includes('pdf')) defaultType = 'document';
                        if(task.task_type.toLowerCase().includes('recording')) defaultType = 'recording';
                        setSubmitModal({ isOpen: true, taskId: task.id, taskName: task.task_type, type: defaultType === 'document' ? 'file' : 'link', link: '', file: null, contentTitle: task.description, contentType: defaultType });
                    }} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm py-2.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.2)] hover:scale-[1.02] flex items-center justify-center gap-2">
                      <UploadCloud size={18}/> {isRejected ? 'Resubmit Proof' : 'Submit Task'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SUBMIT MODAL (WITH CONTENT HUB INPUTS) */}
      {submitModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h3 className="text-white text-lg font-bold flex items-center gap-2"><UploadCloud className="text-blue-400" size={20}/> Submit & Update Hub</h3>
              <button onClick={() => setSubmitModal({...submitModal, isOpen: false})} className="text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-xl"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmitTask} className="p-6 space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg mb-4">
                  <p className="text-xs text-blue-200">Submitting this will automatically update the student's Content Hub!</p>
              </div>

              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Content Title</label>
                  <input type="text" required value={submitModal.contentTitle} onChange={e => setSubmitModal({...submitModal, contentTitle: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
              </div>
              
              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Content Type</label>
                  <select value={submitModal.contentType} onChange={e => setSubmitModal({...submitModal, contentType: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500">
                      <option value="live">Live Class Link</option>
                      <option value="recording">Recording Video</option>
                      <option value="document">PDF / Document</option>
                  </select>
              </div>

              <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5 mt-2">
                <button type="button" onClick={() => setSubmitModal({...submitModal, type: 'link'})} className={`flex-1 py-2 text-xs font-bold rounded-lg flex justify-center items-center gap-2 ${submitModal.type === 'link' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><LinkIcon size={14}/> Paste Link</button>
                <button type="button" onClick={() => setSubmitModal({...submitModal, type: 'file'})} className={`flex-1 py-2 text-xs font-bold rounded-lg flex justify-center items-center gap-2 ${submitModal.type === 'file' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><FileText size={14}/> Upload File</button>
              </div>

              {submitModal.type === 'link' ? (
                <input type="url" required value={submitModal.link} onChange={e => setSubmitModal({...submitModal, link: e.target.value})} placeholder="Zoom / Drive Link..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
              ) : (
                <input type="file" required onChange={e => setSubmitModal({...submitModal, file: e.target.files[0]})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-blue-500/20 file:text-blue-400" />
              )}

              <button type="submit" className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">Publish to Content Hub</button>
            </form>
          </div>
        </div>
      )}

      {/* Unlock Request Modal */}
      {unlockModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-red-950/30">
              <h3 className="text-white text-lg font-bold flex items-center gap-2"><AlertCircle className="text-red-500" size={20}/> Request Unlock</h3>
              <button onClick={() => setUnlockModal({...unlockModal, isOpen: false})} className="text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-xl"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleRequestUnlock} className="p-6">
              <p className="text-sm text-slate-400 mb-5">You missed the deadline for <strong className="text-white">{unlockModal.taskName}</strong>.</p>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Reason for delay</label>
                <textarea required rows={4} value={unlockModal.reason} onChange={e => setUnlockModal({...unlockModal, reason: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-red-500 resize-none"></textarea>
              </div>
              <button type="submit" className="w-full mt-6 bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                Send Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}