import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, X, Clock, CheckCircle2, ListTodo, AlertCircle, XCircle, Eye, Trash2, TrendingUp, Building2, Filter, Plus } from 'lucide-react';
import api from '../../api/axios';

export default function ManagerTasks() {
  const [loading, setLoading] = useState(true);

  // Filters State
  const loggedInUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = ['System Admin', 'Director', 'Admin'].includes(loggedInUser?.role);
  
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all'); 
  const [allBatches, setAllBatches] = useState([]); 
  const [filteredBatches, setFilteredBatches] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('all');

  // Task Templates State
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [newTaskForm, setNewTaskForm] = useState({ title: '', has_time_limit: false, type: 'EXTRA' });

  // Approvals State
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [staffProgress, setStaffProgress] = useState(0); 
  const [previewModal, setPreviewModal] = useState({ isOpen: false, url: '', title: '' });

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          try {
              // 💡 URL එක හරියටම දුන්නා 💡
              const batchRes = await api.get('/admin/manager/batches-full'); 
              const fetchedBatches = batchRes.data || [];
              setAllBatches(fetchedBatches);

              if (isAdmin) {
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
              }
              setFilteredBatches(fetchedBatches);
              if(fetchedBatches.length > 0) setSelectedBatch(fetchedBatches[0].id);

              if (isAdmin) {
                  // 💡 URL එක හරියටම දුන්නා 💡
                  const staffRes = await api.get('/tasks/manager/staff-list').catch(()=>({data:[]}));
                  setStaffList(staffRes.data.filter(u => ['Coordinator', 'Staff'].includes(u.role)) || []);
              }

              fetchTaskTemplates();
          } catch (e) { console.error("Initial Fetch Error:", e); }
          finally { setLoading(false); }
      };
      fetchData();
  }, [isAdmin]);

  useEffect(() => {
      if (isAdmin && selectedBusiness !== 'all') {
          const bList = allBatches.filter(b => b.business_id.toString() === selectedBusiness);
          setFilteredBatches(bList);
          if (bList.length > 0) setSelectedBatch(bList[0].id);
          else setSelectedBatch('');
      } else {
          setFilteredBatches(allBatches);
      }
  }, [selectedBusiness, allBatches, isAdmin]);

  const fetchTaskTemplates = async () => {
      try {
          const tempRes = await api.get('/tasks/manager/templates');
          setTaskTemplates(tempRes.data?.tasks || []);
      } catch (e) { console.error("Template Error"); }
  };

  const fetchApprovalsAndStats = async () => {
      try {
          let url = `/tasks/manager/approvals?staffId=${selectedStaff}`;
          if (selectedBatch) url += `&batchId=${selectedBatch}`;
          
          const res = await api.get(url);
          setPendingApprovals(res.data.tasks || []);
          setStaffProgress(res.data.successRate || 0);
      } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchApprovalsAndStats(); }, [selectedStaff, selectedBatch]);

  const handleSaveTaskTemplate = async (e) => {
      e.preventDefault();
      if (!newTaskForm.title) return toast.error("Task title is required");
      try {
          const res = await api.post('/tasks/manager/task-templates/add', newTaskForm);
          setTaskTemplates([...taskTemplates, res.data]);
          toast.success("Task Template Added!");
          setNewTaskForm({ title: '', has_time_limit: false, type: 'EXTRA' });
      } catch (error) { toast.error("Failed to save template"); }
  };

  const handleDeleteTaskTemplate = async (id) => {
      if(!window.confirm("Delete this Template? This won't affect already scheduled tasks.")) return;
      try {
          await api.delete(`/tasks/manager/task-templates/${id}`);
          setTaskTemplates(taskTemplates.filter(t => t.id !== id));
          toast.success("Deleted!");
      } catch (error) { toast.error("Failed to delete template"); }
  };

  const handleApprove = async (id) => {
      try {
          await api.post('/tasks/manager/approvals/approve', { taskId: id });
          toast.success("Task Approved & Content Published!");
          fetchApprovalsAndStats();
      } catch(e) { toast.error("Failed to approve"); }
  };

  const handleReject = async (id) => {
      const reason = window.prompt("Reason for rejection:");
      if(!reason) return;
      try {
          await api.post('/tasks/manager/approvals/reject', { taskId: id, reason });
          toast.error("Task Rejected.");
          fetchApprovalsAndStats();
      } catch(e) { toast.error("Failed to reject"); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-6">
      
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <ListTodo className="text-blue-400" size={32}/> Master Task Manager
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium">Create Task Templates and Approve Staff Submissions.</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-3">
          {isAdmin && (
             <div className="bg-slate-800/40 border border-white/10 p-2 rounded-2xl flex flex-col shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Building2 size={12}/> Business</label>
                <select className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-3 py-1.5 outline-none mt-1 cursor-pointer" value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)}>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
             </div>
          )}
          <div className="bg-slate-800/40 border border-white/10 p-2 rounded-2xl flex flex-col shadow-lg">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Batch</label>
             <select className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-3 py-1.5 mt-1 outline-none cursor-pointer focus:border-blue-400" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
               <option value="all">All Batches</option>
               {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
          {isAdmin && (
             <div className="bg-slate-800/40 border border-white/10 p-2 rounded-2xl flex flex-col shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Filter size={12}/> Staff</label>
                <select className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-3 py-1.5 mt-1 outline-none cursor-pointer focus:border-blue-400" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                  <option value="all">All Coordinators</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.fName} {s.lName}</option>)}
                </select>
             </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 overflow-hidden">
          
          {/* COLUMN 1: TASK TEMPLATES CREATION */}
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl flex flex-col p-6 overflow-hidden backdrop-blur-md">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Plus size={16} className="text-blue-400"/> CREATE TASK LIST</h3>
              
              <form onSubmit={handleSaveTaskTemplate} className="bg-slate-900/40 p-5 rounded-xl border border-white/10 mb-6 space-y-4 shrink-0">
                  <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-1.5">Task Name</label>
                      <input required type="text" placeholder="e.g. Upload Notes PDF" value={newTaskForm.title} onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})} className="w-full bg-slate-800/80 border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer font-bold text-xs transition-all ${newTaskForm.type === 'MANDATORY' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                          <input type="radio" name="taskType" checked={newTaskForm.type === 'MANDATORY'} onChange={() => setNewTaskForm({...newTaskForm, type: 'MANDATORY'})} className="hidden" />
                          Mandatory
                      </label>
                      <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer font-bold text-xs transition-all ${newTaskForm.type === 'EXTRA' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800'}`}>
                          <input type="radio" name="taskType" checked={newTaskForm.type === 'EXTRA'} onChange={() => setNewTaskForm({...newTaskForm, type: 'EXTRA'})} className="hidden" />
                          Extra / Optional
                      </label>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                      Add to Master List
                  </button>
              </form>

              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0">CURRENT MASTER LIST</h4>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                  {taskTemplates.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No templates found.</p> :
                      taskTemplates.map(task => (
                          <div key={task.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex justify-between items-center group hover:border-white/20 transition-all">
                              <div>
                                  <span className="text-sm font-bold text-white block mb-1">{task.title}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold border ${task.type === 'STRICT' || task.type === 'MANDATORY' ? 'bg-orange-900/50 text-orange-400 border-orange-500/20' : 'bg-blue-900/50 text-blue-400 border-blue-500/20'}`}>
                                      {task.type === 'STRICT' ? 'MANDATORY' : task.type || 'EXTRA'}
                                  </span>
                              </div>
                              <button onClick={() => handleDeleteTaskTemplate(task.id)} className="text-slate-500 hover:text-red-400 transition-all p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                          </div>
                      ))
                  }
              </div>
          </div>

          {/* COLUMN 2 & 3: APPROVALS */}
          <div className="col-span-2 flex flex-col gap-6 overflow-hidden">
              <div className="grid grid-cols-2 gap-6 shrink-0">
                  <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-center">
                      <div className="flex justify-between items-end mb-3">
                          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={16}/> SUCCESS RATE</h3>
                          <span className="text-3xl font-black text-white">{staffProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-900/80 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${staffProgress}%` }}></div>
                      </div>
                  </div>
                  <div className="bg-orange-950/20 border border-orange-900/30 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-center">
                      <h3 className="text-xl font-black text-white flex items-center gap-2"><AlertCircle size={24} className="text-orange-500"/> {pendingApprovals.length} Pending</h3>
                      <p className="text-xs text-orange-200 mt-1">Submissions waiting for your approval.</p>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-800/20 rounded-2xl border border-white/5 backdrop-blur-md p-2">
                  {pendingApprovals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-10">
                          <CheckCircle2 size={48} className="text-emerald-500/50 mb-3"/>
                          <h3 className="text-lg font-bold text-slate-300">All caught up!</h3>
                          <p className="text-xs text-slate-500 mt-1">No pending tasks to review.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3">
                          {pendingApprovals.map((task) => {
                              // Try to parse JSON proof if it came from the new system
                              let contentTitle = task.description;
                              let proofLink = task.submitted_proof;
                              try {
                                  const parsed = JSON.parse(task.submitted_proof);
                                  if (parsed.title) contentTitle = parsed.title;
                                  if (parsed.link) proofLink = parsed.link;
                              } catch(e) {}

                              return (
                                  <div key={task.id} className="p-5 rounded-2xl border bg-slate-900/60 border-white/10 shadow-lg hover:border-blue-500/30 transition-all flex flex-col">
                                      {task.resubmit_count > 0 && <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/40 font-bold uppercase mb-3 inline-block w-max">Resubmitted</span>}
                                      
                                      <div className="flex justify-between items-start mb-3">
                                          <h4 className="text-sm font-black text-white uppercase tracking-wider">{task.task_type}</h4>
                                          <span className="text-[10px] text-slate-400 bg-black/40 px-2 py-1 rounded-md">Staff: {task.staff_id}</span>
                                      </div>
                                      
                                      <p className="text-xs text-slate-300 mb-5 leading-relaxed border-l-2 border-blue-500 pl-3 py-1">{contentTitle}</p>
                                      
                                      <div className="mt-auto">
                                          <button onClick={() => setPreviewModal({ isOpen: true, url: proofLink || '', title: task.task_type })} className="w-full mb-3 py-2.5 bg-white/5 border border-white/10 text-blue-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                                              <Eye size={16}/> Preview Submission
                                          </button>

                                          <div className="flex gap-2">
                                              <button onClick={() => handleApprove(task.id)} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/50 hover:border-emerald-500 text-emerald-400 hover:text-white text-xs font-bold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all"><CheckCircle2 size={14}/> Approve</button>
                                              <button onClick={() => handleReject(task.id)} className="flex-1 bg-red-500/20 hover:bg-red-500 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white text-xs font-bold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all"><XCircle size={14}/> Reject</button>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* PREVIEW MODAL */}
      {previewModal.isOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                 <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                     <h3 className="text-sm text-white font-bold flex items-center gap-2"><Eye className="text-blue-400" size={18}/> Proof: {previewModal.title}</h3>
                     <button onClick={() => setPreviewModal({ isOpen: false, url: '', title: '' })} className="text-slate-400 hover:text-red-400 bg-white/5 p-2 rounded-xl transition-all"><X size={18}/></button>
                 </div>
                 <div className="flex-1 bg-white relative">
                     {previewModal.url ? (
                         <iframe src={previewModal.url.includes('drive.google') ? previewModal.url.replace('view', 'preview') : previewModal.url} className="w-full h-full border-none" title="preview" allowFullScreen></iframe>
                     ) : (
                         <div className="text-center text-slate-500 mt-20 font-bold">No valid URL provided.</div>
                     )}
                 </div>
             </div>
         </div>
      )}

    </div>
  );
}