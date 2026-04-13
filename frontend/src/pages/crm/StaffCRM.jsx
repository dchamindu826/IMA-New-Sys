import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { MessageSquare, PhoneCall, CheckCircle, Search, User, Send, Paperclip, Loader } from 'lucide-react';
import { API_BASE_URL } from "../../config";

const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('jwt');

export default function StaffCRM({ loggedInUser }) {
  // --- Main Layout States ---
  const [activeTab, setActiveTab] = useState('INBOX'); // 'INBOX' or 'CALL_CAMPAIGN'
  const [activePhase, setActivePhase] = useState('FREE_SEMINAR');
  
  // --- User Logic ---
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUser = loggedInUser || storedUser;
  const userId = currentUser.id || localStorage.getItem('id');
  const userName = currentUser.fName || currentUser.name || 'Staff Agent';

  // ==========================================
  // 🔴 CALL CAMPAIGN LOGIC 🔴
  // ==========================================
  const [callLeads, setCallLeads] = useState([]);
  const [callData, setCallData] = useState({});
  const [callSearchTerm, setCallSearchTerm] = useState('');
  const [loadingCalls, setLoadingCalls] = useState(false);

  const fetchCallLeads = async () => {
    setLoadingCalls(true);
    try {
      // Backend automatically filters by logged-in staff ID when staff role calls this
      const res = await api.get(`/crm/calls/assigned?phase=${activePhase}`);
      setCallLeads(res.data || []);
      
      const initialData = {};
      (res.data || []).forEach(lead => {
        initialData[lead.id] = { method: 'Normal', attempts: '1', remark: 'Pending', note: '' };
      });
      setCallData(initialData);
    } catch (error) {
      console.error("Failed to load calls", error);
    } finally {
      setLoadingCalls(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CALL_CAMPAIGN') fetchCallLeads();
  }, [activeTab, activePhase]);

  const handleCallChange = (leadId, field, value) => {
    setCallData(prev => ({ ...prev, [leadId]: { ...prev[leadId], [field]: value } }));
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
    } catch (error) { toast.error("Failed to save", { id: toastId }); }
  };

  const filteredCallLeads = callLeads.filter(l => 
      (l.customer_name && l.customer_name.toLowerCase().includes(callSearchTerm.toLowerCase())) ||
      (l.phone_number && l.phone_number.includes(callSearchTerm))
  );

  // ==========================================
  // 🔴 INBOX (WHATSAPP) LOGIC 🔴
  // ==========================================
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeLead, setActiveLead] = useState(null);
  const [chatFilter, setChatFilter] = useState('My Chats'); // 'My Chats' or 'Other Agents'
  const [chatSearch, setChatSearch] = useState('');
  
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Load Contacts
  const loadContacts = async () => {
    try {
      const t = getToken();
      if (!t) return;
      const res = await fetch(`${API_BASE_URL}/api/crm/contacts`, { 
        headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch (err) { console.error("Error loading contacts:", err); }
  };

  useEffect(() => {
    loadContacts();
    const interval = setInterval(loadContacts, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter Contacts based on Staff Logic
  const filteredContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];
    return contacts
      .filter(c => {
        const isAssigned = !!(c.assignedTo || c.assigned_to);
        if (!isAssigned) return false; // Staff only sees assigned chats

        const isMine = String(c.assigned_to) === String(userId) || String(c.assignedTo) === String(userId);
        
        if (chatFilter === 'My Chats' && !isMine) return false;
        if (chatFilter === 'Other Agents' && isMine) return false;

        // Phase Filter
        const cPhase = parseInt(c.phase || c.status || 1);
        if (activePhase === 'FREE_SEMINAR' && cPhase !== 1) return false;
        if (activePhase === 'AFTER_SEMINAR' && cPhase === 1) return false;

        // Search Filter
        if (chatSearch) {
          const contactPhone = c.phoneNumber || c.phone_number || "";
          const contactName = c.name || c.customer_name || "";
          const term = chatSearch.toLowerCase();
          if (!contactPhone.includes(term) && !contactName.toLowerCase().includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aUnread = (a.unreadCount || a.unread_count) > 0 ? 1 : 0;
        const bUnread = (b.unreadCount || b.unread_count) > 0 ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return new Date(b.lastMessageTime || b.last_message_time || 0) - new Date(a.lastMessageTime || a.last_message_time || 0);
      });
  }, [contacts, chatSearch, userId, activePhase, chatFilter]);

  // Load Messages for Selected Lead
  useEffect(() => {
    let msgInterval;
    const fetchMsgs = async () => {
      const t = getToken();
      if (!activeLead || !t) return;
      const contactId = activeLead._id || activeLead.id;
      try {
        const res = await fetch(`${API_BASE_URL}/api/crm/messages/${contactId}`, { 
          headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } 
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setMessages(data);
        }
      } catch (err) { console.error("Message Fetch Error:", err); }
    };

    if (activeLead && activeTab === 'INBOX') {
      fetchMsgs();
      msgInterval = setInterval(fetchMsgs, 3000);
    }
    return () => { if (msgInterval) clearInterval(msgInterval); }
  }, [activeLead, activeTab]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Mark as Read & Open Chat
  const handleContactClick = async (contact) => {
    setActiveLead(contact);
    contact.unreadCount = 0; contact.unread_count = 0;
    try {
      const t = getToken();
      await fetch(`${API_BASE_URL}/api/crm/contacts/${contact.id || contact._id}/read`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` }
      });
    } catch (e) {}
  };

  const openChatFromCall = (lead) => {
    // Find the contact in CRM contacts array based on phone number
    const contact = contacts.find(c => c.phoneNumber === lead.phone_number || c.phone_number === lead.phone_number);
    if (contact) {
      handleContactClick(contact);
    } else {
      toast.error("WhatsApp chat not found for this number.");
    }
    setActiveTab('INBOX');
  };

  // Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeLead || !newMessage.trim()) return;

    setSending(true);
    try {
      const t = getToken();
      const targetContactId = activeLead._id || activeLead.id;
      const res = await fetch(`${API_BASE_URL}/api/crm/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
        body: JSON.stringify({
          contactId: targetContactId,
          to: activeLead.phoneNumber || activeLead.phone_number,
          text: newMessage.trim(),
          type: 'text',
          agentName: userName
        })
      });
      if (res.ok) {
        const sentMsg = await res.json();
        setNewMessage("");
        setMessages(prev => [...prev, sentMsg]);
      }
    } catch (err) { console.error(err); toast.error("Failed to send message"); } 
    finally { setSending(false); }
  };


  // ==========================================
  // 🔴 UI RENDERING 🔴
  // ==========================================
  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col font-sans pb-4 max-w-screen-2xl mx-auto px-4 lg:px-8">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <User className="text-emerald-500" size={32}/> Staff Workspace
          </h2>
          <p className="text-slate-400 text-sm mt-1">Standalone CRM Portal for Agents</p>
          
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
          <div className="flex gap-3 bg-black/20 p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setActiveTab('INBOX')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'INBOX' ? 'bg-blue-600 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-white'}`}>
              <MessageSquare size={18}/> WhatsApp Chats
            </button>
            <button onClick={() => setActiveTab('CALL_CAMPAIGN')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'CALL_CAMPAIGN' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-white'}`}>
              <PhoneCall size={18}/> Call Campaign
            </button>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🔴 TAB 1: WHATSAPP INBOX 🔴 */}
      {/* ========================================== */}
      {activeTab === 'INBOX' && (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 relative">
          
          {/* CUSTOM SIDEBAR FOR STAFF */}
          <div className="col-span-1 md:col-span-4 lg:col-span-3 h-full overflow-hidden bg-slate-900 border border-white/10 rounded-3xl flex flex-col p-4 shadow-xl">
            <div className="mb-4 shrink-0">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                    <MessageSquare className="text-blue-400" size={18}/> Inbox
                </h2>
                
                {/* My Chats vs Other Agents Tabs */}
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
                    <button onClick={() => setChatFilter('My Chats')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${chatFilter === 'My Chats' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        My Chats
                    </button>
                    <button onClick={() => setChatFilter('Other Agents')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${chatFilter === 'Other Agents' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                        Other Agents
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                    <input type="text" placeholder="Search chats..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500" />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {filteredContacts.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 text-sm">No chats found in this category.</div>
                ) : (
                    filteredContacts.map(contact => {
                        const isSelected = activeLead?._id === contact._id || activeLead?.id === contact.id;
                        const unread = contact.unreadCount || contact.unread_count || 0;
                        const phone = contact.phoneNumber || contact.phone_number || "";
                        const displayName = (contact.name && !contact.name.toLowerCase().includes('guest')) ? contact.name : phone;

                        return (
                            <div key={contact._id || contact.id} onClick={() => handleContactClick(contact)} className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all border ${isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 bg-slate-700 relative">
                                    {phone.slice(-2)}
                                    {unread > 0 && <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-md border-2 border-slate-900">{unread}</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>{displayName}</h4>
                                    <p className={`text-xs truncate ${unread > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>{contact.lastMessage || contact.last_message || "Active Lead"}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
          </div>

          {/* CUSTOM CHAT AREA FOR STAFF */}
          <div className="col-span-1 md:col-span-8 lg:col-span-9 h-full overflow-hidden flex flex-col bg-slate-900 border border-white/10 rounded-3xl shadow-xl">
             {activeLead ? (
                 <>
                    {/* Chat Header */}
                    <div className="bg-slate-800/80 p-4 border-b border-white/10 flex justify-between items-center z-10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center font-bold text-white">
                                {activeLead.phoneNumber?.slice(-2) || activeLead.phone_number?.slice(-2) || "#"}
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">
                                    {(activeLead.name && !activeLead.name.toLowerCase().includes('guest')) ? activeLead.name : (activeLead.phoneNumber || activeLead.phone_number)}
                                </h3>
                                <p className="text-xs text-blue-400 font-medium">{activeLead.phoneNumber || activeLead.phone_number}</p>
                            </div>
                        </div>
                        {chatFilter === 'Other Agents' && (
                            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs font-bold border border-red-500/20">Read-Only View (Other Agent)</span>
                        )}
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-950/50 custom-scrollbar">
                        {messages.map((msg, index) => {
                            const isMe = msg.direction === 'outbound' || msg.sender === 'me' || msg.sender_type === 'STAFF' || msg.sender_type === 'AI_BOT' || msg.sender_type === 'SYSTEM';
                            const msgDate = new Date(msg.created_at || msg.createdAt || Date.now());
                            const msgText = msg.message || msg.text || msg.content || "";
                            
                            return (
                                <div key={msg._id || msg.id || index} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                    <div className={`p-3 rounded-2xl shadow-sm border ${isMe ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none' : 'bg-slate-800 text-gray-200 border-slate-700 rounded-tl-none'}`}>
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{msgText}</p>
                                        <div className={`text-[10px] mt-1.5 text-right ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {msgDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={scrollRef} />
                    </div>

                    {/* Chat Input (Disabled if viewing other agent's chat) */}
                    <div className="p-4 bg-slate-800/80 border-t border-white/10 shrink-0">
                        {chatFilter === 'Other Agents' ? (
                            <div className="text-center text-slate-500 text-sm font-bold bg-black/20 py-3 rounded-xl border border-white/5">
                                You cannot reply to chats assigned to other agents.
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    placeholder="Type a message..." 
                                    className="flex-1 bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={sending}
                                />
                                <button type="submit" disabled={sending || !newMessage.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-3 rounded-xl transition-colors shadow-lg">
                                    {sending ? <Loader size={20} className="animate-spin"/> : <Send size={20}/>}
                                </button>
                            </form>
                        )}
                    </div>
                 </>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                     <MessageSquare size={40} className="mb-4 opacity-50"/>
                     <p className="font-bold">Select a chat to view messages</p>
                 </div>
             )}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 🔴 TAB 2: CALL CAMPAIGN 🔴 */}
      {/* ========================================== */}
      {activeTab === 'CALL_CAMPAIGN' && (
        <div className="flex-1 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-xl overflow-hidden flex flex-col relative z-10">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><PhoneCall className="text-emerald-400"/> My Assigned Calls ({activePhase.replace('_', ' ')})</h3>
            <div className="relative w-72">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                <input type="text" placeholder="Search by name or number..." value={callSearchTerm} onChange={(e) => setCallSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-emerald-500 transition-colors" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-4 rounded-tl-xl">Student Name</th>
                  <th className="p-4">Phone Number</th>
                  <th className="p-4 text-center">Phase</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Attempts</th>
                  <th className="p-4">Remark</th>
                  <th className="p-4 w-[25%]">Notes</th>
                  <th className="p-4 rounded-tr-xl text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loadingCalls ? (
                    <tr><td colSpan="8" className="text-center py-10"><Loader className="animate-spin text-emerald-500 mx-auto" size={24}/></td></tr>
                ) : filteredCallLeads.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-12 text-slate-500 font-medium bg-black/20">You have no pending calls assigned in this phase.</td></tr>
                ) : (
                  filteredCallLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{lead.customer_name || 'Unknown'}</td>
                      <td className="p-4 text-slate-300 font-mono text-xs">{lead.phone_number}</td>
                      <td className="p-4 text-center">
                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-black">Phase {lead.current_call_phase || 1}</span>
                      </td>
                      <td className="p-4">
                        <select value={callData[lead.id]?.method || 'Normal'} onChange={(e) => handleCallChange(lead.id, 'method', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full focus:border-emerald-500">
                          <option>Normal</option><option>WhatsApp</option><option>3CX</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <select value={callData[lead.id]?.attempts || '1'} onChange={(e) => handleCallChange(lead.id, 'attempts', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full focus:border-emerald-500">
                          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5+</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <select value={callData[lead.id]?.remark || 'Pending'} onChange={(e) => handleCallChange(lead.id, 'remark', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full focus:border-emerald-500">
                          <option>Pending</option><option>Answer</option><option>No Answer</option><option>Reject</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <input type="text" placeholder="Type a note..." value={callData[lead.id]?.note || ''} onChange={(e) => handleCallChange(lead.id, 'note', e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-white outline-none text-xs w-full focus:border-emerald-500" />
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openChatFromCall(lead)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-lg transition-colors" title="Open WhatsApp Chat">
                                <MessageSquare size={16}/>
                            </button>
                            <button onClick={() => submitCallLog(lead)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg transition-colors text-xs shadow-lg">
                              Save
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
      )}
    </div>
  );
}