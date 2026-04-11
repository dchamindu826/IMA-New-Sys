import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, Clock, Lock, UploadCloud, Link as LinkIcon, AlertTriangle, FileText, X, FolderOpen, GripVertical, MonitorPlay, ExternalLink, Ban, BookOpen, Plus, FolderPlus, Building2, Filter } from 'lucide-react'; // 🔥 Added Building2, Filter, FolderPlus 🔥
import api from '../../api/axios'; 

export default function CoordinatorTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const loggedInUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = ['System Admin', 'Director', 'Admin'].includes(loggedInUser?.role);
  
  // 🔥 Re-added Filters 🔥
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all'); 
  const [allBatches, setAllBatches] = useState([]); 
  const [filteredBatches, setFilteredBatches] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('all');

  const [newFolderModal, setNewFolderModal] = useState({ isOpen: false, title: '', order: 1 });

  const [hubModal, setHubModal] = useState({
      isOpen: false,
      task: null,
      loading: false,
      contents: [],
      folders: [],
      matchingCourses: [], 
      noChanges: false,
      courseCodeCache: null,
      courseIdCache: null,
      form: { 
          title: '', type: 1, contentGroupId: '', link: '', file: null, 
          zoomMeetingId: '', startTime: '', endTime: '', isFree: false,
          paperTime: '', questionCount: '', selectedCourses: [] 
      }
  });

  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
      if (isAdmin) {
          const fetchAdminFilters = async () => {
              try {
                  const batchRes = await api.get('/admin/manager/batches-full');
                  setAllBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
                  
                  const bizRes = await api.get('/admin/businesses');
                  setBusinesses(Array.isArray(bizRes.data) ? bizRes.data : (bizRes.data?.businesses || []));
                  
                  const staffRes = await api.get('/tasks/manager/staff-list').catch(()=>({data:[]}));
                  setStaffList(Array.isArray(staffRes.data) ? staffRes.data.filter(u => ['Coordinator', 'Staff'].includes(u.role)) : []);
              } catch(e) {}
          };
          fetchAdminFilters();
      }
  }, [isAdmin]);

  useEffect(() => {
      if(!allBatches || allBatches.length === 0) {
          setFilteredBatches([]); return;
      }
      let bList = allBatches;
      if (isAdmin && selectedBusiness !== 'all' && selectedBusiness !== '') {
          bList = allBatches.filter(b => String(b.business_id) === String(selectedBusiness));
      } 
      setFilteredBatches(bList);
      setSelectedBatch('all');
  }, [selectedBusiness, allBatches, isAdmin]);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const batchParam = (selectedBatch && selectedBatch !== 'all') ? selectedBatch : '';
      
      const endpoint = isAdmin ? `/tasks/manager/tasks?batchId=${batchParam}` : '/tasks/my-tasks';
      const res = await api.get(endpoint);
      
      let fetchedTasks = [];
      if (isAdmin) {
          fetchedTasks = res.data || [];
          fetchedTasks = fetchedTasks.filter(t => t.staff_id !== 0 && t.staff_id !== null && t.manager_status !== 'APPROVED');
          if (selectedStaff && selectedStaff !== 'all') {
              fetchedTasks = fetchedTasks.filter(t => String(t.staff_id) === String(selectedStaff));
          }
      } else {
          fetchedTasks = res.data?.tasks || [];
      }

      const sortedTasks = fetchedTasks.sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date));
      setTasks(sortedTasks);
    } catch (error) { toast.error("Failed to load tasks."); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMyTasks(); }, [selectedStaff, selectedBatch]);

  const getEmbedUrl = (url) => {
      if (!url) return '';
      if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
      if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
      if (url.includes('drive.google.com') && url.includes('/view')) return url.replace('/view', '/preview');
      return url; 
  };

  const openTaskHub = async (task) => {
      setHubModal(prev => ({ ...prev, isOpen: true, task, loading: true, noChanges: false, matchingCourses: [] }));

      let subjectName = task.description;
      const match = task.description.match(/\]\s(.*?)\s-/);
      if (match) subjectName = match[1].trim();
      else subjectName = task.description.split('-')[0].replace(/\[.*?\]/, '').trim();

      // Admin uses filteredBatches, staff might not have it loaded like that, so fallback
      const batchListToUse = isAdmin ? filteredBatches : allBatches.length > 0 ? allBatches : await api.get('/admin/manager/batches-full').then(r=>r.data).catch(()=>[]);
      
      const batch = batchListToUse.find(b => String(b.id) === String(task.batch_id));
      let matchingCoursesList = []; 
      let firstCourseCode = null;
      let firstCourseId = null;
      
      if (batch && batch.groups) {
          batch.groups.forEach(g => {
              const c = g.courses?.find(c => c.name.toLowerCase().includes(subjectName.toLowerCase()) || subjectName.toLowerCase().includes(c.name.toLowerCase()));
              if (c) {
                  matchingCoursesList.push({ courseId: c.id, groupId: g.id, groupName: g.name, groupType: g.type, courseName: c.name });
                  if(!firstCourseId) { firstCourseId = c.id; firstCourseCode = c.code || `SUB_${c.id}`; }
              }
          });
      }

      let defaultType = 1; 
      const tStr = task.task_type || '';
      if(tStr === 'recording') defaultType = 2; 
      else if(tStr === 'document') defaultType = 3; 
      else if(tStr === 'sPaper') defaultType = 4; 
      else if(tStr === 'paper') defaultType = 5; 

      const defaultSelectedCourses = matchingCoursesList.map(mc => mc.courseId);

      setHubModal(prev => ({
          ...prev,
          courseCodeCache: firstCourseCode,
          courseIdCache: firstCourseId,
          matchingCourses: matchingCoursesList,
          form: {
              title: task.description,
              type: defaultType,
              contentGroupId: '', link: '', file: null, zoomMeetingId: '',
              startTime: task.start_time || '', endTime: task.end_time || '',
              isFree: task.description.toLowerCase().includes('free class'),
              paperTime: '', questionCount: '',
              selectedCourses: defaultSelectedCourses
          }
      }));

      if (firstCourseId) {
          try {
              const res = await api.get(`/admin/manager/get-contents?batchId=${task.batch_id}&courseCode=${firstCourseCode}&courseId=${firstCourseId}`);
              setHubModal(prev => ({ ...prev, contents: res.data?.contents || [], folders: res.data?.lessonGroups || [] }));
          } catch(e) { }
      }

      setHubModal(prev => ({ ...prev, loading: false }));
  };

  const toggleCourseSelection = (courseId) => {
      setHubModal(prev => {
          const isSelected = prev.form.selectedCourses.includes(courseId);
          const newSelected = isSelected ? prev.form.selectedCourses.filter(id => id !== courseId) : [...prev.form.selectedCourses, courseId];
          return { ...prev, form: { ...prev.form, selectedCourses: newSelected } };
      });
  };

  const handleCreateFolder = async (e) => {
      e.preventDefault();
      if(!newFolderModal.title) return toast.error("Folder name required");

      try {
          const payload = { 
              title: newFolderModal.title, 
              type: hubModal.form.type, 
              order: newFolderModal.order, 
              batch_id: hubModal.task.batch_id, 
              course_code: hubModal.courseCodeCache || 'NULL'
          };
          const res = await api.post('/admin/manager/content-group/add', payload);
          toast.success("Folder Created!");
          
          if (hubModal.courseIdCache) {
              const fetchRes = await api.get(`/admin/manager/get-contents?batchId=${hubModal.task.batch_id}&courseCode=${hubModal.courseCodeCache}&courseId=${hubModal.courseIdCache}`);
              setHubModal(prev => ({ 
                  ...prev, 
                  folders: fetchRes.data?.lessonGroups || [],
                  form: { ...prev.form, contentGroupId: res.data.data.id } 
              }));
          }
          setNewFolderModal({ isOpen: false, title: '', order: 1 });
      } catch(e) { toast.error("Failed to create folder"); }
  };

  const handleHubSubmit = async (e) => {
    e.preventDefault();

    if (!hubModal.noChanges) {
        if (hubModal.form.type === 1 || hubModal.form.type === 2) {
            if (!hubModal.form.link) return toast.error("Please enter a valid link!");
        }
        if (hubModal.form.type === 3 || hubModal.form.type === 4 || hubModal.form.type === 5) {
            if (!hubModal.form.file) return toast.error("Please select a file to upload!");
        }
        if (hubModal.form.selectedCourses.length === 0) {
            return toast.error("Please select at least one group to assign this content!");
        }
    }

    const formData = new FormData();
    formData.append('task_id', hubModal.task.id);
    formData.append('noChanges', hubModal.noChanges);
    
    if (!hubModal.noChanges) {
        formData.append('contentTitle', hubModal.form.title);
        formData.append('contentType', hubModal.form.type);
        formData.append('zoomMeetingId', hubModal.form.zoomMeetingId);
        formData.append('startTime', hubModal.form.startTime);
        formData.append('endTime', hubModal.form.endTime);
        formData.append('contentGroupId', hubModal.form.contentGroupId);
        formData.append('isFree', hubModal.form.isFree);
        formData.append('paperTime', hubModal.form.paperTime);
        formData.append('questionCount', hubModal.form.questionCount);
        formData.append('selectedCourses', JSON.stringify(hubModal.form.selectedCourses)); 
        
        if (hubModal.form.file) formData.append('file', hubModal.form.file);
        else formData.append('link', hubModal.form.link);
    }

    try {
      await api.post('/tasks/complete', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success("Task Content Sent to Manager for Approval!");
      setHubModal(prev => ({...prev, isOpen: false, task: null}));
      fetchMyTasks(); 
    } catch (error) { toast.error("Failed to submit task."); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3"><CheckCircle2 className="text-blue-400" size={32}/> {isAdmin ? "Staff Tasks View" : "My Daily Tasks"}</h2>
          <p className="text-base text-slate-400 mt-2 font-medium">Manage and publish content for your assigned schedules.</p>
        </div>
        
        {/* 🔥 ADMIN FILTERS 🔥 */}
        {isAdmin && (
            <div className="flex flex-wrap gap-4 items-center">
                <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Building2 size={16}/> Business</label>
                    <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2.5 outline-none mt-1" value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)}>
                        <option value="all">All Businesses</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">Batch</label>
                    <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2.5 outline-none mt-1" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                        <option value="all">All Batches</option>
                        {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="bg-slate-800/40 border border-white/10 p-3 rounded-2xl flex flex-col shadow-lg">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Filter size={16}/> Staff</label>
                    <select className="bg-black/30 border border-white/10 text-white text-base rounded-xl px-4 py-2.5 outline-none mt-1" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                        <option value="all">All Coordinators</option>
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.fName} {s.lName}</option>)}
                    </select>
                </div>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {tasks.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-slate-800/40 rounded-3xl border border-white/5"><CheckCircle2 size={64} className="mx-auto mb-6 text-emerald-500/50" /><h3 className="text-2xl font-bold text-slate-300">No tasks assigned.</h3></div>
        ) : (
          tasks.map(task => {
            const isLocked = task.is_locked;
            const isWaiting = task.manager_status === 'WAITING_APPROVAL';
            const isApproved = task.manager_status === 'APPROVED';
            const isRejected = task.manager_status === 'REJECTED';
            const deadlineDate = new Date(task.deadline_date);
            const isOverdue = new Date() > deadlineDate && !task.is_completed;
            
            const taskTypeMap = { 'live': 'Live Class', 'recording': 'Recording', 'document': 'PDF / Document', 'sPaper': 'Structured Paper', 'paper': 'MCQ Paper' };
            const niceType = taskTypeMap[task.task_type] || task.task_type;

            return (
              <div key={task.id} className={`p-6 md:p-8 rounded-3xl border shadow-xl relative flex flex-col transition-all ${isLocked ? 'bg-red-950/20 border-red-900/50' : isApproved ? 'bg-emerald-950/20 border-emerald-900/50' : isWaiting ? 'bg-orange-950/20 border-orange-900/50' : isRejected ? 'bg-rose-950/20 border-rose-500/50' : 'bg-slate-800/60 border-white/10 hover:border-blue-500/50'}`}>
                
                <div className="flex justify-between items-start mb-6">
                  <span className="text-sm font-black uppercase tracking-widest px-4 py-1.5 rounded-lg bg-black/40 border border-white/5 shadow-sm text-white">{niceType}</span>
                  {isLocked && <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg"><Lock size={14}/> Locked</span>}
                  {isWaiting && <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-lg"><Clock size={14}/> Under Review</span>}
                  {isApproved && <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg"><CheckCircle2 size={14}/> Published</span>}
                </div>

                <h3 className="text-xl font-bold text-white mb-4 leading-tight">{task.description}</h3>
                
                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-6 bg-slate-950/40 w-max px-4 py-2 rounded-xl border border-white/5">
                  <Clock size={18} className={isOverdue && !isApproved && !isWaiting ? 'text-red-500' : 'text-blue-400'}/> 
                  <span className={isOverdue && !isApproved && !isWaiting ? 'text-red-400' : ''}>Deadline: {task.end_time || deadlineDate.toLocaleTimeString()}</span>
                </div>

                {isRejected && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <p className="text-xs uppercase font-bold text-rose-400 mb-2 flex items-center gap-2"><AlertTriangle size={16}/> Manager Rejected</p>
                    <p className="text-sm font-semibold text-rose-200">{task.reject_reason}</p>
                  </div>
                )}

                <div className="mt-auto pt-4 border-t border-white/10">
                  {isLocked ? (
                    <button className="w-full bg-red-500/10 text-red-400 font-bold text-base py-4 rounded-2xl border border-red-500/30 cursor-not-allowed">
                      Task Locked (Missed Deadline)
                    </button>
                  ) : isApproved || isWaiting ? (
                    <div className="w-full bg-black/30 text-slate-400 font-bold text-base py-4 rounded-2xl border border-white/5 text-center">Task Submitted</div>
                  ) : (
                    <button onClick={() => openTaskHub(task)} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg py-4 rounded-2xl shadow-xl hover:scale-[1.02] flex items-center justify-center gap-3 transition-transform">
                      <UploadCloud size={22}/> {isRejected ? 'Open Content Hub to Fix' : 'Open Content Hub Workspace'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {hubModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 shrink-0">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3"><MonitorPlay className="text-blue-400"/> Content Workspace</h3>
                        <p className="text-sm text-slate-400 mt-1">{hubModal.task?.description}</p>
                    </div>
                    <button onClick={() => setHubModal(prev => ({...prev, isOpen: false}))} className="text-slate-400 hover:text-white bg-white/5 p-3 rounded-xl transition-all hover:bg-red-500"><X size={24}/></button>
                </div>

                {hubModal.loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <Loader2 size={50} className="animate-spin text-blue-500 mb-4"/>
                        <p className="text-slate-400">Loading Subject Resources...</p>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                        
                        {/* LEFT PANEL: EXISTING CONTENTS */}
                        <div className="flex-1 lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-800/20 p-6 overflow-y-auto custom-scrollbar">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 sticky top-0 bg-slate-900/90 py-2 z-10">Existing Subject Contents</h4>
                            
                            {hubModal.folders.filter(f => parseInt(f.type) === hubModal.form.type).length === 0 && hubModal.contents.filter(c => parseInt(c.type) === hubModal.form.type).length === 0 ? (
                                <p className="text-center text-slate-500 py-10">No existing contents for this type.</p>
                            ) : (
                                <div className="space-y-4">
                                    {hubModal.folders.filter(f => parseInt(f.type) === hubModal.form.type).map(folder => (
                                        <div key={folder.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                            <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                                                <FolderOpen className="text-blue-400" size={20}/>
                                                <h5 className="font-bold text-white">{folder.title}</h5>
                                            </div>
                                            <div className="space-y-2">
                                                {hubModal.contents.filter(c => String(c.content_group_id) === String(folder.id) && parseInt(c.type) === hubModal.form.type).map(content => (
                                                    <div key={content.id} className="flex justify-between items-center bg-black/30 p-3 rounded-xl border border-white/5 hover:border-white/10">
                                                        <div className="overflow-hidden pr-2">
                                                            <p className="text-sm font-bold text-slate-200 truncate">{content.title}</p>
                                                            <p className="text-[10px] text-slate-400">{content.date ? content.date.split('T')[0] : 'No Date'}</p>
                                                        </div>
                                                        <button onClick={() => setPreviewData(content)} className="bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">VIEW</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT PANEL: FULL TASK SUBMISSION FORM */}
                        <div className="flex-[2] p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-900">
                            <form onSubmit={handleHubSubmit} className="space-y-8 max-w-4xl mx-auto">
                                
                                <label className="flex items-center gap-4 cursor-pointer w-full group bg-orange-500/10 p-5 rounded-2xl border border-orange-500/20 hover:border-orange-500/40 transition-colors">
                                    <div className="relative flex items-center justify-center">
                                        <input type="checkbox" checked={hubModal.noChanges} onChange={(e) => setHubModal(prev => ({...prev, noChanges: e.target.checked}))} className="peer w-6 h-6 appearance-none bg-black/40 border-2 border-orange-500 rounded-lg checked:bg-orange-500" />
                                        <CheckCircle2 size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                    </div>
                                    <div>
                                        <span className="text-base font-bold text-orange-400">No Changes Needed</span>
                                        <p className="text-xs text-orange-200/60 mt-1">Tick this if the content is already updated in the system.</p>
                                    </div>
                                </label>

                                {!hubModal.noChanges && (
                                    <div className="space-y-8 animate-in fade-in duration-300">

                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="flex-1">
                                                <label className="text-sm font-semibold text-slate-300 mb-2 block uppercase tracking-wider">Content Type</label>
                                                <select disabled value={hubModal.form.type} className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-white outline-none cursor-not-allowed opacity-70">
                                                    <option value={1}>Live Class</option>
                                                    <option value={2}>Recording</option>
                                                    <option value={3}>Document / PDF</option>
                                                    <option value={4}>Structured Paper</option>
                                                    <option value={5}>MCQ Paper</option>
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Target Folder</label>
                                                    <button type="button" onClick={() => setNewFolderModal({ isOpen: true, title: '', order: hubModal.folders.filter(f => parseInt(f.type) === hubModal.form.type).length + 1 })} className="text-xs font-bold text-blue-400 hover:text-white flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded-lg transition-colors"><Plus size={12}/> New Folder</button>
                                                </div>
                                                <select value={hubModal.form.contentGroupId} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, contentGroupId: e.target.value}}))} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-green-500">
                                                    <option value="" className="bg-slate-800">No Folder (Uncategorized)</option>
                                                    {hubModal.folders.filter(f => parseInt(f.type) === hubModal.form.type).map(f => (
                                                        <option key={f.id} value={f.id} className="bg-slate-800">{f.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10">
                                            <div className="md:col-span-2">
                                                <label className="text-sm font-semibold text-slate-300 mb-2 block">Title *</label>
                                                <input type="text" required value={hubModal.form.title} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, title: e.target.value}}))} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-base text-white outline-none focus:border-green-500" />
                                            </div>
                                            
                                            {(hubModal.form.type === 1 || hubModal.form.type === 2) && (
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-semibold text-slate-300 mb-2 block">URL Link *</label>
                                                    <input type="url" required value={hubModal.form.link} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, link: e.target.value}}))} placeholder="Zoom / YouTube Link..." className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-base text-white outline-none focus:border-green-500" />
                                                </div>
                                            )}

                                            {hubModal.form.type === 2 && (
                                                <div>
                                                    <label className="text-sm font-semibold text-slate-300 mb-2 block">Meeting ID (Optional)</label>
                                                    <input type="text" value={hubModal.form.zoomMeetingId} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, zoomMeetingId: e.target.value}}))} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-base text-white outline-none focus:border-green-500" />
                                                </div>
                                            )}

                                            {(hubModal.form.type === 3 || hubModal.form.type === 4 || hubModal.form.type === 5) && (
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-semibold text-slate-300 mb-2 block">File Upload *</label>
                                                    <input type="file" required onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, file: e.target.files[0]}}))} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-base text-white file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:bg-white/10 file:text-white" />
                                                </div>
                                            )}

                                            {hubModal.form.type === 1 && (
                                                <>
                                                    <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Start Time</label><input type="time" value={hubModal.form.startTime} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, startTime: e.target.value}}))} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                                    <div><label className="text-sm font-semibold text-slate-300 mb-2 block">End Time</label><input type="time" value={hubModal.form.endTime} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, endTime: e.target.value}}))} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                                </>
                                            )}

                                            {hubModal.form.type === 5 && (
                                                <>
                                                    <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Time (Min) *</label><input type="number" required value={hubModal.form.paperTime} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, paperTime: e.target.value}}))} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                                    <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Questions *</label><input type="number" required value={hubModal.form.questionCount} onChange={e => setHubModal(prev => ({...prev, form: {...prev.form, questionCount: e.target.value}}))} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                                </>
                                            )}

                                            <div className="md:col-span-2 mt-2">
                                                <label className="flex items-center gap-4 cursor-pointer w-max group bg-black/40 p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-colors">
                                                    <div className="relative flex items-center justify-center">
                                                        <input type="checkbox" checked={hubModal.form.isFree} onChange={(e) => setHubModal(prev => ({...prev, form: {...prev.form, isFree: e.target.checked}}))} className="peer w-6 h-6 appearance-none bg-black/60 border-2 border-slate-500 rounded-lg checked:bg-green-500 checked:border-green-500" />
                                                        <CheckCircle2 size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                                    </div>
                                                    <span className="text-base font-bold text-slate-200 group-hover:text-white">Mark as Free Content (Open for all)</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* 🔥 ASSIGN TO GROUPS 🔥 */}
                                        <div className="pt-6">
                                            <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-3"><BookOpen size={24} className="text-blue-500"/> Assign to Groups</h4>
                                            <div className="bg-white/5 rounded-3xl p-6 md:p-8 border border-white/10">
                                                {hubModal.matchingCourses.length === 0 ? (
                                                    <p className="text-red-400 font-medium">No matching groups found.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        {hubModal.matchingCourses.map((mc, idx) => (
                                                            <label key={idx} className={`flex items-center gap-4 cursor-pointer p-5 rounded-2xl border transition-colors group ${hubModal.form.selectedCourses.includes(mc.courseId) ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10' : 'bg-black/20 border-white/10 hover:border-white/20'}`}>
                                                                <div className="relative flex items-center justify-center shrink-0">
                                                                    <input type="checkbox" checked={hubModal.form.selectedCourses.includes(mc.courseId)} onChange={() => toggleCourseSelection(mc.courseId)} className="peer w-6 h-6 appearance-none bg-black/40 border-2 border-slate-500 rounded-lg checked:bg-blue-500 checked:border-blue-500" />
                                                                    <CheckCircle2 size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                                                </div>
                                                                <div>
                                                                    <span className={`text-base font-bold truncate block ${hubModal.form.selectedCourses.includes(mc.courseId) ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{mc.groupName}</span>
                                                                    <span className="text-[11px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 mt-1 inline-block">{mc.groupType === 1 ? 'Monthly' : 'Full Payment'}</span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}

                                <div className="pt-6 border-t border-white/10">
                                    <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 text-xl rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.01]">
                                        <CheckCircle2 size={28}/> {hubModal.noChanges ? "Complete Task (No Changes)" : "Submit Content & Complete Task"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {newFolderModal.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl backdrop-blur-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-3"><FolderPlus className="text-blue-400"/> Create New Folder</h3>
                      <button onClick={() => setNewFolderModal({isOpen: false, title: '', order: 1})} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleCreateFolder} className="space-y-5">
                      <div><label className="text-sm text-slate-300 mb-2 block">Folder Name</label><input type="text" required value={newFolderModal.title} onChange={e => setNewFolderModal({...newFolderModal, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                      <div><label className="text-sm text-slate-300 mb-2 block">Order Number</label><input type="number" required value={newFolderModal.order} onChange={e => setNewFolderModal({...newFolderModal, order: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg">Save Folder</button>
                  </form>
              </div>
          </div>
      )}

      {/* PREVIEW MODAL */}
      {previewData && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-2xl">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-3"><MonitorPlay size={24} className="text-blue-400"/> {previewData.title}</h3>
                      <div className="flex gap-3">
                          <a href={previewData.link || `http://72.62.249.211:5000/documents/${previewData.fileName}`} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"><ExternalLink size={18}/> Open External</a>
                          <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500 border border-white/5 p-2.5 rounded-xl transition-colors"><X size={20}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-black/40 p-4 relative flex items-center justify-center">
                      {previewData.fileName ? (
                          <iframe src={`http://72.62.249.211:5000/documents/${previewData.fileName}`} className="w-full h-full rounded-2xl bg-white" title="Document Preview" />
                      ) : previewData.link ? (
                          <iframe src={getEmbedUrl(previewData.link)} className="w-full h-full rounded-2xl bg-black border border-white/10" title="Video/Live Preview" allowFullScreen />
                      ) : (<div className="text-center text-slate-500"><Ban size={48} className="mx-auto mb-4 opacity-50"/><p className="text-lg font-medium">No preview available.</p></div>)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}