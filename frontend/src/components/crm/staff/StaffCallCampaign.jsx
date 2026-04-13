import React, { useState, useEffect } from 'react';
import { Search, PhoneCall, MessageSquare, Save, Loader, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

export default function StaffCallCampaign({ activePhase, userId, adminBizFilter, adminStaffFilter, isSystemAdmin, openWhatsAppChat }) {
  const [callLeads, setCallLeads] = useState([]);
  const [callData, setCallData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [activeCallPhaseTab, setActiveCallPhaseTab] = useState(1); // 1, 2, or 3

  const fetchCallLeads = async () => {
    setLoading(true);
    try {
      let url = `/crm/calls/assigned?phase=${activePhase}`;
      if(isSystemAdmin && adminStaffFilter && adminStaffFilter !== 'All') {
          url += `&agentId=${adminStaffFilter}`;
      }
      
      const res = await api.get(url);
      const leads = res.data || [];
      setCallLeads(leads);
      
      const initialData = {};
      leads.forEach(lead => {
        initialData[lead.id] = { 
            method: 'WhatsApp', attempts: '1', 
            status: lead.last_log?.remark || 'Pending', feedback: lead.last_log?.note || '' 
        };
      });
      setCallData(initialData);
    } catch (error) { console.error("Error loading calls", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCallLeads(); }, [activePhase, adminStaffFilter]);

  const handleCallChange = (leadId, field, value) => {
    setCallData(prev => ({ ...prev, [leadId]: { ...prev[leadId], [field]: value } }));
  };

  const submitCallLog = async (lead) => {
    const data = callData[lead.id];
    if (!data.status) return toast.error("Please select a status");

    const toastId = toast.loading("Saving call log...");
    try {
      // 🔥 FIX: Backend එක ඉල්ලන නම් වලින්ම යවනවා 🔥
      const payload = {
          lead_id: lead.id,
          current_phase: lead.current_call_phase,
          method: data.method,
          attempts: data.attempts,
          remark: data.status,
          note: data.feedback
      };
      
      const res = await api.post('/crm/calls/log', payload);
      toast.success("Saved successfully!", { id: toastId });
      
      if (res.data.isCompleted) {
          setCallLeads(callLeads.filter(l => l.id !== lead.id));
      } else {
          fetchCallLeads(); 
      }
    } catch (error) { toast.error("Failed to save", { id: toastId }); }
  };

  const filteredLeads = callLeads.filter(l => {
    const matchesSearch = (l.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) || (l.phone_number?.includes(searchTerm));
    const matchesTab = l.current_call_phase === activeCallPhaseTab;
    return matchesSearch && matchesTab;
  });

  const phase1Count = callLeads.filter(l => l.current_call_phase === 1).length;
  const phase2Count = callLeads.filter(l => l.current_call_phase === 2).length;
  const phase3Count = callLeads.filter(l => l.current_call_phase === 3).length;

  const totalLeads = callLeads.length;
  const answered = callLeads.filter(l => callData[l.id]?.status === 'Answer').length;
  const rejected = callLeads.filter(l => callData[l.id]?.status === 'Reject').length;
  const pending = totalLeads - (answered + rejected);
  
  const chartData = [
    { name: 'Pending', value: pending, color: '#3b82f6' },
    { name: 'Answered', value: answered, color: '#10b981' },
    { name: 'Rejected', value: rejected, color: '#f43f5e' },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Assigned</p>
                <h3 className="text-3xl font-black text-white">{totalLeads}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400"><Activity size={24}/></div>
        </div>
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg">
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Covered / Answered</p>
                <h3 className="text-3xl font-black text-emerald-400">{answered}</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400"><PhoneCall size={24}/></div>
        </div>
        
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-2 col-span-1 md:col-span-2 shadow-lg flex items-center">
            <div style={{ minWidth: '96px', minHeight: '80px', width: '96px', height: '80px' }} className="shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value">
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'8px', fontSize:'12px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex-1 flex justify-around text-xs font-bold">
                <div className="text-center"><span className="text-blue-400 block text-lg">{pending}</span>Pending</div>
                <div className="text-center"><span className="text-rose-400 block text-lg">{rejected}</span>Rejected</div>
                <div className="text-center"><span className="text-emerald-400 block text-lg">{totalLeads > 0 ? Math.round((answered/totalLeads)*100) : 0}%</span>Response Rate</div>
            </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col relative z-10 overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 border-b border-white/5 pb-4 gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><PhoneCall className="text-emerald-400"/> Execution ({activePhase.replace('_', ' ')})</h3>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
              <button onClick={() => setActiveCallPhaseTab(1)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeCallPhaseTab === 1 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  Phase 1 <span className="bg-black/40 px-2 rounded">{phase1Count}</span>
              </button>
              <button onClick={() => setActiveCallPhaseTab(2)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeCallPhaseTab === 2 ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  Phase 2 <span className="bg-black/40 px-2 rounded">{phase2Count}</span>
              </button>
              <button onClick={() => setActiveCallPhaseTab(3)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeCallPhaseTab === 3 ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  Phase 3 <span className="bg-black/40 px-2 rounded">{phase3Count}</span>
              </button>
          </div>

          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={18}/>
              <input type="text" placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-base text-white outline-none focus:border-emerald-500 transition-colors" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-black/40 text-slate-400 text-xs uppercase tracking-widest font-bold sticky top-0 z-10">
              <tr>
                <th className="p-4 rounded-tl-xl">Customer</th>
                <th className="p-4">Method</th>
                <th className="p-4">Attempts</th>
                <th className="p-4">Status</th>
                <th className="p-4 w-1/4">Feedback</th>
                <th className="p-4 rounded-tr-xl text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                  <tr><td colSpan="6" className="text-center py-10"><Loader className="animate-spin text-emerald-500 mx-auto" size={32}/></td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-slate-500 text-base font-medium">No pending calls found in this phase.</td></tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                        {/* 🔥 FIX: Text Size Increased 🔥 */}
                        <div className="font-bold text-white text-base mb-1">{lead.customer_name || 'Unknown'}</div>
                        <div className="text-blue-400 text-sm font-mono tracking-wider">{lead.phone_number}</div>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.method} onChange={(e) => handleCallChange(lead.id, 'method', e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white outline-none text-sm w-full focus:border-emerald-500">
                        <option>WhatsApp</option><option>3CX</option><option>Direct</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.attempts} onChange={(e) => handleCallChange(lead.id, 'attempts', e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white outline-none text-sm focus:border-emerald-500">
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.status} onChange={(e) => handleCallChange(lead.id, 'status', e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white outline-none text-sm w-full focus:border-emerald-500 font-medium">
                        <option>Pending</option><option>Answer</option><option>No Answer</option><option>Reject</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <input type="text" placeholder="Type notes here..." value={callData[lead.id]?.feedback} onChange={(e) => handleCallChange(lead.id, 'feedback', e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white outline-none text-sm w-full focus:border-emerald-500" />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                          <button onClick={() => openWhatsAppChat(lead)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white p-2.5 rounded-lg transition-colors" title="Chat on WhatsApp">
                              <MessageSquare size={18}/>
                          </button>
                          <button onClick={() => submitCallLog(lead)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-2.5 rounded-lg transition-colors text-sm shadow-lg flex items-center gap-1" title="Save Log">
                            <Save size={18}/> Save
                          </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}