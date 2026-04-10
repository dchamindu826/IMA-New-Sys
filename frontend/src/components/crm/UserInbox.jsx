import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layers, Users, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from "../../config";
import ContactSidebar from "./ContactSidebar";
import ChatArea from "./ChatArea";
import CampaignSidebar from "./RightPanel"; 
import ChatModals from "./ChatModals"; 

const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('jwt');

export default function UserInbox({ isEmbedded = false, initialSelectedContact = null, activePhase = 'FREE', selectedBiz = null }) {
  const [contacts, setContacts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fontIndex, setFontIndex] = useState(1);
  const [theme, setTheme] = useState('blue'); 
  
  const currentTheme = useMemo(() => {
      if (theme === 'light') return { bg: 'bg-[#efeae2]', bubbleMe: 'bg-[#d9fdd3] text-gray-800 border border-gray-200 shadow-sm', bubbleThem: 'bg-white text-gray-800 border border-gray-200 shadow-sm', header: 'bg-[#f0f2f5] border-gray-300', text: 'text-gray-900', subText: 'text-gray-500', icon: 'text-gray-500 hover:text-gray-700 hover:bg-gray-200', inputBg: 'bg-white border border-gray-300 text-gray-800', patternUrl: null };
      if (theme === 'whatsapp') return { bg: 'bg-[#0b141a]', bubbleMe: 'bg-[#005c4b] text-[#e9edef] border-none shadow-md', bubbleThem: 'bg-[#202c33] text-[#e9edef] border-none shadow-md', header: 'bg-[#202c33] border-[#2f3e46]', text: 'text-[#e9edef]', subText: 'text-[#8696a0]', icon: 'text-[#aebac1] hover:text-[#d1d7db] hover:bg-[#374045]', inputBg: 'bg-[#2a3942] border-none text-[#e9edef]', patternUrl: null };
      return { bg: 'bg-slate-900/60 backdrop-blur-xl', bubbleMe: 'bg-blue-600 text-white border-none shadow-lg shadow-blue-500/20', bubbleThem: 'bg-slate-800 text-gray-200 border-white/5 shadow-md', header: 'bg-black/40 border-white/5', text: 'text-white', subText: 'text-slate-400', icon: 'text-slate-400 hover:text-white hover:bg-white/10', inputBg: 'bg-black/40 border border-white/5 text-white shadow-inner', patternUrl: null };
  }, [theme]);

  // 🔥 Assignment Filters 🔥
  const [activeTab, setActiveTab] = useState('All'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All'); // Pending, Reject etc.
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [selectedForAssign, setSelectedForAssign] = useState([]);

  const [showLeadDetails, setShowLeadDetails] = useState(true);

  const [batches, setBatches] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');

  const [drafts, setDrafts] = useState({});
  const newMessage = selectedContact && drafts[selectedContact?._id || selectedContact?.id] !== undefined ? drafts[selectedContact?._id || selectedContact?.id] : "";
  const setNewMessage = (val) => { if (selectedContact) setDrafts(prev => ({ ...prev, [selectedContact._id || selectedContact.id]: val })); };
  
  const [sending, setSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  const [showTemplates, setShowTemplates] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [uploadingTemplateMedia, setUploadingTemplateMedia] = useState(false);
  const [templateMediaPreview, setTemplateMediaPreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [approvedTemplates, setApprovedTemplates] = useState([]);

  const activeContactRef = useRef(null);
  const scrollRef = useRef(); 

  const userRole = (localStorage.getItem('role') || '').toLowerCase(); 
  const userName = localStorage.getItem('name') || 'Agent'; 
  const userId = localStorage.getItem('id') || localStorage.getItem('userId');

  const loadData = useCallback(async () => {
      try {
          const t = getToken();
          if (!t) return;
          const headers = { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` };

          const [conRes, agentRes] = await Promise.all([
              fetch(`${API_BASE_URL}/api/crm/contacts`, { headers }),
              fetch(`${API_BASE_URL}/api/team/agents`, { headers }) 
          ]);
          
          if(conRes.ok) {
              const data = await conRes.json();
              setContacts(Array.isArray(data) ? data : []);
          }
          if(agentRes.ok) {
              const data = await agentRes.json();
              setAgents(Array.isArray(data) ? data : []);
          }
      } catch(err) { console.error("Error loading data:", err); }
  }, []);
  
  useEffect(() => {
      const t = getToken();
      if (selectedBiz && selectedBiz.id && t) {
          fetch(`${API_BASE_URL}/api/admin/batches/${selectedBiz.id}`, { 
              headers: { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` } 
          })
          .then(res => res.json())
          .then(data => setBatches(Array.isArray(data) ? data : (data.batches || data.data || [])))
          .catch(e => console.error("Batches Fetch Error:", e));
      }
  }, [selectedBiz?.id]); 

  useEffect(() => { 
      loadData(); 
      const contactInterval = setInterval(loadData, 15000); 
      return () => clearInterval(contactInterval);
  }, [loadData]); 

  useEffect(() => {
      activeContactRef.current = selectedContact;
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

      if (selectedContact) {
          fetchMsgs();
          msgInterval = setInterval(fetchMsgs, 3000);
      }

      return () => { if (msgInterval) clearInterval(msgInterval); }
  }, [selectedContact?._id, selectedContact?.id]); 

  useEffect(() => {
      setMediaPreview(null); setReplyingTo(null); 
  }, [selectedContact?._id, selectedContact?.id]);

  const handleSendMessage = async (e) => {
      if(e) e.preventDefault();
      if(!selectedContact) return;
      const targetContactId = selectedContact._id || selectedContact.id;
      const textToSend = (drafts[targetContactId] || "").trim(); 
      const mediaToSend = mediaPreview ? mediaPreview.url : null;
      const typeToSend = mediaPreview ? mediaPreview.type : 'text';

      if(!textToSend && !mediaToSend) return; 

      setSending(true);
      try {
          const t = getToken();
          const payload = {
              contactId: targetContactId,
              to: selectedContact.phoneNumber || selectedContact.phone_number,
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

  // 🔥 Contact Filter Logic (Includes Status & Agent Filters) 🔥
  const filteredContacts = useMemo(() => {
    return contacts
      .filter(c => {
        if (selectedBiz && selectedBiz.id && c.owner_id && String(c.owner_id) !== String(selectedBiz.id)) return false;
        if (activePhase === 'FREE' && selectedBatchFilter !== 'All' && c.batch_id && String(c.batch_id) !== String(selectedBatchFilter)) return false;

        // Role Base Filtering 
        if (userRole === 'staff' || userRole === 'agent' || userRole === 'coordinator') {
             if (String(c.assigned_to) !== String(userId) && String(c.assignedTo) !== String(userId)) return false;
        }

        // Agent Filter (For Managers)
        if (selectedAgentFilter !== 'All') {
            if (String(c.assigned_to) !== String(selectedAgentFilter) && String(c.assignedTo) !== String(selectedAgentFilter)) return false;
        }

        // Status Filter
        if (selectedStatusFilter !== 'All') {
            if (String(c.status) !== String(selectedStatusFilter) && String(c.callStatus) !== String(selectedStatusFilter)) return false;
        }

        const contactPhone = c.phoneNumber || c.phone_number || "";
        if (searchTerm && !contactPhone.includes(searchTerm)) return false;
        
        const isAssigned = !!(c.assignedTo || c.assigned_to);
        if (activeTab === 'New Chat' && isAssigned) return false;
        if (activeTab === 'Assigned' && !isAssigned) return false;
        return true;
      })
      .sort((a, b) => {
          const aUnread = (a.unreadCount || a.unread_count) > 0 ? 1 : 0;
          const bUnread = (b.unreadCount || b.unread_count) > 0 ? 1 : 0;
          if (aUnread !== bUnread) return bUnread - aUnread; 
          return new Date(b.lastMessageTime || b.last_message_time || 0) - new Date(a.lastMessageTime || a.last_message_time || 0);
      });
  }, [contacts, searchTerm, activeTab, activePhase, selectedBiz, selectedBatchFilter, userRole, userId, selectedAgentFilter, selectedStatusFilter]);

  // 🔥 Assignment Functions 🔥
  const handleBulkAssign = async (qty, agentId) => {
      try {
          const t = getToken();
          await fetch(`${API_BASE_URL}/api/crm/leads/bulk-assign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
              body: JSON.stringify({ batch_id: selectedBatchFilter, staff_id: agentId, qty: qty, order: 'asc' })
          });
          loadData();
          alert("Successfully Assigned!");
      } catch (e) { alert("Failed to assign"); }
  };

  const handleSelectedAssign = async (agentId) => {
      if (selectedForAssign.length === 0) return alert("Select contacts first");
      try {
          const t = getToken();
          await fetch(`${API_BASE_URL}/api/crm/assign-chats`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
              body: JSON.stringify({ contactIds: selectedForAssign, agentId: agentId })
          });
          setSelectedForAssign([]);
          setIsAssignMode(false);
          loadData();
          alert("Successfully Assigned Selected!");
      } catch (e) { alert("Failed to assign"); }
  };

  const handleResetAssignments = async () => {
      if (!window.confirm("Are you sure you want to reset all assignments for this batch?")) return;
      try {
          const t = getToken();
          await fetch(`${API_BASE_URL}/api/crm/reset-assignments`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` },
              body: JSON.stringify({ batch_id: selectedBatchFilter })
          });
          loadData();
          alert("Assignments Reset!");
      } catch (e) { alert("Failed to reset"); }
  };

  // Dummy functions to prevent crashes
  const fetchApprovedTemplates = async () => {};
  const handleSendTemplateMessage = async (t) => { setShowSendTemplateModal(false); };
  const fetchQuickReplies = () => {};
  const handleSelectAutoSuggest = (t) => { setNewMessage(t.message); setShowTemplates(false); };
  const handleSelectTemplate = (t) => { setNewMessage(t.message); setShowTemplates(false); };
  const handleTemplateMediaUpload = (e) => {};
  const handleCreateQuickReply = () => {};
  const handleDeleteQuickReply = (id) => {};
  const handleTyping = (e) => { 
      setNewMessage(e.target.value); 
      if (e.target.value.endsWith('/')) setShowTemplates(true);
      else if (e.target.value.trim() === '') setShowTemplates(false);
  };
  const handleFileUpload = (e) => {};
  const startRecording = () => {};
  const stopRecording = () => {};
  const cancelRecording = () => {};
  const formatTime = (time) => "00:00";

  const stateProps = {
    contacts, agents, messages, selectedContact, setSelectedContact,
    isDarkMode, fontIndex, theme, setTheme, currentTheme, activePhase, batches, selectedBatchFilter, setSelectedBatchFilter,
    activeTab, setActiveTab, searchTerm, setSearchTerm, showLeadDetails, setShowLeadDetails,
    newMessage, setNewMessage, sending, mediaPreview, setMediaPreview, uploading, setUploading,
    replyingTo, setReplyingTo, handleSendMessage, filteredContacts, userRole, userId,
    showTemplates, setShowTemplates, templates, setTemplates, isCreatingTemplate, setIsCreatingTemplate,
    newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg,
    isRecording, setIsRecording, recordingTime, setRecordingTime, scrollRef,
    selectedAgentFilter, setSelectedAgentFilter, selectedStatusFilter, setSelectedStatusFilter,
    isAssignMode, setIsAssignMode, selectedForAssign, setSelectedForAssign, handleBulkAssign, handleSelectedAssign, handleResetAssignments,
    loggedInUser: { id: userId, role: userRole } // For RightPanel
  };

  return (
      <div className="flex flex-col w-full h-full gap-4 relative">
          
          {/* Top Bar for Manager Actions */}
          {(userRole === 'admin' || userRole === 'manager' || userRole === 'superadmin') && (
              <div className="flex justify-between items-center px-4 py-2 shrink-0 animate-in fade-in bg-slate-900/60 border border-white/5 rounded-2xl backdrop-blur-md shadow-lg z-40">
                  <div className="flex items-center gap-4">
                      {activePhase === 'FREE' && (
                          <div className="flex items-center gap-2">
                              <Layers size={16} className="text-blue-400" />
                              <select value={selectedBatchFilter} onChange={(e) => setSelectedBatchFilter(e.target.value)} className="bg-transparent text-white font-bold outline-none text-sm cursor-pointer border-b border-white/20 pb-1">
                                  <option value="All" className="bg-slate-900">🌍 All Batches</option>
                                  {batches.map(b => (
                                      <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>
                                  ))}
                              </select>
                          </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                          <Users size={16} className="text-emerald-400" />
                          <select value={selectedAgentFilter} onChange={(e) => setSelectedAgentFilter(e.target.value)} className="bg-transparent text-white font-bold outline-none text-sm cursor-pointer border-b border-white/20 pb-1">
                              <option value="All" className="bg-slate-900">All Agents</option>
                              {agents.map(a => (
                                  <option key={a.id} value={a.id} className="bg-slate-900">{a.first_name || a.name}</option>
                              ))}
                          </select>
                      </div>
                  </div>

                  <div className="flex items-center gap-2">
                      {isAssignMode ? (
                          <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/30">
                              <span className="text-xs font-bold text-blue-300">{selectedForAssign.length} Selected</span>
                              <select className="bg-slate-900 text-white text-xs p-1 rounded outline-none border border-white/10" onChange={(e) => { if(e.target.value) handleSelectedAssign(e.target.value); }}>
                                  <option value="">Assign To...</option>
                                  {agents.map(a => (<option key={a.id} value={a.id}>{a.first_name || a.name}</option>))}
                              </select>
                              <button onClick={() => { setIsAssignMode(false); setSelectedForAssign([]); }} className="text-xs text-red-400 hover:text-red-300 ml-2">Cancel</button>
                          </div>
                      ) : (
                          <button onClick={() => setIsAssignMode(true)} className="text-xs font-bold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/10 text-slate-300">Select & Assign</button>
                      )}
                      <button onClick={handleResetAssignments} className="text-xs font-bold px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition border border-red-500/20 flex items-center gap-1" title="Reset All Assignments in Batch"><RefreshCw size={12}/> Reset</button>
                  </div>
              </div>
          )}

          {/* MAIN CRM LAYOUT */}
          <div className="flex w-full flex-1 rounded-3xl overflow-hidden shadow-2xl relative transition-all border bg-slate-900/40 border-white/10 backdrop-blur-md">
            <ContactSidebar {...stateProps} />
            <ChatArea {...stateProps} />
            {showLeadDetails && <CampaignSidebar {...stateProps} />}
            <ChatModals {...stateProps} />
          </div>
      </div>
  );
}