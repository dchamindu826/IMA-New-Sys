import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { API_BASE_URL } from "../../config";
import ContactSidebar from "./ContactSidebar";
import ChatArea from "./ChatArea";
import CampaignSidebar from "./RightPanel"; 

export default function UserInbox({ isEmbedded = false, initialSelectedContact = null, activePhase = 'FREE', selectedBiz = null }) {
  const [contacts, setContacts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fontIndex, setFontIndex] = useState(1);
  const [theme, setTheme] = useState('blue'); 
  
  const currentTheme = { bg: 'bg-slate-900/60 backdrop-blur-xl', bubbleMe: 'bg-blue-600 text-white border-none', bubbleThem: 'bg-slate-800 text-gray-200 border-white/10', header: 'bg-black/40 border-white/10', text: 'text-white', subText: 'text-gray-400', icon: 'text-gray-400 hover:text-white hover:bg-white/10', inputBg: 'bg-black/40 border border-white/10 text-white' };

  const [activeTab, setActiveTab] = useState('All'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [showLeadDetails, setShowLeadDetails] = useState(true);

  // Batch States
  const [batches, setBatches] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');

  const [drafts, setDrafts] = useState({});
  const newMessage = selectedContact && drafts[selectedContact?._id || selectedContact?.id] !== undefined ? drafts[selectedContact?._id || selectedContact?.id] : "";
  const setNewMessage = (val) => { if (selectedContact) setDrafts(prev => ({ ...prev, [selectedContact._id || selectedContact.id]: val })); };
  
  const [sending, setSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // Quick Reply States
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

  const activeContactRef = useRef(null);
  const scrollRef = useRef(); 

  const token = localStorage.getItem('token');
  const userRole = (localStorage.getItem('role') || '').toLowerCase(); 
  const userName = localStorage.getItem('name') || 'Agent'; 
  const userId = localStorage.getItem('id') || localStorage.getItem('userId');

  // 🔥 FIX 1: loadData එක useCallback ඇතුලට දැම්මා 🔥
  const loadData = useCallback(async () => {
      try {
          if (!token) return;
          const headers = { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` };

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
  }, [token]);
  
  // Batches අදින එක
  useEffect(() => {
      if (selectedBiz && selectedBiz.id && token) {
          const headers = { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` };
          
          fetch(`${API_BASE_URL}/api/admin/batches/${selectedBiz.id}`, { headers })
          .then(res => {
              if (!res.ok) throw new Error("Unauthorized or Fetch Failed");
              return res.json();
          })
          .then(data => {
              const batchList = Array.isArray(data) ? data : (data.batches || data.data || []);
              setBatches(batchList);
          })
          .catch(e => console.error("Batches Fetch Error:", e));
      }
  }, [selectedBiz?.id, token]); 

  // Data Refresh වෙන Interval එක
  useEffect(() => { 
      loadData(); 
      const contactInterval = setInterval(loadData, 15000); 
      return () => clearInterval(contactInterval);
  }, [loadData]); 

  // 🔥 FIX 2: Selected Contact ගේ මැසේජ් අදින Interval එක 🔥
  useEffect(() => {
      activeContactRef.current = selectedContact;
      let msgInterval;

      const fetchMsgs = async () => {
          if (!activeContactRef.current || !token) return;
          const contactId = activeContactRef.current._id || activeContactRef.current.id;
          
          try {
              const res = await fetch(`${API_BASE_URL}/api/crm/messages/${contactId}`, { 
                  headers: { token: `Bearer ${token}` } 
              });
              const data = await res.json();
              
              if(Array.isArray(data)) {
                  setMessages(prev => {
                      if (prev.length !== data.length) return data;
                      if (prev.length > 0 && data.length > 0 && prev[prev.length-1]._id !== data[data.length-1]._id) return data;
                      return prev;
                  });
              }
          } catch(err) { console.error("Message Fetch Error:", err); }
      };

      if (selectedContact) {
          fetchMsgs();
          msgInterval = setInterval(fetchMsgs, 3000);
          
          setContacts(prev => prev.map(c => 
              (c._id || c.id) === (selectedContact._id || selectedContact.id) && (c.unreadCount > 0 || c.unread_count > 0)
                  ? { ...c, unreadCount: 0, unread_count: 0 } 
                  : c
          ));
      }

      return () => { if (msgInterval) clearInterval(msgInterval); }
  }, [selectedContact?._id, selectedContact?.id, token]); 

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
          const payload = {
              contactId: targetContactId,
              to: selectedContact.phoneNumber || selectedContact.phone_number,
              text: textToSend, 
              type: typeToSend,
              mediaUrl: mediaToSend,
              replyToMessageId: replyingTo ? replyingTo.whatsapp_message_id : null,
              replyContext: replyingTo ? (replyingTo.text || replyingTo.content || 'Media/Attachment') : null,
              agentName: userRole === 'agent' ? userName : 'Admin' 
          };

          const res = await fetch(`${API_BASE_URL}/api/crm/messages/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: `Bearer ${token}` },
              body: JSON.stringify(payload)
          });
          
          if(res.ok) {
              const sentMsg = await res.json();
              setDrafts(prev => ({ ...prev, [targetContactId]: "" }));
              if (activeContactRef.current && (activeContactRef.current._id || activeContactRef.current.id) === targetContactId) {
                  setMessages(prev => [...prev, sentMsg]);
                  setMediaPreview(null); setReplyingTo(null); 
              }
          }
      } catch(err) { console.error(err); } finally { setSending(false); }
  };

  const filteredContacts = useMemo(() => {
    return contacts
      .filter(c => {
        if (selectedBiz && selectedBiz.id && c.owner_id) {
            if (String(c.owner_id) !== String(selectedBiz.id) && String(c.ownerId) !== String(selectedBiz.id)) return false;
        }

        const p = String(c.phase || c.status).toUpperCase();
        const isFreePhase = p === '1' || p === 'FREE' || p === 'FREE_SEMINAR';

        if (activePhase === 'FREE') {
            if (!isFreePhase) return false;
            if (selectedBatchFilter !== 'All' && c.batch_id) {
                if (String(c.batch_id || c.batchId) !== String(selectedBatchFilter)) return false; 
            }
        } else if (activePhase === 'AFTER') {
            if (isFreePhase) return false; 
        }

        const contactPhone = c.phoneNumber || c.phone_number || "";
        if (searchTerm && !contactPhone.includes(searchTerm)) return false;
        
        const assignedId = c.assignedTo || c.assigned_to;
        const isAssigned = !!assignedId && assignedId !== 'null';

        if (activeTab === 'New Chat') {
            if (isAssigned) return false;
        } else if (activeTab === 'Assigned') {
            if (!isAssigned) return false;
        }
        return true;
      })
      .sort((a, b) => {
          const aUnread = (a.unreadCount || a.unread_count) > 0 ? 1 : 0;
          const bUnread = (b.unreadCount || b.unread_count) > 0 ? 1 : 0;
          if (aUnread !== bUnread) return bUnread - aUnread; 
          return new Date(b.lastMessageTime || b.last_message_time || 0) - new Date(a.lastMessageTime || a.last_message_time || 0);
      });
  }, [contacts, searchTerm, activeTab, activePhase, selectedBiz, selectedBatchFilter]);

  // Dummy functions to prevent crashes
  const fetchQuickReplies = () => {};
  const handleSelectAutoSuggest = (t) => { setNewMessage(t.message); setShowTemplates(false); };
  const fetchApprovedTemplates = () => {};
  const handleSelectTemplate = (t) => { setNewMessage(t.message); setShowTemplates(false); };
  const handleTemplateMediaUpload = (e) => {};
  const handleCreateQuickReply = () => {};
  const handleDeleteQuickReply = (id) => {};
  const handleTyping = (e) => { setNewMessage(e.target.value); };
  const handleFileUpload = (e) => {};
  const startRecording = () => {};
  const stopRecording = () => {};
  const cancelRecording = () => {};
  const formatTime = (time) => "00:00";

  const stateProps = {
    contacts, agents, messages, selectedContact, setSelectedContact,
    isDarkMode, fontIndex, theme, setTheme, currentTheme,
    activeTab, setActiveTab, searchTerm, setSearchTerm, 
    showLeadDetails, setShowLeadDetails,
    newMessage, setNewMessage, sending, mediaPreview, setMediaPreview, uploading, 
    replyingTo, setReplyingTo, handleSendMessage, filteredContacts, userRole, userId,
    showTemplates, setShowTemplates, suggestedReplies, templates, 
    isCreatingTemplate, setIsCreatingTemplate, newTemplateTitle, setNewTemplateTitle, 
    newTemplateMsg, setNewTemplateMsg, uploadingTemplateMedia, templateMediaPreview, setTemplateMediaPreview,
    isRecording, recordingTime, fetchQuickReplies, handleSelectAutoSuggest, fetchApprovedTemplates,
    handleSelectTemplate, handleTemplateMediaUpload, handleCreateQuickReply, handleDeleteQuickReply,
    handleTyping, handleFileUpload, startRecording, stopRecording, cancelRecording, formatTime, scrollRef
  };

  return (
      <div className="flex flex-col w-full h-full gap-4">
          {activePhase === 'FREE' && (
              <div className="flex justify-end items-center px-2 shrink-0 animate-in fade-in">
                  <div className="flex items-center gap-3 bg-slate-900/60 border border-blue-500/30 pl-4 pr-2 py-1.5 rounded-xl backdrop-blur-md shadow-lg z-40">
                      <Layers size={16} className="text-blue-400" />
                      <span className="text-sm font-bold text-slate-300 mr-2">Filter by Batch:</span>
                      <select 
                          value={selectedBatchFilter}
                          onChange={(e) => setSelectedBatchFilter(e.target.value)}
                          className="bg-blue-500/10 text-blue-300 font-bold outline-none border border-blue-500/20 rounded-lg px-3 py-1.5 cursor-pointer text-sm hover:bg-blue-500/20 transition-colors"
                      >
                          <option value="All">🌍 All Batches</option>
                          {batches.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                      </select>
                  </div>
              </div>
          )}
          <div className={`flex w-full flex-1 rounded-3xl overflow-hidden shadow-2xl relative transition-all border bg-slate-900/40 border-white/10 backdrop-blur-md`}>
            <ContactSidebar {...stateProps} />
            <ChatArea {...stateProps} />
            {showLeadDetails && <CampaignSidebar {...stateProps} />}
          </div>
      </div>
  );
}