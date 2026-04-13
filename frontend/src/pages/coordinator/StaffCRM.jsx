import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { MessageSquare, PhoneCall, CheckCircle, Building2, Filter, Search, User } from 'lucide-react';
import { API_BASE_URL } from "../../config";

import LeadSidebar from './LeadSidebar';
import ChatArea from './ChatArea';
import RightPanel from './RightPanel';
import ContactSidebar from './ContactSidebar'; 
import ChatModals from './ChatModals'; 
import ManagerAssignModal from './ManagerAssignModal';

const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('jwt');

export default function StaffCRM({ loggedInUser }) {
  const [activeTab, setActiveTab] = useState('INBOX'); 
  const [activePhase, setActivePhase] = useState('FREE_SEMINAR');
  const [activeLead, setActiveLead] = useState(null);
  
  const [callLeads, setCallLeads] = useState([]);
  const [callData, setCallData] = useState({});
  const [callSearchTerm, setCallSearchTerm] = useState('');

  // 🔥 Chat/Inbox States 🔥
  const [contacts, setContacts] = useState([]);
  const [staff, setStaff] = useState([]); 
  const [messages, setMessages] = useState([]);
  const [theme, setTheme] = useState('blue'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [inboxActiveTab, setInboxActiveTab] = useState('New');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('All');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [selectedForAssign, setSelectedForAssign] = useState([]);
  const [showLeadDetails, setShowLeadDetails] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [approvedTemplates, setApprovedTemplates] = useState([]);

  const scrollRef = useRef(null);
  const activeContactRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUser = loggedInUser || storedUser;
  const userRole = (currentUser.role || '').toLowerCase().trim(); 
  const userName = currentUser.fName || currentUser.name || 'Agent'; 
  const userId = currentUser.id || localStorage.getItem('id');
  
  // 🔥 Identify if the logged-in user is an Admin/Manager 🔥
  const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);

  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffFilterCall, setSelectedStaffFilterCall] = useState('all');

  const currentTheme = useMemo(() => {
      if (theme === 'light') return { bg: 'bg-[#efeae2]', bubbleMe: 'bg-[#d9fdd3] text-gray-800 border border-gray-200 shadow-sm', bubbleThem: 'bg-white text-gray-800 border border-gray-200 shadow-sm', header: 'bg-[#f0f2f5] border-gray-300', text: 'text-gray-900', subText: 'text-gray-500', icon: 'text-gray-500 hover:text-gray-700 hover:bg-gray-200', inputBg: 'bg-white border border-gray-300 text-gray-800', patternUrl: null };
      if (theme === 'whatsapp') return { bg: 'bg-[#0b141a]', bubbleMe: 'bg-[#005c4b] text-[#e9edef] border-none shadow-md', bubbleThem: 'bg-[#202c33] text-[#e9edef] border-none shadow-md', header: 'bg-[#202c33] border-[#2f3e46]', text: 'text-[#e9edef]', subText: 'text-[#8696a0]', icon: 'text-[#aebac1] hover:text-[#d1d7db] hover:bg-[#374045]', inputBg: 'bg-[#2a3942] border-none text-[#e9edef]', patternUrl: null };
      return { bg: 'bg-slate-900/60 backdrop-blur-xl', bubbleMe: 'bg-blue-600 text-white border-none shadow-lg shadow-blue-500/20', bubbleThem: 'bg-slate-800 text-gray-200 border-white/5 shadow-md', header: 'bg-black/40 border-white/5', text: 'text-white', subText: 'text-slate-400', icon: 'text-slate-400 hover:text-white hover:bg-white/10', inputBg: 'bg-black/40 border border-white/5 text-white shadow-inner', patternUrl: null };
  }, [theme]);

  // Load Contacts & Staff (For WhatsApp Inbox)
  const loadInboxData = async () => {
      try {
          const t = getToken();
          if (!t) return;
          const headers = { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` };

          // 🔥 If Admin, fetch based on filters. If Staff, backend handles their own leads.
          let url = `${API_BASE_URL}/api/crm/contacts`;
          if (isAdmin) {
              url += `?business_id=${selectedBusiness}&staff_id=${selectedAgentFilter}`;
          }

          const [conRes, staffRes] = await Promise.all([
              fetch(url, { headers }),
              fetch(`${API_BASE_URL}/api/team/agents`, { headers }) 
          ]);
          
          if(conRes.ok) {
              const data = await conRes.json();
              setContacts(Array.isArray(data) ? data : []);
          }
          if(staffRes.ok) {
              const data = await staffRes.json();
              setStaff(Array.isArray(data) ? data : []);
              setStaffList(Array.isArray(data) ? data : []);
          }
      } catch(err) { console.error("Error loading data:", err); }
  };

  // Fetch Admin Filters (Businesses)
  useEffect(() => {
    if (isAdmin) {
      api.get('/admin/businesses')
         .then(res => setBusinesses(Array.isArray(res.data) ? res.data : (res.data?.businesses || [])))
         .catch(e => console.error(e));
    }
  }, [isAdmin]);

  useEffect(() => { 
      loadInboxData(); 
      const contactInterval = setInterval(loadInboxData, 15000); 
      return () => clearInterval(contactInterval);
  }, [selectedBusiness, selectedAgentFilter]); // Reload if admin filters change

  // Fetch Messages for active chat
  useEffect(() => {
      activeContactRef.current = activeLead;
      let msgInterval;

      const fetchMsgs = async () => {
          const t = getToken();
          if (!activeContactRef.current || !t) return;
          const contactId = activeContactRef.current._id || activeContactRef.current.id;
          
          try {
              const res = await fetch(`${API_BASE_URL}/api/crm/messages/${contactId}`, { 
                  headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } 
              });
              
              if (res.ok) {
                  const data = await res.json();
                  if(Array.isArray(data)) {
                      setMessages(prev => {
                          if (JSON.stringify(prev) !== JSON.stringify(data)) return data;
                          return prev;
                      });
                  }
              }
          } catch(err) { console.error("Message Fetch Error:", err); }
      };

      if (activeLead && activeTab === 'INBOX') {
          fetchMsgs();
          msgInterval = setInterval(fetchMsgs, 3000);
      }

      return () => { if (msgInterval) clearInterval(msgInterval); }
  }, [activeLead?._id, activeLead?.id, activeTab]); 

  useEffect(() => {
      setMediaPreview(null); setReplyingTo(null); 
  }, [activeLead?._id, activeLead?.id]);

  // 🔥 Load Call Leads (With Admin Filters) 🔥
  const fetchCallLeads = async () => {
    try {
      let url = `/crm/calls/assigned?phase=${activePhase}`;
      // Apply filters if Admin
      if (isAdmin && selectedStaffFilterCall !== 'all') url += `&staff_id=${selectedStaffFilterCall}`;
      if (isAdmin && selectedBusiness !== 'all') url += `&business_id=${selectedBusiness}`;

      const res = await api.get(url);
      setCallLeads(res.data || []);
      
      const initialData = {};
      res.data.forEach(lead => {
        initialData[lead.id] = { method: 'Normal', attempts: '1', remark: 'Pending', note: '' };
      });
      setCallData(initialData);
    } catch (error) {
      console.error("Failed to load calls");
    }
  };

  useEffect(() => {
    if (activeTab === 'CALL_CAMPAIGN') {
      fetchCallLeads();
    }
  }, [activeTab, activePhase, selectedBusiness, selectedStaffFilterCall]); 

  const handleCallChange = (leadId, field, value) => {
    setCallData(prev => ({
      ...prev, [leadId]: { ...prev[leadId], [field]: value }
    }));
  };

  const submitCallLog = async (lead) => {
    const data = callData[lead.id];
    if (!data.method || !data.attempts || !data.remark) return toast.error("Fill required fields");

    const toastId = toast.loading("Saving call log...");
    try {
      const res = await api.post('/crm/calls/log', {
        lead_id: lead.id,
        current_phase: lead.current_call_phase || 1,
        ...data
      });

      toast.success("Call Logged Successfully!", { id: toastId });

      if (res.data.isCompleted || res.data.phaseChanged) {
        setCallLeads(callLeads.filter(l => l.id !== lead.id)); 
      } else {
        fetchCallLeads(); 
      }
    } catch (error) {
      toast.error("Failed to save", { id: toastId });
    }
  };

  const openChatForLead = (lead) => {
      setActiveLead(lead);
      setActiveTab('INBOX');
  };

  const handleSendMessage = async (e) => {
      if(e) e.preventDefault();
      if(!activeLead) return;
      const targetContactId = activeLead._id || activeLead.id;
      const textToSend = (drafts[targetContactId] || "").trim(); 
      const mediaToSend = mediaPreview ? mediaPreview.url : null;
      const typeToSend = mediaPreview ? mediaPreview.type : 'text';

      if(!textToSend && !mediaToSend) return; 

      setSending(true);
      try {
          const t = getToken();
          const payload = {
              contactId: targetContactId,
              to: activeLead.phoneNumber || activeLead.phone_number,
              text: textToSend, 
              type: typeToSend,
              mediaUrl: mediaToSend,
              replyToMessageId: replyingTo ? replyingTo.wa_msg_id : null,
              replyContext: replyingTo ? (replyingTo.text || replyingTo.content || replyingTo.message || 'Media/Attachment') : null,
              agentName: userName 
          };

          const res = await fetch(`${API_BASE_URL}/api/crm/messages/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
              body: JSON.stringify(payload)
          });
          
          if(res.ok) {
              const sentMsg = await res.json();
              setDrafts(prev => ({ ...prev, [targetContactId]: "" }));
              if (activeContactRef.current && (activeContactRef.current._id || activeContactRef.current.id) === targetContactId) {
                  setMessages(prev => [...prev, sentMsg]);
                  setMediaPreview(null); setReplyingTo(null); 
                  setShowTemplates(false);
              }
          }
      } catch(err) { console.error(err); } finally { setSending(false); }
  };

  const handleSelectedAssign = async (agentId) => {
      if (selectedForAssign.length === 0) return toast.error("Select contacts first");
      const toastId = toast.loading("Assigning to staff...");
      try {
          const t = getToken();
          await fetch(`${API_BASE_URL}/api/crm/assign-chats`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
              body: JSON.stringify({ contactIds: selectedForAssign, agentId: agentId })
          });
          setSelectedForAssign([]);
          setIsAssignMode(false);
          loadInboxData();
          toast.success("Successfully Assigned!", { id: toastId });
      } catch (e) { toast.error("Failed to assign", { id: toastId }); }
  };

  const filteredContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];

    return contacts
      .filter(c => {
        // Business Filter (Admin Only)
        if (isAdmin && selectedBusiness !== 'all' && String(c.owner_id || c.ownerId) !== String(selectedBusiness)) return false;

        // Staff Security (Non-Admins only see their own)
        if (!isAdmin) {
             if (String(c.assigned_to) !== String(userId) && String(c.assignedTo) !== String(userId)) return false;
        }

        const contactPhone = c.phoneNumber || c.phone_number || "";
        const contactName = c.name || c.customer_name || "";
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!contactPhone.includes(term) && !contactName.toLowerCase().includes(term)) return false;
        }

        const isAssigned = !!(c.assignedTo || c.assigned_to);
        const cStatus = c.status || "";
        const lastMsgStr = (c.lastMessage || c.last_message || "").toLowerCase();
        const isImported = cStatus === 'Imported' || lastMsgStr.includes("imported");

        if (inboxActiveTab === 'All') return true;

        if (inboxActiveTab === 'New') {
            if (isAssigned || isImported) return false; 
        }
        if (inboxActiveTab === 'Assigned') {
            if (!isAssigned) return false;
            // Additional filters for assigned tab
            if (selectedAgentFilter !== 'All' && String(c.assignedTo || c.assigned_to) !== String(selectedAgentFilter)) return false;
            if (selectedPhaseFilter !== 'All' && String(c.status || c.phase) !== `PHASE_${selectedPhaseFilter}`) return false;
            if (selectedStatusFilter !== 'All' && String(c.call_status) !== String(selectedStatusFilter)) return false;
        }
        if (inboxActiveTab === 'Import') {
            if (!isImported || isAssigned) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
          const aUnread = (a.unreadCount || a.unread_count) > 0 ? 1 : 0;
          const bUnread = (b.unreadCount || b.unread_count) > 0 ? 1 : 0;
          if (aUnread !== bUnread) return bUnread - aUnread; 
          
          return new Date(b.lastMessageTime || b.last_message_time || b.updated_at || b.created_at || 0) - new Date(a.lastMessageTime || a.last_message_time || a.updated_at || a.created_at || 0);
      });
  }, [contacts, searchTerm, inboxActiveTab, selectedBusiness, isAdmin, userId, selectedAgentFilter, selectedPhaseFilter, selectedStatusFilter]);

  const filteredCallLeads = callLeads.filter(l => 
      (l.customer_name && l.customer_name.toLowerCase().includes(callSearchTerm.toLowerCase())) ||
      (l.phone_number && l.phone_number.includes(callSearchTerm))
  );

  const stateProps = {
    contacts, staff, messages, selectedContact: activeLead, setSelectedContact: setActiveLead,
    isDarkMode: true, fontIndex: 1, theme, setTheme, currentTheme, activePhase,
    activeTab: inboxActiveTab, setActiveTab: setInboxActiveTab, searchTerm, setSearchTerm, showLeadDetails, setShowLeadDetails,
    newMessage: newMessage, setNewMessage, sending, mediaPreview, setMediaPreview, uploading, setUploading,
    replyingTo, setReplyingTo, handleSendMessage, filteredContacts, userRole, userId,
    showTemplates, setShowTemplates, templates, setTemplates, isCreatingTemplate, setIsCreatingTemplate,
    newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg,
    isRecording, setIsRecording, recordingTime, setRecordingTime, scrollRef,
    selectedAgentFilter, setSelectedAgentFilter, selectedPhaseFilter, setSelectedPhaseFilter,
    selectedStatusFilter, setSelectedStatusFilter,
    isAssignMode, setIsAssignMode, selectedForAssign, setSelectedForAssign, handleSelectedAssign,
    loggedInUser: currentUser, fetchContacts: loadInboxData,
    setShowAssignModal, setShowImportModal, showSendTemplateModal, setShowSendTemplateModal,
    approvedTemplates 
  };

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col font-sans pb-4 max-w-screen-2xl mx-auto px-4 lg:px-8">
      
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <User className="text-blue-500" size={32}/> {isAdmin ? "Global CRM Monitor" : "Staff Workspace"}
          </h2>
          
          <div className="flex gap-3 mt-4 bg-slate-900/50 p-1.5 rounded-xl border border-white/5 w-fit">
            <button onClick={() => setActivePhase('FREE_SEMINAR')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activePhase === 'FREE_SEMINAR' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              FREE SEMINAR
            </button>
            <button onClick={() => setActivePhase('AFTER_SEMINAR')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activePhase === 'AFTER_SEMINAR' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
              AFTER SEMINAR
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          {/* 🔥 ADMIN FILTERS (Only visible to Admins) 🔥 */}
          {isAdmin && (
            <div className="flex gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/10 shadow-lg">
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl">
                <Building2 size={16} className="text-slate-400"/>
                <select value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)} className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer">
                  <option value="all">All Businesses</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl">
                <Filter size={16} className="text-slate-400"/>
                {/* Changes filter based on active tab to sync with UI */}
                <select 
                   value={activeTab === 'INBOX' ? selectedAgentFilter : selectedStaffFilterCall} 
                   onChange={(e) => {
                       if (activeTab === 'INBOX') setSelectedAgentFilter(e.target.value);
                       else setSelectedStaffFilterCall(e.target.value);
                   }} 
                   className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer"
                >
                  <option value="all">All Agents</option>
                  <option value="Unassigned">Unassigned Only</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name || s.first_name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setActiveTab('INBOX')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'INBOX' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
              <MessageSquare size={18}/> Live Chat Inbox
            </button>
            <button onClick={() => setActiveTab('CALL_CAMPAIGN')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'CALL_CAMPAIGN' ? 'bg-green-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
              <PhoneCall size={18}/> Call Campaign
            </button>
          </div>
        </div>
      </div>

      {/* 🔴 TAB 1: LIVE CHAT INBOX 🔴 */}
      {activeTab === 'INBOX' && (
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 relative">
          <div className="col-span-3 h-full overflow-hidden bg-slate-900 border border-white/10 rounded-3xl">
            <ContactSidebar {...stateProps} />
          </div>
          <div className="col-span-6 h-full overflow-hidden flex flex-col bg-slate-900 border border-white/10 rounded-3xl">
             {activeLead ? (
                 <ChatArea {...stateProps} />
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                     <MessageSquare size={40} className="mb-4 opacity-50"/>
                     <p className="font-bold">Select a lead to start chatting</p>
                 </div>
             )}
          </div>
          {showLeadDetails && (
              <div className="col-span-3 h-full overflow-hidden bg-slate-900 border border-white/10 rounded-3xl">
                <RightPanel selectedContact={activeLead} loggedInUser={currentUser} />
              </div>
          )}

          {/* Modals for Inbox Tab */}
          <ChatModals {...stateProps} />
          {showAssignModal && <ManagerAssignModal onClose={() => setShowAssignModal(false)} selectedBatch={"All"} />}
        </div>
      )}

      {/* 🔴 TAB 2: CALL CAMPAIGN 🔴 */}
      {activeTab === 'CALL_CAMPAIGN' && (
        <div className="flex-1 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-xl overflow-hidden flex flex-col relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><PhoneCall className="text-green-400"/> Assigned Calls ({activePhase.replace('_', ' ')})</h3>
            
            <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                <input 
                    type="text" 
                    placeholder="Search by name or number..." 
                    value={callSearchTerm}
                    onChange={(e) => setCallSearchTerm(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-4 rounded-tl-xl">Student Info</th>
                  {isAdmin && <th className="p-4">Assigned To</th>}
                  <th className="p-4 text-center">Phase</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Attempts</th>
                  <th className="p-4">Remark</th>
                  <th className="p-4 w-[20%]">Note</th>
                  <th className="p-4 rounded-tr-xl text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCallLeads.length === 0 && (
                  <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-500">No pending calls found.</td></tr>
                )}
                {filteredCallLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{lead.customer_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-400">{lead.phone_number}</div>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-xs font-bold text-blue-400">
                        {lead.assigned_staff_name || `Agent ${lead.assigned_to}`}
                      </td>
                    )}
                    <td className="p-4 text-center">
                      <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-black">
                        Phase {lead.current_call_phase || 1}
                      </span>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.method || 'Normal'} onChange={(e) => handleCallChange(lead.id, 'method', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full">
                        <option>Normal</option><option>WhatsApp</option><option>3CX</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.attempts || '1'} onChange={(e) => handleCallChange(lead.id, 'attempts', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <select value={callData[lead.id]?.remark || 'Pending'} onChange={(e) => handleCallChange(lead.id, 'remark', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full">
                        <option>Pending</option><option>Answer</option><option>No Answer</option><option>Reject</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <input type="text" placeholder="Type a note..." value={callData[lead.id]?.note || ''} onChange={(e) => handleCallChange(lead.id, 'note', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full" />
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openChatForLead(lead)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-lg transition-colors" title="Open Chat">
                              <MessageSquare size={16}/>
                          </button>
                          <button onClick={() => submitCallLog(lead)} className="bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-2 rounded-lg transition-colors text-xs flex items-center gap-1 shadow-lg">
                            <CheckCircle size={14}/> Save
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}