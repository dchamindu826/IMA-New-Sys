import React, { useState, useEffect } from 'react';
import { MessageSquare, PhoneCall, User, Building2, Users as UsersIcon } from 'lucide-react';
import api from '../../api/axios';
import StaffInbox from '../../components/crm/staff/StaffInbox';
import StaffCallCampaign from '../../components/crm/staff/StaffCallCampaign';

export default function StaffCRM({ loggedInUser }) {
  const [activeTab, setActiveTab] = useState('INBOX'); // INBOX or CALL_CAMPAIGN
  const [activePhase, setActivePhase] = useState('FREE_SEMINAR');
  
  // Filters for System Admin
  const [businesses, setBusinesses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');

  const currentUser = loggedInUser || JSON.parse(localStorage.getItem('user') || '{}');
  const userId = currentUser.id || localStorage.getItem('id');
  const userName = currentUser.fName || currentUser.name || 'Staff Agent';
  const userRole = (currentUser.role || '').toLowerCase();
  const isSystemAdmin = userRole.includes('admin') || userRole.includes('director');

  useEffect(() => {
    if (isSystemAdmin) {
      const fetchAdminData = async () => {
        try {
          const [bizRes, staffRes] = await Promise.all([
            api.get('/admin/businesses'),
            api.get('/team/agents')
          ]);
          setBusinesses(Array.isArray(bizRes.data) ? bizRes.data : bizRes.data?.businesses || []);
          setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
        } catch (error) { console.error("Filter Fetch Error", error); }
      };
      fetchAdminData();
    }
  }, [isSystemAdmin]);

  // Global handler to switch from Call Campaign to WhatsApp Chat
  const handleOpenWhatsAppChat = (lead) => {
    setActiveTab('INBOX');
    // StaffInbox will handle selecting this specific lead using local storage or event listeners.
    // For simplicity, we pass it via a custom event
    window.dispatchEvent(new CustomEvent('open-wa-chat', { detail: { phone: lead.phone_number } }));
  };

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col font-sans pb-4 max-w-screen-2xl mx-auto px-4 lg:px-8">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <User className="text-emerald-500" size={32}/> Staff Workspace
          </h2>
          
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {/* Phase Toggle */}
            <div className="flex bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
              <button onClick={() => setActivePhase('FREE_SEMINAR')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activePhase === 'FREE_SEMINAR' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>FREE SEMINAR</button>
              <button onClick={() => setActivePhase('AFTER_SEMINAR')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activePhase === 'AFTER_SEMINAR' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>AFTER SEMINAR</button>
            </div>

            {/* Admin Filters */}
            {isSystemAdmin && (
              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 px-2 border-r border-white/10">
                  <Building2 size={16} className="text-slate-400"/>
                  <select value={selectedBiz} onChange={(e) => setSelectedBiz(e.target.value)} className="bg-transparent text-white text-sm outline-none cursor-pointer">
                    <option value="" className="bg-slate-800">All Businesses</option>
                    {businesses.map(b => <option key={b.id} value={b.id} className="bg-slate-800">{b.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 px-2">
                  <UsersIcon size={16} className="text-slate-400"/>
                  <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className="bg-transparent text-white text-sm outline-none cursor-pointer">
                    <option value="" className="bg-slate-800">All Staff</option>
                    {staffList.map(s => <option key={s.id} value={s.id} className="bg-slate-800">{s.fName || s.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature Toggle */}
        <div className="flex gap-3 bg-black/20 p-1.5 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('INBOX')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'INBOX' ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-white'}`}>
            <MessageSquare size={18}/> WhatsApp Chats
          </button>
          <button onClick={() => setActiveTab('CALL_CAMPAIGN')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'CALL_CAMPAIGN' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-white'}`}>
            <PhoneCall size={18}/> Call Campaign
          </button>
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {activeTab === 'INBOX' && (
          <StaffInbox 
            activePhase={activePhase} userId={userId} userName={userName} 
            adminBizFilter={selectedBiz} adminStaffFilter={selectedStaff}
            isSystemAdmin={isSystemAdmin}
          />
        )}
        {activeTab === 'CALL_CAMPAIGN' && (
          <StaffCallCampaign 
            activePhase={activePhase} userId={userId} 
            adminBizFilter={selectedBiz} adminStaffFilter={selectedStaff}
            isSystemAdmin={isSystemAdmin} openWhatsAppChat={handleOpenWhatsAppChat}
          />
        )}
      </div>
    </div>
  );
}