import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import StaffContactSidebar from './StaffContactSidebar';
import StaffChatArea from './StaffChatArea';
import StaffRightPanel from './StaffRightPanel';

export default function StaffInbox({ activePhase, userId, userName }) {
  const [contacts, setContacts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const [chatFilter, setChatFilter] = useState('Assigned'); 
  const [chatSearch, setChatSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Chat Area Features States
  const [mediaPreview, setMediaPreview] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [theme, setTheme] = useState('blue'); 
  const [fontIndex, setFontIndex] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showLeadDetails, setShowLeadDetails] = useState(true);
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [approvedTemplates, setApprovedTemplates] = useState([]);

  const currentTheme = useMemo(() => {
      if (theme === 'light') return { bg: 'bg-[#efeae2]', bubbleMe: 'bg-[#d9fdd3] text-gray-800 border border-gray-200 shadow-sm', bubbleThem: 'bg-white text-gray-800 border border-gray-200 shadow-sm', header: 'bg-[#f0f2f5] border-gray-300', text: 'text-gray-900', subText: 'text-gray-500', icon: 'text-gray-500 hover:text-gray-700 hover:bg-gray-200', inputBg: 'bg-white border border-gray-300 text-gray-800', patternUrl: null };
      if (theme === 'whatsapp') return { bg: 'bg-[#0b141a]', bubbleMe: 'bg-[#005c4b] text-[#e9edef] border-none shadow-md', bubbleThem: 'bg-[#202c33] text-[#e9edef] border-none shadow-md', header: 'bg-[#202c33] border-[#2f3e46]', text: 'text-[#e9edef]', subText: 'text-[#8696a0]', icon: 'text-[#aebac1] hover:text-[#d1d7db] hover:bg-[#374045]', inputBg: 'bg-[#2a3942] border-none text-[#e9edef]', patternUrl: null };
      return { bg: 'bg-slate-900/60 backdrop-blur-xl', bubbleMe: 'bg-blue-600 text-white border-none shadow-lg shadow-blue-500/20', bubbleThem: 'bg-slate-800 text-gray-200 border-white/5 shadow-md', header: 'bg-black/40 border-white/5', text: 'text-white', subText: 'text-slate-400', icon: 'text-slate-400 hover:text-white hover:bg-white/10', inputBg: 'bg-black/40 border border-white/5 text-white shadow-inner', patternUrl: null };
  }, [theme]);

  const loadData = async () => {
    try {
      const [contactsRes, staffRes] = await Promise.all([
        api.get('/crm/contacts'),
        api.get('/team/agents')
      ]);
      setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let msgInterval;
    const fetchMsgs = async () => {
      if (!selectedContact) return;
      const contactId = selectedContact._id || selectedContact.id;
      try {
        const res = await api.get(`/crm/messages/${contactId}`);
        if (Array.isArray(res.data)) setMessages(res.data);
      } catch (err) {}
    };
    if (selectedContact) {
      fetchMsgs();
      msgInterval = setInterval(fetchMsgs, 3000);
    }
    return () => { if (msgInterval) clearInterval(msgInterval); }
  }, [selectedContact]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleContactClick = async (contact) => {
    setSelectedContact(contact);
    contact.unreadCount = 0; contact.unread_count = 0;
    try { await api.put(`/crm/contacts/${contact.id || contact._id}/read`); } catch (e) {}
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedContact || (!newMessage.trim() && !mediaPreview)) return;
    
    setSending(true);
    try {
      const targetContactId = selectedContact._id || selectedContact.id;
      const payload = {
        contactId: targetContactId,
        to: selectedContact.phoneNumber || selectedContact.phone_number,
        text: newMessage.trim(),
        type: mediaPreview ? mediaPreview.type : 'text',
        mediaUrl: mediaPreview ? mediaPreview.url : null,
        replyToMessageId: replyingTo ? replyingTo.wa_msg_id : null,
        replyContext: replyingTo ? (replyingTo.text || replyingTo.content || replyingTo.message) : null,
        agentName: userName
      };

      const res = await api.post('/crm/messages/send', payload);
      setNewMessage("");
      setMediaPreview(null);
      setReplyingTo(null);
      setMessages(prev => [...prev, res.data]);
    } catch (err) { toast.error("Failed to send message"); } 
    finally { setSending(false); }
  };

  const stateProps = {
    contacts, staffList: staffList, messages, selectedContact, setSelectedContact,
    activePhase, chatFilter, setChatFilter, chatSearch, setChatSearch,
    newMessage, setNewMessage, sending, mediaPreview, setMediaPreview, 
    uploading, setUploading, replyingTo, setReplyingTo, handleSendMessage, 
    userId, scrollRef, fetchContacts: loadData, userName,
    handleContactClick, theme, setTheme, currentTheme, fontIndex, isDarkMode, 
    showLeadDetails, setShowLeadDetails, showTemplates, setShowTemplates, 
    templates, setTemplates, isCreatingTemplate, setIsCreatingTemplate, 
    newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg, 
    isRecording, setIsRecording, recordingTime, setRecordingTime, 
    showSendTemplateModal, setShowSendTemplateModal, approvedTemplates, staff: staffList
  }; // 🔥 FIX: handleContactClick & Chat Features Added Here 🔥

  return (
    <div className="flex flex-col w-full h-full relative">
        <div className="flex w-full h-full rounded-3xl overflow-hidden shadow-2xl relative transition-all border bg-slate-900/40 border-white/10 backdrop-blur-md">
            
            <div className="w-[350px] shrink-0 border-r border-white/10 flex flex-col bg-black/20 z-30">
                <StaffContactSidebar {...stateProps} />
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-transparent z-10">
                <StaffChatArea {...stateProps} />
            </div>

            {showLeadDetails && (
              <div className="hidden lg:flex w-[320px] shrink-0 border-l border-white/10 flex-col bg-black/20 z-20">
                  <StaffRightPanel selectedContact={selectedContact} />
              </div>
            )}

        </div>
    </div>
  );
}