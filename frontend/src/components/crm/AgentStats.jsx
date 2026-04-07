import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart2, MessageCircle, Users, Send, Calendar, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// 🔥 FIX: Path eka ../../config wenne 🔥
import { API_BASE_URL } from "../../config";

const getLocalISOString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16); 
};

const AgentStats = ({ isEmbedded = false }) => {
    const [data, setData] = useState({ summary: {}, agents: [] });
    const [loading, setLoading] = useState(true);
    
    const today9AM = new Date();
    today9AM.setHours(9, 0, 0, 0);
    const [startDateTime, setStartDateTime] = useState(getLocalISOString(today9AM));
    const now = new Date();
    const [endDateTime, setEndDateTime] = useState(getLocalISOString(now));

    useEffect(() => { fetchStats(); }, [startDateTime, endDateTime]); 

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            // 🔥 Fix: Path එක හරිගැස්සුවා (API endpoint)
            const res = await axios.get(`${API_BASE_URL}/api/crm/agent-stats?startDate=${startDateTime}:00&endDate=${endDateTime}:59`, {
                headers: { token: `Bearer ${token}` }
            });
            setData(res.data);
            setLoading(false);
        } catch (error) { setLoading(false); }
    };

    return (
        <div className="h-full flex flex-col bg-transparent overflow-y-auto custom-scrollbar">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0 bg-slate-900/40 p-5 rounded-[2rem] border border-white/5 backdrop-blur-md">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart2 className="text-blue-500" /> Analytics & Agent Performance
                    </h1>
                </div>

                <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                    <div className="flex items-center gap-2 px-2">
                        <Calendar size={16} className="text-slate-400" />
                        <input type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} className="bg-transparent text-white text-sm outline-none cursor-pointer" style={{colorScheme:'dark'}}/>
                    </div>
                    <span className="text-slate-500">to</span>
                    <div className="flex items-center gap-2 px-2">
                        <input type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} className="bg-transparent text-white text-sm outline-none cursor-pointer" style={{colorScheme:'dark'}}/>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center text-slate-400 py-10 flex-1">Loading statistics...</div>
            ) : (
                <div className="flex-1 flex flex-col gap-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-[2rem] shadow-lg backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><MessageCircle size={20}/></div>
                                <h3 className="text-slate-300 font-medium">New Numbers Received</h3>
                            </div>
                            <p className="text-4xl font-bold text-white mt-4">{data.summary.totalInbound || 0}</p>
                        </div>
                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-[2rem] shadow-lg backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Send size={20}/></div>
                                <h3 className="text-slate-300 font-medium">Total Numbers Replied</h3>
                            </div>
                            <p className="text-4xl font-bold text-white mt-4">{data.summary.totalReplied || 0}</p>
                        </div>
                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-[2rem] shadow-lg backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><Percent size={20}/></div>
                                <h3 className="text-slate-300 font-medium">Overall Response Rate</h3>
                            </div>
                            <p className="text-4xl font-bold text-white mt-4">{data.summary.rate || 0}<span className="text-lg text-slate-400 ml-1">%</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[350px]">
                        {/* Agent Table */}
                        <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-md shadow-xl flex flex-col">
                            <div className="p-5 border-b border-white/5 shrink-0"><h3 className="text-lg font-bold text-white">Agent Breakdown</h3></div>
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 sticky top-0">
                                        <tr>
                                            <th className="p-4 text-slate-400 font-bold text-xs uppercase">Agent Name</th>
                                            <th className="p-4 text-green-400 font-bold text-xs uppercase">Replied Num</th>
                                            <th className="p-4 text-blue-400 font-bold text-xs uppercase">Sent Msgs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {data.agents && data.agents.length > 0 ? data.agents.map((agent, index) => (
                                            <tr key={index} className="hover:bg-white/5">
                                                <td className="p-4 text-white font-medium flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">{agent.agentName.charAt(0).toUpperCase()}</div>
                                                    {agent.agentName}
                                                </td>
                                                <td className="p-4 font-bold text-green-400"><div className="flex items-center gap-2"><Users size={14} />{agent.uniqueNumbersReplied}</div></td>
                                                <td className="p-4 font-bold text-blue-400"><div className="flex items-center gap-2"><Send size={14} />{agent.messagesSent}</div></td>
                                            </tr>
                                        )) : (<tr><td colSpan="3" className="p-8 text-center text-slate-500">No agent activity found.</td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-slate-900/60 border border-white/5 p-6 rounded-[2rem] backdrop-blur-md shadow-xl flex flex-col h-[350px]"> {/* 🔥 h-[350px] දුන්නා */}
    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 shrink-0"><BarChart2 size={18} className="text-blue-400"/> Activity Chart</h3>
    <div className="flex-1 w-full h-full relative"> {/* 🔥 relative දුන්නා */}
        <ResponsiveContainer width="100%" height="100%"> 
            <BarChart data={data.agents} barSize={30}> 
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="agentName" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff'}} />
                <Bar dataKey="uniqueNumbersReplied" name="Unique Numbers" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="messagesSent" name="Total Msgs Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    </div>
</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentStats;