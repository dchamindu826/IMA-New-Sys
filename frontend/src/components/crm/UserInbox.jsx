import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Layers, Users, RefreshCw, X, Upload } from 'lucide-react';
import { API_BASE_URL } from "../../config";
import ContactSidebar from "./ContactSidebar";
import ChatArea from "./ChatArea";
import CampaignSidebar from "./RightPanel"; 
import ChatModals from "./ChatModals"; 
import ManagerAssignModal from "./ManagerAssignModal";
import toast from 'react-hot-toast';
import api from '../../api/axios'; 

const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken') || localStorage.getItem('jwt');

export default function UserInbox({ isEmbedded = false, initialSelectedContact = null, activePhase = 'FREE', selectedBiz = null, loggedInUser = null }) {
  const [contacts, setContacts] = useState([]);
  const [staff, setStaff] = useState([]); 
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

  const [activeTab, setActiveTab] = useState('New');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('All');
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState('All');

  const [showLeadDetails, setShowLeadDetails] = useState(true);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importForm, setImportForm] = useState({ name: '', phone: '' });
  const [isAssignMode, setIsAssignMode] = useState(false);
  const [selectedForAssign, setSelectedForAssign] = useState([]);

  const [batches, setBatches] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');

  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // 🔥 FIX: newMessage variable strictly defined here 🔥
  const newMessage = selectedContact && drafts[selectedContact?._id || selectedContact?.id] !== undefined ? drafts[selectedContact?._id || selectedContact?.id] : "";
  const setNewMessage = (val) => { 
      if (selectedContact) setDrafts(prev => ({ ...prev, [selectedContact._id || selectedContact.id]: val })); 
  };

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [showSendTemplateModal, setShowSendTemplateModal] = useState(false);
  const [approvedTemplates, setApprovedTemplates] = useState([]); 

  const activeContactRef = useRef(null);
  const scrollRef = useRef(); 

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUser = loggedInUser || storedUser;
  const userRole = (currentUser.role || '').toLowerCase().trim(); 
  const userName = currentUser.fName || currentUser.name || 'Agent'; 
  const userId = currentUser.id || localStorage.getItem('id');

  const loadData = useCallback(async () => {
      try {
          const t = getToken();
          if (!t) return;
          const headers = { 'Authorization': `Bearer ${t}`, 'token': `Bearer ${t}` };

          const [conRes, staffRes] = await Promise.all([
              fetch(`${API_BASE_URL}/api/crm/contacts`, { headers }),
              fetch(`${API_BASE_URL}/api/team/agents`, { headers }) 
          ]);
          
          if(conRes.ok) {
              const data = await conRes.json();
              setContacts(Array.isArray(data) ? data : []);
          }
          if(staffRes.ok) {
              const data = await staffRes.json();
              setStaff(Array.isArray(data) ? data : []);
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
          loadData();
          toast.success("Successfully Assigned!", { id: toastId });
      } catch (e) { toast.error("Failed to assign", { id: toastId }); }
  };

  const filteredContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];

    return contacts
      .filter(c => {
        if (selectedBiz && selectedBiz.id && String(c.owner_id || c.ownerId) !== String(selectedBiz.id)) return false;

        if (['staff', 'agent', 'coordinator'].includes(userRole)) {
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

        if (activeTab === 'All') return true;

        if (activeTab === 'New') {
            if (isAssigned || isImported) return false; 
        }
        if (activeTab === 'Assigned') {
            if (!isAssigned) return false;
            if (selectedAgentFilter !== 'All' && String(c.assignedTo || c.assigned_to) !== String(selectedAgentFilter)) return false;
            if (selectedPhaseFilter !== 'All' && String(c.status || c.phase) !== `PHASE_${selectedPhaseFilter}`) return false;
        }
        if (activeTab === 'Import') {
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
  }, [contacts, searchTerm, activeTab, selectedBiz, userRole, userId, selectedAgentFilter, selectedPhaseFilter]);

  const stateProps = {
    contacts, staff, messages, selectedContact, setSelectedContact,
    isDarkMode, fontIndex, theme, setTheme, currentTheme, activePhase,
    activeTab, setActiveTab, searchTerm, setSearchTerm, showLeadDetails, setShowLeadDetails,
    newMessage, setNewMessage, sending, mediaPreview, setMediaPreview, uploading, setUploading,
    replyingTo, setReplyingTo, handleSendMessage, filteredContacts, userRole, userId,
    showTemplates, setShowTemplates, templates, setTemplates, isCreatingTemplate, setIsCreatingTemplate,
    newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg,
    isRecording, setIsRecording, recordingTime, setRecordingTime, scrollRef,
    selectedAgentFilter, setSelectedAgentFilter, selectedPhaseFilter, setSelectedPhaseFilter,
    isAssignMode, setIsAssignMode, selectedForAssign, setSelectedForAssign, handleSelectedAssign,
    loggedInUser: currentUser, fetchContacts: loadData,
    setShowAssignModal, setShowImportModal, showSendTemplateModal, setShowSendTemplateModal,
    approvedTemplates 
  };

  return (
      <div className="flex flex-col w-full h-full relative">
          <div className="flex w-full h-full rounded-3xl overflow-hidden shadow-2xl relative transition-all border bg-slate-900/40 border-white/10 backdrop-blur-md">
            <ContactSidebar {...stateProps} />
            <ChatArea {...stateProps} />
            {showLeadDetails && <CampaignSidebar {...stateProps} />}
            <ChatModals {...stateProps} />
            
            {/* IMPORT MODAL */}
            {showImportModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                        <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Upload className="text-emerald-400"/> Import Contacts</h3>
                        
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!importForm.phone) return toast.error("Phone number is required!");
                            try {
                                await api.post('/crm/contact/add', { name: importForm.name || 'Guest', phoneNumber: importForm.phone });
                                toast.success("Contact Imported Successfully!");
                                setImportForm({ name: '', phone: '' });
                                setShowImportModal(false);
                                loadData();
                            } catch (error) { toast.error("Failed to import contact."); }
                        }} className="space-y-4 mb-6">
                            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Name (Optional)</label><input type="text" placeholder="e.g. Nimal" value={importForm.name} onChange={e => setImportForm({...importForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" /></div>
                            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Phone Number *</label><input type="text" required placeholder="e.g. 94714941559" value={importForm.phone} onChange={e => setImportForm({...importForm, phone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" /></div>
                            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg">Save Single Contact</button>
                        </form>

                        <div className="relative flex items-center py-4">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold">OR BULK IMPORT</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-500/10 rounded-xl cursor-pointer transition-colors group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                                <p className="mb-2 text-sm text-slate-300 font-bold"><span className="font-semibold">Click to upload</span> CSV file</p>
                                <p className="text-xs text-slate-500">Format: Phone, Name</p>
                            </div>
                            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const toastId = toast.loading("Reading CSV file...");
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                    const text = event.target.result;
                                    const lines = text.split('\n');
                                    const contactsToImport = [];
                                    for (let i = 0; i < lines.length; i++) {
                                        const line = lines[i].trim();
                                        if (!line) continue;
                                        const parts = line.split(',');
                                        const phone = parts[0]?.trim();
                                        const name = parts[1]?.trim() || '';
                                        if (phone && phone.length >= 9) {
                                            contactsToImport.push({ phoneNumber: phone, name: name });
                                        }
                                    }
                                    if (contactsToImport.length === 0) return toast.error("No valid contacts found", { id: toastId });
                                    try {
                                        toast.loading(`Importing ${contactsToImport.length} contacts...`, { id: toastId });
                                        await api.post('/crm/contact/bulk-add', { contacts: contactsToImport });
                                        toast.success(`${contactsToImport.length} Contacts Imported!`, { id: toastId });
                                        setShowImportModal(false);
                                        loadData();
                                    } catch (error) { toast.error("Bulk import failed.", { id: toastId }); }
                                    e.target.value = null; 
                                };
                                reader.readAsText(file);
                            }} />
                        </label>
                    </div>
                </div>
            )}

            {/* 🔥 MANAGER ASSIGN MODAL (PORTAL FIX) 🔥 */}
            {showAssignModal && (
               <ManagerAssignModal 
                  onClose={() => setShowAssignModal(false)} 
                  selectedBatch={"All"} 
               />
            )}
          </div>
      </div>
  );
}