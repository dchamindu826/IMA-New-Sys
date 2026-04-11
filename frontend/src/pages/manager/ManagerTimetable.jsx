import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Loader2, X, BookOpen, Trash2, Clock, CalendarDays, ChevronDown, Building2 } from 'lucide-react';
import api from '../../api/axios';

export default function ManagerTimetable() {
  const [loading, setLoading] = useState(true);

  const loggedInUser = JSON.parse(localStorage.getItem('user'));
  const isAdmin = ['System Admin', 'Director', 'Admin'].includes(loggedInUser?.role);

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all'); 
  const [allBatches, setAllBatches] = useState([]); 
  const [filteredBatches, setFilteredBatches] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState('');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [subjects, setSubjects] = useState([]); 

  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDayViewModal, setShowDayViewModal] = useState(false); 

  // 🔥 UPDATE 2: Checkboxes for Content Tasks 🔥
  const [scheduleForm, setScheduleForm] = useState({ 
      subjectId: '', subjectName: '', content: '', startTime: '', endTime: '', accessType: 'Monthly/Full Payment',
      selectedTasks: ['live', 'recording', 'document'] 
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const batchRes = await api.get('/admin/manager/batches-full');
        const fetchedBatches = Array.isArray(batchRes.data) ? batchRes.data : [];
        setAllBatches(fetchedBatches);

        if (isAdmin) {
            const bizRes = await api.get('/admin/businesses');
            setBusinesses(Array.isArray(bizRes.data) ? bizRes.data : (bizRes.data?.businesses || []));
        }
      } catch (error) { toast.error("Failed to load data"); } finally { setLoading(false); }
    };
    fetchInitialData();
  }, [isAdmin]);

  useEffect(() => {
      if (!allBatches || allBatches.length === 0) { setFilteredBatches([]); setSelectedBatch(''); return; }
      if (!isAdmin || selectedBusiness === 'all' || !selectedBusiness) {
          setFilteredBatches(allBatches);
          if (allBatches.length > 0) setSelectedBatch(String(allBatches[0].id));
      } else {
          const bList = allBatches.filter(b => {
              let bId = b.business?.id ?? b.Business?.id ?? b.business_id ?? b.businessId;
              if (bId && typeof bId === 'object' && bId.value) bId = bId.value;
              return String(bId) === String(selectedBusiness);
          });
          setFilteredBatches(bList);
          if (bList.length > 0) setSelectedBatch(String(bList[0].id));
          else setSelectedBatch('');
      }
  }, [selectedBusiness, allBatches, isAdmin]);

  useEffect(() => {
    if(!selectedBatch) { setSubjects([]); setSchedules([]); return; }
    const fetchBatchDetails = async () => {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      try {
        const batchDetails = allBatches.find(b => String(b.id) === String(selectedBatch));
        let allSubjects = [];
        if (batchDetails && batchDetails.groups) {
            batchDetails.groups.forEach(g => { if (g.courses) g.courses.forEach(c => allSubjects.push(c)); });
        }
        setSubjects(allSubjects);
        const schedRes = await api.get(`/tasks/manager/schedule?batchId=${selectedBatch}&year=${year}&month=${month}`);
        setSchedules(Array.isArray(schedRes.data) ? schedRes.data : []);
      } catch (error) {}
    };
    fetchBatchDetails();
  }, [selectedBatch, currentDate, allBatches]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const todaysDateString = new Date().toISOString().split('T')[0];
  const todaysProgram = schedules.filter(s => s.date === todaysDateString);

  const openScheduleModal = () => {
    setScheduleForm({ subjectId: '', subjectName: '', content: '', startTime: '', endTime: '', accessType: 'Monthly/Full Payment', selectedTasks: ['live', 'recording', 'document'] });
    setShowDayViewModal(false);
    setShowScheduleModal(true);
  };

  const toggleTaskSelection = (taskVal) => {
      setScheduleForm(prev => {
          const exists = prev.selectedTasks.includes(taskVal);
          return { ...prev, selectedTasks: exists ? prev.selectedTasks.filter(t => t !== taskVal) : [...prev.selectedTasks, taskVal] };
      });
  };

  const handleSaveSchedule = async (e) => {
      e.preventDefault();
      if (!scheduleForm.subjectName) return toast.error("Please select a subject!");
      if (scheduleForm.selectedTasks.length === 0) return toast.error("Select at least one content task to generate!");

      try {
          const finalContent = `${scheduleForm.content} [${scheduleForm.accessType}]`;
          const payload = { 
              batchId: selectedBatch, date: selectedDay, subject: scheduleForm.subjectName, 
              content: finalContent, startTime: scheduleForm.startTime, endTime: scheduleForm.endTime,
              selectedTasks: scheduleForm.selectedTasks
          }; 
          const res = await api.post('/tasks/manager/schedule/add', payload);
          toast.success("Class Scheduled & Tasks Assigned to Pending!");
          
          setSchedules([...schedules, { id: res.data?.id || Math.random(), date: selectedDay, title: scheduleForm.subjectName, start_time: scheduleForm.startTime, end_time: scheduleForm.endTime, content: finalContent }]);
          setShowScheduleModal(false);
      } catch (error) { toast.error("Failed to save schedule."); }
  };

  const handleDeleteSchedule = async (id) => {
      if(!window.confirm("Are you sure? All tasks will be deleted too.")) return;
      try {
          await api.delete(`/tasks/manager/schedule/${id}`);
          setSchedules(schedules.filter(s => s.id !== id));
          toast.success("Class deleted!");
          setShowDayViewModal(false);
      } catch (error) {}
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={40} className="animate-spin text-blue-400" /></div>;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 relative h-full flex flex-col pb-4">
      
      <div className="flex justify-between items-start mb-6">
        <div><h2 className="text-3xl font-bold text-white drop-shadow-md flex items-center gap-3"><CalendarIcon className="text-blue-400" size={28}/> Master Timetable</h2></div>
        <div className="flex gap-3">
            {isAdmin && (
                <div className="bg-slate-800/40 border border-white/10 p-2 rounded-2xl flex flex-col shadow-lg">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-1"><Building2 size={12}/> Business</label>
                    <select className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-4 py-2 outline-none mt-1 cursor-pointer" value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)}>
                        <option value="all">All Businesses</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            )}
            <div className="bg-slate-800/40 border border-white/10 p-2 rounded-2xl flex flex-col shadow-lg">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Batch</label>
                <select className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-4 py-2 outline-none mt-1 cursor-pointer focus:border-blue-400" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                    {filteredBatches.length === 0 ? <option value="">No Batches Found</option> : filteredBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
          <div className="flex-1 bg-slate-800/40 border border-white/10 rounded-3xl shadow-xl flex flex-col overflow-hidden relative">
            <div className="flex justify-between items-center p-5 border-b border-white/5 bg-black/10">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><ChevronLeft size={20} className="text-blue-400" /></button>
                <h3 className="text-xl font-black text-white tracking-widest uppercase">{currentDate.toLocaleString('default', { month: 'long' })} <span className="text-blue-400">{year}</span></h3>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><ChevronRight size={20} className="text-blue-400" /></button>
            </div>
            <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2 bg-white/5 rounded-lg">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
                    {emptyDays.map(d => <div key={`empty-${d}`} className="bg-white/5 rounded-xl border border-white/5 opacity-50"></div>)}
                    {daysArray.map(day => {
                        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = todaysDateString === dateString;
                        const daySchedules = schedules.filter(s => s.date === dateString);

                        return (
                            <div key={day} onClick={() => { setSelectedDay(dateString); setShowDayViewModal(true); }} className={`bg-black/20 rounded-xl border p-2 cursor-pointer transition-all group relative min-h-[90px] flex flex-col ${isToday ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-white/5 hover:border-blue-400/30'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-500 text-white' : 'text-slate-300'}`}>{day}</span>
                                    {selectedBatch && <button onClick={(e) => { e.stopPropagation(); setSelectedDay(dateString); openScheduleModal(); }} className="text-slate-500 hover:text-emerald-400 transition-colors bg-white/5 p-1 rounded-md opacity-0 group-hover:opacity-100"><Plus size={14}/></button>}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1 mt-1 pointer-events-none">
                                    {daySchedules.slice(0, 3).map(sch => (
                                        <div key={sch.id} className="text-[9px] p-1.5 rounded border bg-blue-500/20 border-blue-500/30 text-blue-200 font-bold truncate">{sch.title || sch.subject}</div>
                                    ))}
                                    {daySchedules.length > 3 && <span className="text-[9px] text-slate-500 text-center block">+{daySchedules.length - 3} more</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>

          <div className="lg:w-[350px] w-full bg-slate-800/40 border border-white/10 rounded-3xl shadow-xl flex flex-col overflow-hidden">
              <div className="bg-blue-900/20 p-5 border-b border-blue-500/20">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><Clock size={16} className="text-blue-400"/> Today's Program</h3>
                  <p className="text-[10px] text-blue-300 mt-1">{new Date().toDateString()}</p>
              </div>
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                  {todaysProgram.length === 0 ? <p className="text-xs text-slate-400 text-center mt-10">No classes scheduled for today.</p> : 
                      todaysProgram.map(cls => (
                          <div key={cls.id} className="p-4 bg-black/30 border border-white/10 rounded-xl hover:border-blue-500/30 transition-all border-l-4 border-l-blue-500">
                              <h4 className="text-sm font-bold text-white mb-1">{cls.subject || cls.title}</h4>
                              <p className="text-xs text-slate-400 mb-3">{cls.content}</p>
                              <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">{cls.start_time} - {cls.end_time}</span>
                          </div>
                      ))
                  }
              </div>
          </div>
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-white/20 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
              <div><h3 className="text-xl font-bold text-white mb-1">Schedule Class</h3><p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{selectedDay}</p></div>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-red-400 bg-white/5 p-2 rounded-xl"><X size={20} /></button>
            </div>
            
            <div className="flex-1 p-6">
              <form id="schedule-form" onSubmit={handleSaveSchedule} className="space-y-5">
                  <div className="relative">
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Subject</label>
                      <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white flex justify-between items-center cursor-pointer">
                          <span>{scheduleForm.subjectName || "Select Subject..."}</span> <ChevronDown size={16}/>
                      </div>
                      {isDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[200px]">
                              <div className="p-2 border-b border-white/10 bg-slate-900/50 rounded-t-xl sticky top-0"><input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onClick={e => e.stopPropagation()} className="w-full bg-transparent border-none p-1 text-sm text-white outline-none" /></div>
                              <div className="overflow-y-auto p-1 custom-scrollbar">
                                  {subjects.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(sub => (
                                      <div key={sub.id} onClick={() => { setScheduleForm({...scheduleForm, subjectId: sub.id, subjectName: sub.name}); setIsDropdownOpen(false); }} className="p-3 hover:bg-blue-600/30 rounded-lg cursor-pointer text-sm text-slate-200">{sub.name}</div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  <div>
                      <label className="text-xs font-bold text-slate-400 mb-1.5 block">Class Access Type</label>
                      <select required value={scheduleForm.accessType} onChange={e => setScheduleForm({...scheduleForm, accessType: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-400">
                          <option value="Monthly/Full Payment">Monthly / Full Payment Only</option>
                          <option value="Free Class">Free Class (Open to all)</option>
                      </select>
                  </div>
                  
                  <div><label className="text-xs font-bold text-slate-400 mb-1.5 block">Content to Cover</label><input required type="text" value={scheduleForm.content} onChange={e => setScheduleForm({...scheduleForm, content: e.target.value})} placeholder="E.g. Part 1 Discussion" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-400" /></div>
                  <div className="grid grid-cols-2 gap-5">
                      <div><label className="text-xs font-bold text-slate-400 mb-1.5 block">Start Time</label><input required type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm({...scheduleForm, startTime: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none" /></div>
                      <div><label className="text-xs font-bold text-slate-400 mb-1.5 block">End Time</label><input required type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm({...scheduleForm, endTime: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none" /></div>
                  </div>

                  {/* 🔥 Content Tasks Checkboxes 🔥 */}
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-white/10">
                      <label className="text-xs font-bold text-slate-400 mb-3 block uppercase tracking-widest">Generate Tasks for Staff</label>
                      <div className="grid grid-cols-2 gap-3">
                          {[ { id: 'live', label: 'Live Class' }, { id: 'recording', label: 'Recording' }, { id: 'document', label: 'PDF / Document' }, { id: 'sPaper', label: 'Structured Paper' }, { id: 'paper', label: 'MCQ Paper' } ].map(t => (
                              <label key={t.id} className="flex items-center gap-3 cursor-pointer group">
                                  <input type="checkbox" checked={scheduleForm.selectedTasks.includes(t.id)} onChange={() => toggleTaskSelection(t.id)} className="w-4 h-4 accent-blue-500 rounded" />
                                  <span className="text-sm font-medium text-slate-300 group-hover:text-white">{t.label}</span>
                              </label>
                          ))}
                      </div>
                  </div>
              </form>
            </div>
            <div className="p-5 border-t border-white/10 bg-black/40">
               <button type="submit" form="schedule-form" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all hover:scale-[1.01]">Confirm Schedule & Assign Tasks</button>
            </div>
          </div>
        </div>
      )}

      {showDayViewModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                 <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                     <div><h3 className="text-white text-xl font-bold flex items-center gap-2"><CalendarDays className="text-blue-400"/> Scheduled Classes</h3><p className="text-blue-300 text-sm mt-1">{selectedDay}</p></div>
                     <button onClick={() => setShowDayViewModal(false)} className="text-slate-400 hover:text-red-400 bg-white/5 p-2 rounded-xl"><X size={20}/></button>
                 </div>
                 
                 <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
                     {schedules.filter(s => s.date === selectedDay).length === 0 ? (
                         <div className="text-center py-10"><p className="text-slate-400 text-sm">No classes scheduled.</p><button onClick={openScheduleModal} className="mt-4 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-4 py-2 rounded-lg text-sm font-bold transition-all">+ Schedule Class</button></div>
                     ) : (
                         schedules.filter(s => s.date === selectedDay).map(sch => (
                             <div key={sch.id} className="p-4 bg-slate-800/50 border border-white/10 rounded-2xl flex justify-between items-start">
                                 <div>
                                     <h4 className="text-lg font-bold text-white mb-1">{sch.subject || sch.title}</h4><p className="text-sm text-slate-300 mb-3">{sch.content}</p>
                                     <div className="flex items-center gap-3 text-xs font-bold text-blue-300 bg-blue-500/10 w-max px-3 py-1.5 rounded-lg border border-blue-500/20"><Clock size={14}/> {sch.start_time} - {sch.end_time}</div>
                                 </div>
                                 <button onClick={() => handleDeleteSchedule(sch.id)} className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl border border-red-500/20 transition-all flex items-center gap-2"><Trash2 size={16}/></button>
                             </div>
                         ))
                     )}
                 </div>
             </div>
         </div>
      )}

    </div>
  );
}