import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from "../../config";
import { X, Save, Trash2, PlusCircle, Play } from 'lucide-react';

export default function ManagerAssignModal({ onClose, selectedBatch }) {
  const [autoAssignOn, setAutoAssignOn] = useState(false);
  const [staff, setStaff] = useState([]);
  
  const [agentId, setAgentId] = useState('');
  const [leadCount, setLeadCount] = useState('');
  const [assignType, setAssignType] = useState('first'); 

  const [autoQueue, setAutoQueue] = useState([{ id: Date.now(), staffId: '', quota: 10 }]);

  useEffect(() => {
    const fetchStaffAndConfig = async () => {
      try {
        const t = localStorage.getItem('token') || localStorage.getItem('jwt');
        const headers = { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` };

        const staffRes = await axios.get(`${API_BASE_URL}/api/team/agents`, { headers });
        setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);

        try {
            const configRes = await axios.get(`${API_BASE_URL}/api/crm/auto-assign/${selectedBatch}`, { headers });
            if (configRes.data) {
              setAutoAssignOn(configRes.data.is_active);
              if (configRes.data.staff_order && configRes.data.staff_order.length > 0) {
                setAutoQueue(configRes.data.staff_order);
              }
            }
        } catch (configErr) {
            console.warn("Auto Assign Config not found");
        }
      } catch (error) { console.error("Error fetching data", error); }
    };
    if (selectedBatch) fetchStaffAndConfig();
  }, [selectedBatch]);

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    if(!agentId || !leadCount) return toast.error("Please fill all fields");

    const toastId = toast.loading("Assigning leads...");
    try {
      const t = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/crm/leads/bulk-assign`, {
        assignType: assignType,
        count: parseInt(leadCount),
        agentId: agentId,
        batchId: selectedBatch
      }, { headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } });
      
      toast.success("Leads assigned successfully! ✅", { id: toastId });
      setLeadCount('');
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign leads", { id: toastId });
    }
  };

  const handleSaveAutoQueue = async (e) => {
    if (e) e.preventDefault();
    if (autoAssignOn && autoQueue.some(q => !q.staffId || !q.quota)) {
      return toast.error("Please fill all Agent names and Quotas in the queue.");
    }
    const toastId = toast.loading("Saving Auto-Queue rules...");
    try {
      const t = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/crm/auto-assign`, {
        batch_id: selectedBatch,
        is_active: autoAssignOn,
        staff_order: autoQueue
      }, { headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } });
      toast.success("Auto Assign rules updated! 🚀", { id: toastId });
    } catch (error) { toast.error("Failed to save rules", { id: toastId }); }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      
      {/* 🔥 FIX: Changed to flex-col and max-h-[90vh] with hidden overflow to keep header fixed! 🔥 */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden relative">
        
        {/* HEADER - STRICTLY FIXED */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0 z-10 sticky top-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Lead Assignment Rules</h2>
            <p className="text-slate-400 text-xs mt-1">Configure how incoming leads are distributed among your team.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500/20 hover:text-red-400 p-2.5 rounded-xl transition-all shadow-sm group">
             <X size={20} className="group-hover:scale-110 transition-transform"/>
          </button>
        </div>

        {/* BODY - ONLY THIS AREA SCROLLS */}
        <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1 bg-slate-950/50">
          
          <section className="bg-slate-900 p-6 rounded-2xl border border-blue-500/20 shadow-lg relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 relative z-10">
              <div>
                <h3 className="text-blue-400 font-bold text-lg flex items-center gap-2">Auto Assign Queue (Round Robin)</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-xl">Automatically assign incoming fresh leads to staff based on a sequence and quota. When a staff's quota is met, it moves to the next.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={autoAssignOn} onChange={() => setAutoAssignOn(!autoAssignOn)} />
                <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500 border border-slate-700"></div>
                <span className={`ml-3 text-sm font-bold ${autoAssignOn ? 'text-blue-400' : 'text-slate-500'}`}>{autoAssignOn ? 'ACTIVE' : 'OFF'}</span>
              </label>
            </div>

            {autoAssignOn && (
              <div className="mt-6 border-t border-slate-800 pt-6 relative z-10">
                <div className="grid grid-cols-12 gap-4 text-[10px] uppercase font-bold text-slate-500 mb-3 px-4 tracking-widest">
                  <div className="col-span-1 text-center">Ord</div>
                  <div className="col-span-6">Staff Member</div>
                  <div className="col-span-3 text-center">Assign Quota</div>
                  <div className="col-span-2 text-center">Action</div>
                </div>
                
                <div className="space-y-3">
                  {autoQueue.map((queueItem, index) => (
                    <div key={queueItem.id} className="grid grid-cols-12 gap-4 items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all">
                      <div className="col-span-1 text-center">
                          <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-white font-black text-xs mx-auto shadow-inner">{index + 1}</span>
                      </div>
                      <div className="col-span-6">
                        <select required className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 outline-none text-sm focus:border-blue-500 transition-colors"
                          value={queueItem.staffId} onChange={(e) => setAutoQueue(autoQueue.map(q => q.id === queueItem.id ? { ...q, staffId: e.target.value } : q))}
                        >
                          <option value="">-- Select Staff Member --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.fName || s.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" required min="1" className="w-full p-2.5 bg-slate-900 rounded-lg text-white border border-slate-700 outline-none text-sm text-center font-bold focus:border-blue-500 transition-colors" 
                          value={queueItem.quota} onChange={(e) => setAutoQueue(autoQueue.map(q => q.id === queueItem.id ? { ...q, quota: e.target.value } : q))}
                        />
                      </div>
                      <div className="col-span-2 text-center">
                        {autoQueue.length > 1 && (
                          <button type="button" onClick={() => setAutoQueue(autoQueue.filter(q => q.id !== queueItem.id))} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors mx-auto block" title="Remove from queue">
                            <Trash2 size={16}/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 gap-4">
                  <button type="button" onClick={() => setAutoQueue([...autoQueue, { id: Date.now(), staffId: '', quota: 5 }])} className="text-blue-400 text-sm font-bold hover:text-blue-300 bg-blue-500/10 px-4 py-2.5 rounded-xl border border-blue-500/20 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
                      <PlusCircle size={16}/> Add to Queue
                  </button>
                  <button type="button" onClick={handleSaveAutoQueue} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-[0_0_15px_rgba(37,99,235,0.4)] text-sm transition-all flex items-center gap-2 w-full sm:w-auto justify-center">
                      <Save size={16}/> Save Auto-Assign Rules
                  </button>
                </div>
              </div>
            )}
            {!autoAssignOn && (
               <div className="text-right mt-4 pt-4 border-t border-slate-800 relative z-10">
                 <button type="button" onClick={handleSaveAutoQueue} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all border border-slate-600 text-sm flex items-center gap-2 ml-auto">
                     <Save size={16}/> Save (Turned OFF)
                 </button>
               </div>
            )}
          </section>

          <section className="bg-slate-900 p-6 rounded-2xl border border-purple-500/20 shadow-lg relative overflow-hidden">
             <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <h3 className="text-purple-400 font-bold text-lg mb-1 relative z-10">Bulk Assign 'New' Leads</h3>
            <p className="text-slate-400 text-xs mb-6 relative z-10">Manually push unassigned "New" leads from the current batch to a specific staff member.</p>
            
            <form onSubmit={handleBulkAssign} className="bg-slate-800/40 p-5 rounded-xl border border-slate-700/50 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Select Order</label>
                        <select value={assignType} onChange={(e) => setAssignType(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-purple-500 text-sm transition-colors cursor-pointer">
                            <option value="first">Oldest First</option>
                            <option value="last">Newest First</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Leads Count</label>
                        <input type="number" required min="1" value={leadCount} onChange={e => setLeadCount(e.target.value)} placeholder="e.g. 50" className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none text-center focus:border-purple-500 text-sm font-bold transition-colors" />
                    </div>
                    <div className="md:col-span-4">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Assign To Staff</label>
                        <select required value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-purple-500 text-sm transition-colors cursor-pointer">
                            <option value="">-- Select Staff --</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.fName || s.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white p-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(147,51,234,0.4)] text-sm flex items-center justify-center gap-2">
                            <Play size={16}/> Execute
                        </button>
                    </div>
                </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}