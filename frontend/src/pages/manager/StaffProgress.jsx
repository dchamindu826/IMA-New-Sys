import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { Users, PhoneCall, MessageCircle, BarChart2, Calendar, Filter, Download, UserCheck, PhoneMissed, PhoneOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const StaffProgress = () => {
    const [data, setData] = useState({ summary: {}, agents: [] });
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [activePhase, setActivePhase] = useState('All'); 
    const [timeFilter, setTimeFilter] = useState('today'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            let queryParams = new URLSearchParams();
            if (activePhase !== 'All') queryParams.append('phase', activePhase);
            if (timeFilter === 'today') queryParams.append('time', 'today');
            if (timeFilter === 'custom' && startDate && endDate) {
                queryParams.append('startDate', startDate);
                queryParams.append('endDate', endDate);
            }

            // 🔥 Oya hadanna ona aluth backend API eka 🔥
            const res = await axios.get(`/admin/staff-progress?${queryParams.toString()}`);
            setData(res.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
            toast.error("Failed to load staff progress.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (timeFilter === 'custom' && (!startDate || !endDate)) return;
        fetchStats();
    }, [activePhase, timeFilter, startDate, endDate]);

    return (
        <div className="w-full text-slate-200 animate-in fade-in duration-500 relative h-full overflow-y-auto pb-10 custom-scrollbar pr-2">
            
            {/* Header & Filters */}
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl p-6 rounded-3xl shadow-xl mb-8 flex flex-col xl:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white drop-shadow-md flex items-center gap-3">
                        <BarChart2 className="text-blue-500"/> Staff Progress & CRM Stats
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Monitor leads, free seminar stats, and call campaign progress.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    {/* Time Filters */}
                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        <button onClick={() => setTimeFilter('All')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'All' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>All Time</button>
                        <button onClick={() => setTimeFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'today' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Today</button>
                        <button onClick={() => setTimeFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeFilter === 'custom' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Custom</button>
                    </div>

                    {/* Phase Filters */}
                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        {['All', 1, 2, 3].map((phase) => (
                            <button key={phase} onClick={() => setActivePhase(phase)} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activePhase === phase ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {phase === 'All' ? <Filter size={14}/> : ''} {phase === 'All' ? 'Overall' : `Phase ${phase}`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Custom Date Inputs (If Custom Selected) */}
            {timeFilter === 'custom' && (
                <div className="flex items-center gap-4 mb-6 bg-slate-800/50 p-4 rounded-2xl w-max border border-white/10">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-black/50 text-white p-2 rounded-lg outline-none border border-white/10" style={{colorScheme:'dark'}}/>
                    <span className="text-slate-400 font-bold">TO</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-black/50 text-white p-2 rounded-lg outline-none border border-white/10" style={{colorScheme:'dark'}}/>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/10 border border-blue-500/20 p-6 rounded-3xl shadow-lg flex items-center gap-5">
                    <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400"><MessageCircle size={28}/></div>
                    <div>
                        <p className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">Seminar Messages</p>
                        <h3 className="text-3xl font-bold text-white mt-1">{data.summary?.totalMessages || 0}</h3>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/10 border border-purple-500/20 p-6 rounded-3xl shadow-lg flex items-center gap-5">
                    <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400"><Users size={28}/></div>
                    <div>
                        <p className="text-[11px] font-bold text-purple-300 uppercase tracking-widest">Total Leads</p>
                        <h3 className="text-3xl font-bold text-white mt-1">{data.summary?.totalLeads || 0}</h3>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/10 border border-emerald-500/20 p-6 rounded-3xl shadow-lg flex items-center gap-5">
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><UserCheck size={28}/></div>
                    <div>
                        <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest">Active Staff</p>
                        <h3 className="text-3xl font-bold text-white mt-1">{data.summary?.activeStaff || 0}</h3>
                    </div>
                </div>
                <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/10 border border-orange-500/20 p-6 rounded-3xl shadow-lg flex items-center gap-5">
                    <div className="p-3 bg-orange-500/20 rounded-xl text-orange-400"><PhoneCall size={28}/></div>
                    <div>
                        <p className="text-[11px] font-bold text-orange-300 uppercase tracking-widest">Pending to Cover</p>
                        <h3 className="text-3xl font-bold text-white mt-1">{data.summary?.totalPending || 0}</h3>
                    </div>
                </div>
            </div>

            {/* Staff Table */}
            <div className="glass-card rounded-[2rem] p-6 border border-white/10 shadow-2xl bg-slate-900/50">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><PhoneCall size={18} className="text-emerald-400"/> Staff Call Campaign Progress</h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/5">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>Loading staff data...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-black/40 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                                <tr>
                                    <th className="p-4">Staff Member</th>
                                    <th className="p-4 text-center">Assigned Leads</th>
                                    <th className="p-4 text-center text-emerald-400"><CheckCircle size={14} className="inline mr-1"/> Answered</th>
                                    <th className="p-4 text-center text-amber-400"><PhoneMissed size={14} className="inline mr-1"/> No Answer</th>
                                    <th className="p-4 text-center text-red-400"><PhoneOff size={14} className="inline mr-1"/> Reject</th>
                                    <th className="p-4 text-center text-orange-400">Left To Cover</th>
                                    <th className="p-4 text-center">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-slate-950/30">
                                {data.agents?.length === 0 ? (
                                    <tr><td colSpan="7" className="p-8 text-center text-slate-500 font-medium">No campaign data found for the selected filters.</td></tr>
                                ) : data.agents?.map((row, idx) => {
                                    const totalCovered = row.answered + row.noAnswer + row.reject;
                                    const progressPercent = row.totalAllocated > 0 ? Math.round((totalCovered / row.totalAllocated) * 100) : 0;

                                    return (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg border border-white/10">
                                                    {row.agentName.charAt(0)}
                                                </div>
                                                {row.agentName}
                                            </td>
                                            <td className="p-4 text-center font-black text-slate-200 text-base">{row.totalAllocated}</td>
                                            <td className="p-4 text-center font-bold text-emerald-400">{row.answered}</td>
                                            <td className="p-4 text-center font-bold text-amber-400">{row.noAnswer}</td>
                                            <td className="p-4 text-center font-bold text-red-400">{row.reject}</td>
                                            <td className="p-4 text-center font-black text-orange-400 bg-orange-500/10 rounded-lg">{row.toCover}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full bg-slate-800 rounded-full h-2.5 shadow-inner overflow-hidden border border-white/5">
                                                        <div className={`h-2.5 rounded-full ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progressPercent}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 min-w-[30px]">{progressPercent}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffProgress;