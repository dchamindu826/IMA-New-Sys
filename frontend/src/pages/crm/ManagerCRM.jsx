import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Settings, Activity, Send, Building2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

import UserInbox from '../../components/crm/manager/ManagerInbox';
import UserTools from "../../components/crm/manager/ManagerTools";
import AgentStats from '../../components/crm/AgentStats'; 
import AdminCrmSetup from '../admin/AdminCrmSetup';

export default function ManagerCRM({ loggedInUser }) {
    const [activeTab, setActiveTab] = useState('INBOX');
    const [businesses, setBusinesses] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    
    // 🔥 NEW: Phase Toggle (Free Seminar vs After Seminar) 🔥
    const [activePhase, setActivePhase] = useState('FREE'); // 'FREE' or 'AFTER'

    const userRole = loggedInUser?.role || 'Manager';
    const isSystemAdmin = userRole === 'System Admin' || userRole === 'superadmin' || userRole === 'Director';

    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                // 🔥 Token එක මෙහෙම ගන්න 🔥
                const currentToken = localStorage.getItem('token');
                if (!currentToken) {
                    console.error("No token found!");
                    return;
                }

                const res = await axios.get(`${API_BASE_URL}/api/admin/businesses`, {
                    headers: { 
                        'Authorization': `Bearer ${currentToken}`, // 🔥 සමහර Backend මේක බලනවා
                        'token': `Bearer ${currentToken}`          // 🔥 සමහර ඒවා මේක බලනවා (දෙකම යවමු)
                    }
                });
                
                const bList = Array.isArray(res.data) ? res.data : (res.data?.businesses || []);
                setBusinesses(bList);
                
                if (!isSystemAdmin && bList.length > 0) {
                    const myBiz = bList.find(b => String(b.id) === String(loggedInUser.businessId));
                    setSelectedBiz(myBiz || bList[0]);
                } else if (isSystemAdmin && bList.length > 0) {
                    setSelectedBiz(bList[0]);
                }
            } catch (error) {
                console.error("Error fetching businesses", error);
            }
        };
        fetchBusinesses();
    }, [isSystemAdmin, loggedInUser]);

    return (
        <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-4 relative">
            
            {/* Top Navigation & Controls */}
            <div className="mb-6 shrink-0 bg-slate-900/40 border border-white/10 p-4 md:p-6 rounded-[2rem] shadow-lg backdrop-blur-md flex flex-col gap-4 relative z-20">
                
                {/* Upper Row: Title & Business Select */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3 drop-shadow-md shrink-0">
                        <MessageSquare className="text-blue-400" size={28}/> CRM Hub
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        {/* 🔥 Phase Toggle (Free vs After) 🔥 */}
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                            <button 
                                onClick={() => setActivePhase('FREE')} 
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activePhase === 'FREE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Free Seminar
                            </button>
                            <button 
                                onClick={() => setActivePhase('AFTER')} 
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activePhase === 'AFTER' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                After Seminar
                            </button>
                        </div>

                        {/* Admin Business Selector */}
                        {isSystemAdmin && (
                            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                                <Building2 size={16} className="text-slate-400"/>
                                <select 
                                    value={selectedBiz?.id || ''} 
                                    onChange={(e) => setSelectedBiz(businesses.find(b => String(b.id) === e.target.value))}
                                    className="bg-transparent text-white text-sm font-bold outline-none cursor-pointer"
                                >
                                    <option value="" className="bg-slate-800">Select Business</option>
                                    {businesses.map(b => <option key={b.id} value={b.id} className="bg-slate-800">{b.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lower Row: Tool Tabs */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar w-full pt-2 border-t border-white/10 mt-2">
                    <button onClick={() => setActiveTab('INBOX')} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'INBOX' ? 'bg-blue-600 text-white shadow-lg' : 'bg-black/20 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                        <Users size={16} /> Live Inbox
                    </button>
                    <button onClick={() => setActiveTab('TOOLS')} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TOOLS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-black/20 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                        <Send size={16} /> Broadcast Tools
                    </button>
                    <button onClick={() => setActiveTab('STATS')} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'STATS' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-black/20 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                        <Activity size={16} /> Agent Stats
                    </button>
                    {isSystemAdmin && (
                        <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'SETTINGS' ? 'bg-purple-600 text-white shadow-lg' : 'bg-black/20 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                            <Settings size={16} /> Setup Bots
                        </button>
                    )}
                </div>
            </div>

            {/* Dynamic Content Area (Passing activePhase and selectedBiz) */}
            <div className="flex-1 overflow-hidden relative z-10 flex flex-col min-h-0">
                {activeTab === 'INBOX' && <UserInbox isEmbedded={true} activePhase={activePhase} selectedBiz={selectedBiz} />}
                {activeTab === 'TOOLS' && <UserTools isEmbedded={true} activePhase={activePhase} selectedBiz={selectedBiz} />}
                {activeTab === 'STATS' && <AgentStats isEmbedded={true} activePhase={activePhase} selectedBiz={selectedBiz} />}
                {activeTab === 'SETTINGS' && isSystemAdmin && <AdminCrmSetup isEmbedded={true} />}
            </div>

        </div>
    );
}