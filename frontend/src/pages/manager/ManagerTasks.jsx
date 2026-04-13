import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, X, Clock, CheckCircle2, ListTodo, AlertCircle, XCircle, Eye, Trash2, TrendingUp, Building2, Filter, UserPlus, Save, ArrowRight, Edit3, Unlock } from 'lucide-react';
import api from '../../api/axios';

export default function ManagerTasks() {
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

  const [schedules, setSchedules] = useState([]); 
  const [taskTemplates, setTaskTemplates] = useState([]); 
  const [newTaskTemplate, setNewTaskTemplate] = useState({ id: null, title: '', start_date: '', end_date: '', start_time: '', end_time: '' });
  const [assignForm, setAssignForm] = useState({ scheduleId: '', templateId: '' });

  const [allTasks, setAllTasks] = useState([]); 
  const [staffProgress, setStaffProgress] = useState(0); 
  const [previewModal, setPreviewModal] = useState({ isOpen: false, url: '', title: '' });

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          try {
              const batchRes = await api.get('/admin/manager/batches-full'); 
              setAllBatches(Array.isArray(batchRes.data) ? batchRes.data : []);

              if (isAdmin) {
                  const bizRes = await api.get('/admin/businesses');
                  setBusinesses(Array.isArray(bizRes.data) ? bizRes.data : (bizRes.data?.businesses || []));
              }
              
              const staffRes = await api.get('/tasks/manager/staff-list').catch(()=>({data:[]}));
              setStaffList(Array.isArray(staffRes.data) ? staffRes.data.filter(u => ['Coordinator', 'Staff', 'Lecturer'].includes(u.role)) : []);

              fetchTaskTemplates();
          } catch (e) { console.error("Initial Fetch Error:", e); }
          finally { setLoading(false); }
      };
      fetchData();
  }, [isAdmin]);

  useEffect(() => {
      if(!allBatches || allBatches.length === 0) { setFilteredBatches([]); return; }
      let bList = allBatches;
      if (isAdmin && selectedBusiness !== 'all' && selectedBusiness !== '') {
          bList = allBatches.filter(b => {
              let bId = b.business?.id ?? b.Business?.id ?? b.business_id ?? b.businessId;
              if (bId && typeof bId === 'object') bId = bId.value ?? bId.id;
              return String(bId) === String(selectedBusiness);
          });
      }
      setFilteredBatches(bList);
      setSelectedBatch('all'); 
  }, [selectedBusiness, allBatches, isAdmin]);

  const fetchTaskTemplates = async () => {
      try {
          const tempRes = await api.get('/tasks/manager/templates');
          setTaskTemplates(tempRes.data?.tasks || []);
      } catch (e) { console.error("Template Error"); }
  };

  const fetchTasksAndSchedules = async () => {
      if(!selectedBatch || selectedBatch === 'all') return;
      try {
          const d = new Date();
          const schedRes = await api.get(`/tasks/manager/schedule?batchId=${selectedBatch}&year=${d.getFullYear()}&month=${d.getMonth()+1}`);
          setSchedules(Array.isArray(schedRes.data) ? schedRes.data : []);

          const res = await api.get(`/tasks/manager/tasks?batchId=${selectedBatch}`);
          setAllTasks(res.data || []);
          
          let appUrl = `/tasks/manager/approvals?staffId=${selectedStaff}`;
          if (selectedBatch && selectedBatch !== 'all') appUrl += `&batchId=${selectedBatch}`;
          
          const appRes = await api.get(appUrl);
          setStaffProgress(appRes.data.successRate || 0);
      } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchTasksAndSchedules(); }, [selectedStaff, selectedBatch]);

  const handleSaveTemplate = async (e) => {
      e.preventDefault();
      if (!newTaskTemplate.title.trim()) return toast.error("Task title is required");
      if (isAdmin && (selectedBusiness === 'all' || !selectedBusiness)) {
          return toast.error("Please select a specific Business from the top filter to save templates.");
      }

      try {
          const payload = { ...newTaskTemplate, businessId: selectedBusiness };
          if (newTaskTemplate.id) {
              await api.put('/tasks/manager/task-templates/update', payload);
              toast.success("Template Updated!");
          } else {
              await api.post('/tasks/manager/task-templates/add', payload);
              toast.success("Saved to Master List!");
          }
          fetchTaskTemplates();
          setNewTaskTemplate({ id: null, title: '', start_date: '', end_date: '', start_time: '', end_time: '' });
      } catch (error) { toast.error("Failed to save template"); }
  };

  const handleDeleteTemplate = async (id) => {
      if(!window.confirm("Delete this from Master List?")) return;
      try {
          await api.delete(`/tasks/manager/task-templates/${id}`);
          setTaskTemplates(taskTemplates.filter(t => t.id !== id));
          toast.success("Deleted from Master List!");
      } catch (error) { toast.error("Failed to delete template"); }
  };

  const handleEditTemplate = (t) => {
      let stTime = ''; let edTime = ''; let stDate = ''; let edDate = '';
      if(t.description) {
          try {
              const p = JSON.parse(t.description);
              stTime = p.start_time || ''; edTime = p.end_time || '';
              stDate = p.start_date || ''; edDate = p.end_date || '';
          } catch(e) {}
      }
      setNewTaskTemplate({ id: t.id, title: t.title, start_date: stDate, end_date: edDate, start_time: stTime, end_time: edTime });
  };

  const handleSendToPending = async (e) => {
      e.preventDefault();
      if (!selectedBatch || selectedBatch === 'all') return toast.error("Please select a batch first!");
      if (!assignForm.templateId) return toast.error("Please select a Task from the Master List!");
      
      const tpl = taskTemplates.find(t => String(t.id) === String(assignForm.templateId));
      if(!tpl) return toast.error("Invalid Template!");

      const sched = schedules.find(s => String(s.id) === String(assignForm.scheduleId));
      const subjectName = sched ? sched.subject : 'Custom Assignment';

      let stTime = null; let edTime = null; let stDate = null; let edDate = null;
      if(tpl.description) {
          try { 
              const p = JSON.parse(tpl.description); 
              stTime = p.start_time; edTime = p.end_time; 
              stDate = p.start_date; edDate = p.end_date; 
          } catch(e) {}
      }

      const finalDate = edDate || (sched ? sched.date.split('T')[0] : new Date().toISOString().split('T')[0]);

      try {
          await api.post('/tasks/manager/tasks/add', {
              staff_id: 0, 
              batch_id: selectedBatch,
              schedule_id: assignForm.scheduleId || null,
              task_type: tpl.title,
              description: `[${tpl.title}] ${subjectName}`, 
              deadline: finalDate,
              start_time: stTime || (sched ? sched.start_time : null),
              end_time: edTime || (sched ? sched.end_time : null)
          });
          toast.success("Task sent to Pending Assignments!");
          setAssignForm({ scheduleId: '', templateId: '' });
          fetchTasksAndSchedules();
      } catch (error) { toast.error("Failed to add to pending list."); }
  };

  const handleAssignTask = async (taskId, targetStaffId) => {
      if(!targetStaffId || targetStaffId === "") return toast.error("Select a staff member first.");
      try {
          await api.post('/tasks/manager/tasks/assign', { taskId, staffId: targetStaffId });
          toast.success("Task Allocated to Staff!");
          fetchTasksAndSchedules(); 
      } catch (e) { toast.error("Failed to allocate task"); }
  };

  const handleApprove = async (id) => {
      try { await api.post('/tasks/manager/approvals/approve', { taskId: id }); toast.success("Task Approved!"); fetchTasksAndSchedules(); } catch(e) {}
  };
  
  const handleReject = async (id) => {
      const reason = window.prompt("Reason for rejection:");
      if(!reason) return;
      try { await api.post('/tasks/manager/approvals/reject', { taskId: id, reason }); toast.error("Task Rejected."); fetchTasksAndSchedules(); } catch(e) {}
  };

  // 🔥 Unlock Request Handlers
  const handleApproveUnlock = async (taskId) => {
      const newTimeInput = document.getElementById(`new-deadline-${taskId}`).value;
      if (!newTimeInput) return toast.error("Please provide a new deadline time.");
      try {
          // Endpoint එක ඔයාගේ backend route එකට ගැලපෙන්න හදාගන්න
          await api.post('/tasks/approve-unlock', { task_id: taskId, new_time: newTimeInput });
          toast.success("Task Unlocked with Penalty applied!");
          fetchTasksAndSchedules();
      } catch (e) { toast.error("Failed to unlock."); }
  };

  const handleDeleteTask = async (id) => {
      if(!window.confirm("Are you sure you want to delete this task?")) return;
      try { await api.delete(`/admin/tasks/delete/${id}`); toast.success("Deleted!"); fetchTasksAndSchedules(); } catch (error) { toast.error("Failed to delete task."); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

  const unassignedTasks = allTasks.filter(t => t.staff_id === 0 || t.staff_id === null);
  const activeAssignedTasks = allTasks.filter(t => t.staff_id !== 0 && t.staff_id !== null && t.manager_status !== 'APPROVED' && (selectedStaff === 'all' || String(t.staff_id) === String(selectedStaff)));
  
  // Pending submissions OR pending unlock requests
  const waitingApprovalCount = activeAssignedTasks.filter(t => t.manager_status === 'WAITING_APPROVAL' || t.unlock_status === 'REQUESTED').length;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 flex flex-col font-sans pb-4">
      
      {/* HEADER FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <ListTodo className="text-blue-400" size={32}/> Master Task Manager
          </h2>
          <p className="text-base text-slate-400 mt-2 font-medium">Create templates, stage pending tasks, and allocate to staff.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
             <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Building2 size={14}/> Business</label>
                <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2 outline-none mt-1 cursor-pointer" value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)}>
                    <option value="all">All Businesses</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
             </div>
          )}
          <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Select Batch</label>
             <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2 mt-1 outline-none cursor-pointer focus:border-blue-400" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
               <option value="all">-- Choose Batch --</option>
               {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
          {isAdmin && (
             <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Filter size={14}/> Staff Filter</label>
                <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2 mt-1 outline-none cursor-pointer focus:border-blue-400" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                  <option value="all">All Coordinators</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.fName} {s.lName}</option>)}
                </select>
             </div>
          )}
        </div>
      </div>

      {selectedBatch === 'all' ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-white/10 rounded-2xl bg-slate-800/30 min-h-[400px]">
              <Building2 size={64} className="text-slate-600 mb-4"/>
              <h3 className="text-2xl font-bold text-slate-300">Select a Batch First</h3>
              <p className="text-base text-slate-500 mt-2">You must select a specific batch to view or assign tasks.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1">
              
              {/* COLUMN 1: MASTER TASK LIST */}
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl flex flex-col p-6 shadow-lg">
                  <h3 className="text-base font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2 shrink-0"><ListTodo className="text-blue-400" size={20}/> Master Task List</h3>
                  
                  <form onSubmit={handleSaveTemplate} className="mb-4 space-y-4 shrink-0">
                      <input type="text" required value={newTaskTemplate.title} onChange={e => setNewTaskTemplate({...newTaskTemplate, title: e.target.value})} placeholder="Task Name..." className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-base text-white outline-none focus:border-blue-500" />
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs text-slate-400 font-bold uppercase block mb-1">Start Date <span className="text-slate-600">(Opt)</span></label><input type="date" value={newTaskTemplate.start_date} onChange={e => setNewTaskTemplate({...newTaskTemplate, start_date: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none" /></div>
                          <div><label className="text-xs text-slate-400 font-bold uppercase block mb-1">End Date <span className="text-slate-600">(Opt)</span></label><input type="date" value={newTaskTemplate.end_date} onChange={e => setNewTaskTemplate({...newTaskTemplate, end_date: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-xs text-slate-400 font-bold uppercase block mb-1">Start Time <span className="text-slate-600">(Opt)</span></label><input type="time" value={newTaskTemplate.start_time} onChange={e => setNewTaskTemplate({...newTaskTemplate, start_time: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none" /></div>
                          <div><label className="text-xs text-slate-400 font-bold uppercase block mb-1">End Time <span className="text-slate-600">(Opt)</span></label><input type="time" value={newTaskTemplate.end_time} onChange={e => setNewTaskTemplate({...newTaskTemplate, end_time: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none" /></div>
                      </div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-base font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"><Save size={18}/> {newTaskTemplate.id ? 'Update Task' : 'Save to List'}</button>
                      {newTaskTemplate.id && <button type="button" onClick={() => setNewTaskTemplate({ id: null, title: '', start_date: '', end_date: '', start_time: '', end_time: '' })} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold py-2 rounded-xl mt-1 transition-colors">Cancel Edit</button>}
                  </form>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[400px]">
                      {taskTemplates.length === 0 ? <p className="text-sm text-slate-500 text-center mt-10 font-medium">List is empty.</p> : 
                          taskTemplates.map(t => {
                              let times = ''; let dates = '';
                              if(t.description) {
                                  try { 
                                      const p = JSON.parse(t.description); 
                                      if(p.start_time || p.end_time) times = `${p.start_time||'-'} to ${p.end_time||'-'}`; 
                                      if(p.start_date || p.end_date) dates = `${p.start_date ? p.start_date.split('T')[0] : '-'} to ${p.end_date ? p.end_date.split('T')[0] : '-'}`; 
                                  } catch(e){}
                              }
                              return (
                                  <div key={t.id} className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all group">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="text-base font-bold text-slate-200">{t.title}</span>
                                          <div className="flex gap-2">
                                              <button onClick={() => handleEditTemplate(t)} className="text-blue-400 hover:text-blue-300 bg-black/20 p-2 rounded-lg transition-colors"><Edit3 size={16}/></button>
                                              <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-400 hover:text-red-300 bg-black/20 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                          </div>
                                      </div>
                                      {dates && <span className="text-xs text-orange-400 flex items-center gap-1.5 mb-1"><Clock size={12}/> {dates}</span>}
                                      {times && <span className="text-xs text-slate-400 flex items-center gap-1.5"><Clock size={12}/> {times}</span>}
                                  </div>
                              );
                          })
                      }
                  </div>
              </div>

              {/* COLUMN 2: PENDING ASSIGNMENTS */}
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl flex flex-col p-6 shadow-lg">
                  <h3 className="text-base font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2 shrink-0"><ArrowRight className="text-orange-400" size={20}/> Add to Pending</h3>
                  
                  <form onSubmit={handleSendToPending} className="bg-slate-900/60 p-5 rounded-xl border border-white/10 mb-6 shrink-0 space-y-4 shadow-inner">
                      <div>
                          <label className="text-xs text-slate-400 font-bold uppercase block mb-2">Select Linked Schedule <span className="text-[10px] text-slate-500">(Optional)</span></label>
                          <select value={assignForm.scheduleId} onChange={e => setAssignForm({...assignForm, scheduleId: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-base text-white outline-none focus:border-orange-500">
                              <option value="">-- No Schedule (Custom Task) --</option>
                              {schedules.map(s => <option key={s.id} value={s.id}>{s.subject} - {s.date.split('T')[0]}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="text-xs text-slate-400 font-bold uppercase block mb-2">Select Task Template</label>
                          <select required value={assignForm.templateId} onChange={e => setAssignForm({...assignForm, templateId: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-base text-white outline-none focus:border-orange-500">
                              <option value="">-- Choose Task --</option>
                              {taskTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </select>
                      </div>
                      <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white text-base font-bold py-3 rounded-xl shadow-lg transition-colors mt-3">Send to Pending Queue</button>
                  </form>

                  <div className="flex justify-between items-center mb-4 shrink-0">
                      <h3 className="text-base font-bold text-orange-400 flex items-center gap-2"><UserPlus size={20}/> Pending Queue</h3>
                      <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-md text-sm font-bold">{unassignedTasks.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[400px]">
                      {unassignedTasks.length === 0 ? (
                          <div className="text-center py-10 opacity-50">
                              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400"/>
                              <p className="text-sm font-bold">Queue is empty!</p>
                          </div>
                      ) : (
                          unassignedTasks.map(task => {
                              const deadline = new Date(task.deadline_date).toISOString().split('T')[0];
                              const niceType = task.task_type; 

                              return (
                                  <div key={task.id} className="p-4 bg-slate-900/80 border border-orange-500/30 rounded-xl flex flex-col gap-2 group hover:border-orange-500/60 transition-all">
                                      <div className="flex justify-between items-start">
                                          <span className="text-xs bg-white/10 px-2 py-1 rounded uppercase font-bold text-slate-200 truncate max-w-[150px]" title={niceType}>{niceType}</span>
                                          <span className="text-xs text-orange-300 flex items-center gap-1 font-semibold"><Clock size={14}/> {deadline}</span>
                                      </div>
                                      <p className="text-base font-bold text-white mt-1 leading-snug">{task.description}</p>
                                      
                                      <div className="flex items-center gap-2 mt-2">
                                          <select id={`assign-${task.id}`} className="flex-1 bg-black/50 border border-white/10 text-white text-sm rounded-lg p-2.5 outline-none focus:border-blue-500">
                                              <option value="">-- Allocate Staff --</option>
                                              {staffList.map(s => <option key={s.id} value={s.id}>{s.fName} {s.lName}</option>)}
                                          </select>
                                          <button onClick={() => {
                                              const staffId = document.getElementById(`assign-${task.id}`).value;
                                              handleAssignTask(task.id, staffId);
                                          }} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg transition-all shadow-lg" title="Allocate"><UserPlus size={18}/></button>
                                          <button onClick={() => handleDeleteTask(task.id)} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>

              {/* COLUMN 3: STAFF SUBMISSIONS / APPROVALS */}
              <div className="flex flex-col gap-5 h-full">
                  <div className="grid grid-cols-2 gap-4 shrink-0">
                      <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-5 flex flex-col justify-center shadow-lg">
                          <div className="flex justify-between items-end mb-3">
                              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={16}/> SUCCESS RATE</h3>
                              <span className="text-3xl font-black text-white">{staffProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-900/80 rounded-full h-3">
                              <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${staffProgress}%` }}></div>
                          </div>
                      </div>
                      <div className="bg-orange-950/20 border border-orange-900/30 rounded-2xl p-5 flex flex-col justify-center shadow-lg">
                          <h3 className="text-2xl font-black text-white flex items-center gap-2"><AlertCircle size={24} className="text-orange-500"/> {waitingApprovalCount} Subs</h3>
                          <p className="text-sm text-orange-200 mt-1">Pending actions.</p>
                      </div>
                  </div>

                  <div className="flex-1 bg-slate-800/20 rounded-2xl border border-white/5 flex flex-col shadow-inner overflow-hidden max-h-[650px]">
                      <h3 className="text-base font-bold text-white uppercase tracking-widest p-5 border-b border-white/10 shrink-0">Submissions Review</h3>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                          {activeAssignedTasks.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-50">
                                  <CheckCircle2 size={48} className="text-emerald-500 mb-4"/>
                                  <h3 className="text-base font-bold text-slate-300">All caught up!</h3>
                                  <p className="text-sm text-slate-500 mt-1">No active or pending tasks for the selected staff.</p>
                              </div>
                          ) : (
                              <div className="space-y-5">
                                  {activeAssignedTasks.map((task) => {
                                      let contentTitle = task.description;
                                      let proofLink = task.submitted_proof;
                                      let extraDetails = null;

                                      if (task.submitted_proof && task.submitted_proof.startsWith('{')) {
                                          try {
                                              const parsed = JSON.parse(task.submitted_proof);
                                              if (parsed.title) contentTitle = parsed.title;
                                              if (parsed.link) proofLink = parsed.link;
                                              extraDetails = parsed;
                                          } catch(e) {}
                                      } else {
                                          proofLink = task.submitted_proof; // Fallback directly to URL if string
                                      }

                                      const isWaiting = task.manager_status === 'WAITING_APPROVAL';
                                      const isUnlockReq = task.unlock_status === 'REQUESTED';
                                      
                                      const niceType = task.task_type;

                                      return (
                                          <div key={task.id} className={`p-5 rounded-2xl border shadow-lg flex flex-col ${isUnlockReq ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-900/60 border-white/10'}`}>
                                              
                                              {/* UNLOCK REQUEST UI */}
{isUnlockReq && (
    <div className="mb-4 bg-red-900/40 border border-red-500/50 p-4 rounded-xl">
        <h4 className="text-red-400 font-bold flex items-center gap-2 mb-2"><Unlock size={18}/> Unlock Requested!</h4>
        <p className="text-sm text-slate-300 mb-3">Reason: <span className="text-white font-medium italic">{task.unlock_reason || "No reason given"}</span></p>
        
        {/* 🔥 මෙතන type="date" වෙනුවට type="time" දැම්මා 🔥 */}
        <label className="text-xs text-slate-400 font-bold uppercase block mb-1">Set New Time Deadline</label>
        <input type="time" id={`new-deadline-${task.id}`} className="w-full bg-black/40 border border-red-500/30 rounded-lg p-2 text-sm text-white outline-none mb-3" />
        
        <button onClick={() => handleApproveUnlock(task.id)} className="w-full bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-2 rounded-lg transition-colors">Approve Extension</button>
    </div>
)}

                                              {task.resubmit_count > 0 && !isUnlockReq && <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-md border border-red-500/40 font-bold uppercase mb-3 inline-block w-max">Resubmitted / Late</span>}
                                              
                                              <div className="flex justify-between items-start mb-3">
                                                  <h4 className="text-base font-black text-white uppercase tracking-wider truncate max-w-[150px]" title={niceType}>{niceType}</h4>
                                                  <span className="text-sm text-slate-400 bg-black/40 px-3 py-1 rounded-md font-medium">Staff ID: {task.staff_id}</span>
                                              </div>
                                              
                                              <p className="text-base font-bold text-slate-200 mb-4 leading-relaxed border-l-2 border-blue-500 pl-3">{contentTitle}</p>
                                              
                                              {isWaiting && !isUnlockReq ? (
                                                  <>
                                                      {extraDetails && (
                                                          <div className="bg-black/30 p-4 rounded-xl mt-2 mb-4 space-y-2 border border-white/5">
                                                              {extraDetails.noChanges ? (
                                                                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                                                                      <CheckCircle2 size={20}/> <span className="text-base font-bold">Completed (No Updates)</span>
                                                                  </div>
                                                              ) : (
                                                                  <>
                                                                      {extraDetails.isFree && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 font-bold uppercase inline-block mb-1">Free Content</span>}
                                                                      {extraDetails.zoomMeetingId && <p className="text-sm text-slate-400">Zoom: <span className="text-white font-bold">{extraDetails.zoomMeetingId}</span></p>}
                                                                  </>
                                                              )}
                                                          </div>
                                                      )}
                                                      
                                                      <div className="mt-auto pt-4 border-t border-white/10">
                                                          {proofLink && (!extraDetails || !extraDetails.noChanges) && (
                                                              <button onClick={() => setPreviewModal({ isOpen: true, url: proofLink, title: task.task_type })} className="w-full mb-3 py-2.5 bg-white/5 border border-white/10 text-blue-400 rounded-lg text-base font-bold flex items-center justify-center gap-2 hover:bg-white/10">
                                                                  <Eye size={20}/> Preview Uploaded File
                                                              </button>
                                                          )}

                                                          <div className="flex gap-3">
                                                              <button onClick={() => handleApprove(task.id)} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/50 hover:border-emerald-500 text-emerald-400 hover:text-white text-base font-bold py-3 rounded-lg flex justify-center items-center gap-2"><CheckCircle2 size={20}/> Approve</button>
                                                              <button onClick={() => handleReject(task.id)} className="flex-1 bg-red-500/20 hover:bg-red-500 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white text-base font-bold py-3 rounded-lg flex justify-center items-center gap-2"><XCircle size={20}/> Reject</button>
                                                          </div>
                                                      </div>
                                                  </>
                                              ) : (
                                                  !isUnlockReq && (
                                                      <div className="mt-auto pt-4 border-t border-white/10">
                                                          <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex items-center justify-center gap-2 text-orange-400">
                                                              <Loader2 size={18} className="animate-spin" />
                                                              <span className="text-base font-bold">In Progress</span>
                                                          </div>
                                                      </div>
                                                  )
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* PREVIEW MODAL */}
      {previewModal.isOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                 <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                     <h3 className="text-xl text-white font-bold flex items-center gap-3"><Eye className="text-blue-400" size={24}/> Proof Preview</h3>
                     <button onClick={() => setPreviewModal({ isOpen: false, url: '', title: '' })} className="text-slate-400 hover:text-red-400 bg-white/5 p-2 rounded-xl transition-all"><X size={24}/></button>
                 </div>
                 <div className="flex-1 bg-white relative">
                     {previewModal.url ? (
                         <iframe src={previewModal.url.includes('drive.google') ? previewModal.url.replace('view', 'preview') : previewModal.url} className="w-full h-full border-none" title="preview" allowFullScreen></iframe>
                     ) : (
                         <div className="text-center text-slate-500 mt-32 font-bold text-xl">No valid URL provided.</div>
                     )}
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}