import React, { useState, useEffect } from 'react';
import { 
    Link, Copy, Send, Users, FileText, Download, 
    Calendar, Paperclip, Search, CheckSquare, Square, 
    Loader, RefreshCw, Clock, CheckCircle, XCircle, LayoutTemplate, Zap 
} from 'lucide-react';
// 🔥 FIX: Path එක හරියටම හැදුවා 🔥
import { API_BASE_URL } from "../../config";

const UserTools = ({ isEmbedded = false, activePhase = 'FREE', selectedBiz = null }) => {
  const CLOUD_NAME = "dyixoaldi"; 
  const UPLOAD_PRESET = "Chat Bot System"; 

  const [activeTab, setActiveTab] = useState('link');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]); 
  
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  
  const [campaignName, setCampaignName] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');

  const [useTemplate, setUseTemplate] = useState(false); 
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({}); 
  const [customMsg, setCustomMsg] = useState(''); 

  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const token = localStorage.getItem('token');

  const fetchContacts = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/api/crm/contacts`, { headers: { token: `Bearer ${token}` } });
          const data = await res.json();
          if(Array.isArray(data)) {
              const sorted = data.sort((a, b) => new Date(b.last_message_time || b.lastMessageTime) - new Date(a.last_message_time || a.lastMessageTime));
              setContacts(sorted);
          }
      } catch (err) { console.error(err); }
  };

  const fetchHistory = async () => {
      try {
          const res = await fetch(`${API_BASE_URL}/api/broadcast`, { headers: { token: `Bearer ${token}` } });
          const data = await res.json();
          if(Array.isArray(data)) setBroadcastHistory(data);
      } catch (err) { console.error(err); }
  };

  const fetchTemplates = async () => {
      try {
          const currentToken = localStorage.getItem('token');
          if (!currentToken) return;

          const url = (selectedBiz && selectedBiz.id) 
              ? `${API_BASE_URL}/api/templates?businessId=${selectedBiz.id}` 
              : `${API_BASE_URL}/api/templates`;

          const res = await fetch(url, { 
              headers: { 
                  'Authorization': `Bearer ${currentToken}`, // 🔥 මේක අනිවාර්යයි
                  'token': `Bearer ${currentToken}` 
              } 
          });
          const data = await res.json();
          if(Array.isArray(data)) {
              setTemplates(data); 
          }
      } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchContacts();
    if(activeTab === 'broadcast') {
        fetchHistory();
        fetchTemplates();
    }
  }, [activeTab]);

  const exportToCSV = () => {
    const csvRows = [];
    csvRows.push(['Phone Number', 'Name', 'Last Active']); 
    contacts.forEach(c => {
        csvRows.push([c.phoneNumber, c.name || 'Unknown', c.lastMessageTime || c.last_message_time || 'N/A']);
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `whatsapp_contacts.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setUploading(true);
    setMediaFile(file);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET); 
    formData.append("cloud_name", CLOUD_NAME);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: formData });
        const data = await res.json();
        setMediaUrl(data.secure_url);
    } catch (err) {
        alert("Upload Failed");
    } finally {
        setUploading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if(selectedContacts.length === 0) return alert("Please select contacts first!");
    
    if (!useTemplate) {
        if (!customMsg && !mediaUrl) return alert("Please enter a message or select an image!");
        if(!window.confirm(`Send this Free Broadcast to the ${selectedContacts.length} selected users?`)) return;

        setSending(true);
        let msgType = 'text';
        if (mediaUrl) {
            if (mediaFile?.type.startsWith('image')) msgType = 'image';
            else if (mediaFile?.type.startsWith('video')) msgType = 'video';
            else msgType = 'document';
        }

        const recipientNumbers = selectedContacts.map(id => {
            const contact = contacts.find(c => c._id === id);
            return contact ? contact.phoneNumber : null;
        }).filter(Boolean);

        try {
            const payload = {
                messageText: customMsg,
                mediaUrl: mediaUrl,
                mediaType: msgType,
                recipients: recipientNumbers 
            };

            const res = await fetch(`${API_BASE_URL}/api/broadcast/send-24h`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', token: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if(res.ok) {
                alert(`🚀 ${data.message}`);
                setCustomMsg('');
                setMediaUrl('');
                setMediaFile(null);
                setSelectedContacts([]); 
            } else {
                alert(`❌ Broadcast Failed: ${data.message}`);
            }
        } catch (err) {
            console.error(err);
            alert("❌ Server Error");
        } finally {
            setSending(false);
        }
        return; 
    }

    if(!campaignName) return alert("Please give a Campaign Name!");
    if(!scheduleTime) return alert("Please select a Schedule Time!");
    if (!selectedTemplate) return alert("Please select a template!");
    if (selectedTemplate.status !== 'APPROVED') {
        return alert(`This template is currently ${selectedTemplate.status}. You can only send APPROVED templates.`);
    }

    const headerFormat = selectedTemplate?.components?.find(c => c.type === 'HEADER')?.format;
    const isMediaRequired = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);
    
    if (isMediaRequired && !mediaUrl) {
        return alert(`This template requires a ${headerFormat} header! Please upload one.`);
    }

    if(!window.confirm(`Schedule "${campaignName}" for ${selectedContacts.length} people?`)) return;

    setSending(true);

    const recipientNumbers = selectedContacts.map(id => {
        const contact = contacts.find(c => c._id === id);
        return contact ? contact.phoneNumber : null;
    }).filter(Boolean);

    let msgType = 'text';
    if (mediaUrl) {
        if (mediaFile?.type.startsWith('image')) msgType = 'image';
        else if (mediaFile?.type.startsWith('video')) msgType = 'video';
        else msgType = 'document';
    }

    try {
        const payload = {
            name: campaignName,
            recipients: recipientNumbers,
            scheduledTime: new Date(scheduleTime).toISOString(),
            isTemplate: true,
            messageType: 'template',
            message: customMsg,
            mediaUrl: mediaUrl,
            templateName: selectedTemplate?.name,
            templateLanguage: selectedTemplate?.language,
            templateVariables: Object.values(templateVars)
        };

        const res = await fetch(`${API_BASE_URL}/api/broadcast/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            alert("✅ Campaign Scheduled!");
            setCampaignName(''); setCustomMsg(''); setMediaUrl(''); setMediaFile(null); setScheduleTime(''); setSelectedContacts([]); setTemplateVars({});
            fetchHistory();
        } else {
            alert("Failed to create campaign.");
        }
    } catch (err) {
        console.error(err);
        alert("Server Error");
    } finally {
        setSending(false);
    }
  };

  const toggleSelect = (id) => {
    if(selectedContacts.includes(id)) setSelectedContacts(selectedContacts.filter(c => c !== id));
    else setSelectedContacts([...selectedContacts, id]);
  };

  const toggleSelectAll = () => {
    if(selectedContacts.length === contacts.length) setSelectedContacts([]);
    else setSelectedContacts(contacts.map(c => c._id));
  };

  const select24hActive = () => {
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      const activeIds = contacts.filter(c => {
          const lastActive = new Date(c.lastMessageTime || c.last_message_time || 0).getTime();
          return (now - lastActive) <= twentyFourHours;
      }).map(c => c._id);

      if (activeIds.length === 0) {
          alert("No contacts found who messaged you in the last 24 hours.");
      } else {
          setSelectedContacts(activeIds);
          alert(`${activeIds.length} active contacts selected!`);
      }
  };

  const getVariableCount = (text) => {
      if (!text) return 0;
      const matches = text.match(/{{/g);
      return matches ? matches.length : 0;
  };

  const headerFormat = selectedTemplate?.components?.find(c => c.type === 'HEADER')?.format;
  const isMediaTemplate = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);
  const showMediaUpload = !useTemplate || (useTemplate && isMediaTemplate);

  const filteredContacts = contacts.filter(c => {
        // Business filter
        if (selectedBiz && selectedBiz.id && String(c.owner_id || c.ownerId) !== String(selectedBiz.id)) return false;

        // Phase Filter
        const cPhase = parseInt(c.phase || c.status || 1);
        if (activePhase === 'FREE' && cPhase !== 1) return false;
        if (activePhase === 'AFTER' && cPhase === 1) return false;

        return c.phoneNumber.includes(searchTerm);
  });
  
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const currentData = filteredContacts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isDark = true;
  const bgColor = isEmbedded ? 'bg-transparent' : 'bg-[#0B1120]';
  const cardColor = isDark ? 'bg-black/20 border-white/5 backdrop-blur-md' : 'bg-white border-gray-200 shadow-sm';
  const textColor = isDark ? 'text-white' : 'text-slate-800';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300 text-slate-800';

  return (
      <div className={`h-full flex flex-col ${bgColor} transition-colors duration-300`}>
        
        <div className="flex gap-4 overflow-x-auto pb-4 shrink-0 border-b border-white/10 mb-4">
            {[
                { id: 'link', icon: Link, label: 'Link Generator' },
                { id: 'broadcast', icon: Send, label: 'Broadcast Campaign' },
                { id: 'contacts', icon: Users, label: 'Contact List' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : `bg-black/20 text-slate-400 hover:text-white border border-white/5`}`}
                >
                    <tab.icon size={16}/> {tab.label}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {activeTab === 'link' && (
                <div className={`${cardColor} p-8 rounded-3xl border animate-in fade-in max-w-3xl`}>
                    <h3 className={`font-bold text-xl mb-6 flex items-center gap-2 ${textColor}`}><Link className="text-blue-500"/> WhatsApp Link Generator</h3>
                    <div className="space-y-4">
                        <input type="text" placeholder="Phone (e.g. 9477...)" value={phone} onChange={(e) => setPhone(e.target.value)} className={`w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}/>
                        <textarea placeholder="Your Message..." rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className={`w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}/>
                        <button onClick={() => {navigator.clipboard.writeText(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`); alert("Copied!");}} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500 transition shadow-lg w-full md:w-auto">
                            <Copy size={18}/> Copy Link
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'broadcast' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in h-full">
                    
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2">
                        <div className={`${cardColor} p-6 rounded-3xl border`}>
                            <h3 className={`font-bold text-lg mb-4 ${textColor}`}>Create Campaign</h3>
                            <div className="space-y-4">
                                
                                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                    <button onClick={() => setUseTemplate(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!useTemplate ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Free Broadcast (24h)</button>
                                    <button onClick={() => setUseTemplate(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${useTemplate ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Meta Template (Paid)</button>
                                </div>

                                {useTemplate && (
                                    <>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold">Campaign Name</label>
                                            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Feb Intake" className={`w-full p-3 rounded-xl mt-1 outline-none ${inputBg}`}/>
                                        </div>
                                        <div className="space-y-4 animate-in fade-in">
                                            <div>
                                                <label className="text-xs text-slate-400 uppercase font-bold">Select Template</label>
                                                <select 
                                                    onChange={(e) => {
                                                        const tpl = templates.find(t => t.id === e.target.value);
                                                        setSelectedTemplate(tpl);
                                                        setTemplateVars({});
                                                        setMediaUrl('');
                                                    }} 
                                                    className={`w-full p-3 rounded-xl mt-1 outline-none ${inputBg}`}
                                                >
                                                    <option value="">-- Choose Template --</option>
                                                    {templates.map(t => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name} ({t.language}) - [{t.status}]
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {selectedTemplate && (
                                                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-xs text-slate-500 font-bold">PREVIEW</p>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedTemplate.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                            {selectedTemplate.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedTemplate.components.find(c => c.type === 'BODY')?.text}</p>
                                                    
                                                    {getVariableCount(selectedTemplate.components.find(c => c.type === 'BODY')?.text || '') > 0 && (
                                                        <div className="mt-4 space-y-2">
                                                            <p className="text-xs text-orange-400 font-bold">Variables ({'{{1}}'}, {'{{2}}'})</p>
                                                            {Array.from({ length: getVariableCount(selectedTemplate.components.find(c => c.type === 'BODY')?.text) }).map((_, i) => (
                                                                <input 
                                                                    key={i} 
                                                                    type="text" 
                                                                    placeholder={`Value for {{${i+1}}}`} 
                                                                    className={`w-full p-2 rounded-lg text-sm ${inputBg}`}
                                                                    onChange={(e) => setTemplateVars({...templateVars, [i]: e.target.value})}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {!useTemplate && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-2">
                                        <p className="text-emerald-400 text-sm flex items-start gap-2">
                                            <Zap className="mt-0.5 shrink-0" size={16} />
                                            <span><strong>Free Broadcast:</strong> Instantly send message to ALL users active within 24 hours.</span>
                                        </p>
                                    </div>
                                )}
                                
                                {!useTemplate && (
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold">Message</label>
                                        <textarea value={customMsg} onChange={(e) => setCustomMsg(e.target.value)} placeholder="Type message..." rows={4} className={`w-full p-3 rounded-xl mt-1 outline-none ${inputBg}`}/>
                                    </div>
                                )}
                                
                                {showMediaUpload && (
                                    <>
                                        <div className="flex gap-2">
                                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl cursor-pointer border border-dashed transition border-slate-600 hover:bg-white/5 hover:border-blue-500`}>
                                                {uploading ? <Loader className="animate-spin text-blue-500"/> : <Paperclip size={18} className={subText}/>} 
                                                <span className={subText}>{mediaFile ? mediaFile.name : (useTemplate ? "Upload Template Media" : "Attach Image/Video")}</span>
                                                <input type="file" className="hidden" onChange={handleFileUpload}/>
                                            </label>
                                        </div>
                                        {mediaUrl && <p className="text-xs text-emerald-500">File Ready ✅</p>}
                                    </>
                                )}

                                {useTemplate && (
                                    <div className={`p-4 rounded-xl border ${inputBg}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar size={18} className="text-orange-500"/> <span className={`font-bold ${textColor}`}>Schedule Time</span>
                                        </div>
                                        <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className={`w-full p-2 rounded-lg outline-none bg-black/40 text-white`} style={{colorScheme: 'dark'}}/>
                                    </div>
                                )}

                                <button onClick={handleCreateCampaign} disabled={sending || uploading} className={`w-full py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50 ${useTemplate ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                                    {sending ? <Loader className="animate-spin" size={20}/> : (useTemplate ? <Clock size={20}/> : <Send size={20}/>)}
                                    {sending ? 'Processing...' : (useTemplate ? 'Schedule Paid Template' : 'Send Free Broadcast')}
                                </button>
                            </div>
                        </div>
                        {useTemplate && (
                            <div className={`${cardColor} p-6 rounded-3xl border h-[300px] overflow-hidden flex flex-col`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className={`font-bold text-lg ${textColor}`}>History</h3>
                                    <button onClick={fetchHistory} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white"><RefreshCw size={16}/></button>
                                </div>
                                <div className="overflow-y-auto custom-scrollbar space-y-3 flex-1">
                                    {broadcastHistory.length === 0 ? <p className="text-center text-slate-500 text-sm">No campaigns yet.</p> : 
                                    broadcastHistory.map(job => (
                                        <div key={job._id} className="p-3 border border-white/5 rounded-xl bg-white/5 flex justify-between items-center">
                                            <div>
                                                <p className={`font-bold text-sm ${textColor}`}>{job.name}</p>
                                                <p className="text-xs text-slate-400">{new Date(job.scheduledTime).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                                                    job.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-amber-500/20 text-amber-400'
                                                }`}>{job.status}</span>
                                                <div className="flex gap-2 text-xs mt-1">
                                                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={10}/> {job.successCount}</span>
                                                    <span className="text-red-400 flex items-center gap-1"><XCircle size={10}/> {job.failCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={`${cardColor} p-6 rounded-3xl border flex flex-col h-[800px]`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`font-bold text-lg ${textColor}`}>Select Contacts ({selectedContacts.length})</h3>
                        </div>
                        
                        <div className="flex gap-2 mb-4 bg-black/20 p-1.5 rounded-xl">
                            <button onClick={select24hActive} className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-bold rounded-lg transition flex justify-center items-center gap-1">
                                <Zap size={14}/> Select 24h Active
                            </button>
                            <button onClick={toggleSelectAll} className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-bold rounded-lg transition flex justify-center items-center gap-1">
                                <Users size={14}/> Select All
                            </button>
                            <button onClick={() => setSelectedContacts([])} className="flex-1 py-1.5 bg-slate-600/20 hover:bg-slate-600 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition">
                                Clear
                            </button>
                        </div>

                        <input type="text" placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full p-3 rounded-xl mb-4 outline-none ${inputBg}`}/>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {filteredContacts.map(contact => {
                                const isSelected = selectedContacts.includes(contact._id);
                                const lastActiveDate = new Date(contact.lastMessageTime || contact.last_message_time || 0);
                                const is24hActive = (new Date().getTime() - lastActiveDate.getTime()) <= (24 * 60 * 60 * 1000);

                                return (
                                    <div key={contact._id} onClick={() => toggleSelect(contact._id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : `border-transparent hover:bg-white/5`}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs bg-slate-700`}>
                                                {contact.phoneNumber.slice(-2)}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm flex items-center gap-2 ${textColor}`}>
                                                    {contact.phoneNumber}
                                                    {is24hActive && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active in last 24h"></span>}
                                                </p>
                                                <p className="text-xs text-slate-400">{contact.name || "Unknown"} • {lastActiveDate.toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        {isSelected ? <CheckSquare className="text-blue-500"/> : <Square className="text-slate-500"/>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'contacts' && (
                <div className={`${cardColor} rounded-3xl border overflow-hidden animate-in fade-in h-full flex flex-col`}>
                    <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4 shrink-0">
                        <div>
                            <h3 className={`font-bold text-xl ${textColor}`}>All Contacts ({contacts.length})</h3>
                            <p className={subText}>List of all numbers that messaged the bot.</p>
                        </div>
                        <div className="flex gap-2">
                             <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`p-2.5 rounded-lg outline-none w-48 ${inputBg}`}/>
                            <button onClick={exportToCSV} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition shadow-lg">
                                <Download size={18}/> Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className={`bg-black/20 text-slate-400 text-xs uppercase font-bold`}>
                                <tr>
                                    <th className="p-4">#</th>
                                    <th className="p-4">Phone Number</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Last Active</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y divide-white/5`}>
                                {currentData.map((contact, index) => {
                                    const is24hActive = (new Date().getTime() - new Date(contact.lastMessageTime || contact.last_message_time || 0).getTime()) <= (24 * 60 * 60 * 1000);
                                    
                                    return (
                                        <tr key={contact._id} className={`transition hover:bg-white/5`}>
                                            <td className={`p-4 ${subText}`}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                            <td className={`p-4 font-bold ${textColor}`}>{contact.phoneNumber}</td>
                                            <td className={`p-4 ${textColor}`}>{contact.name || "-"}</td>
                                            <td className={`p-4 ${subText}`}>{new Date(contact.lastMessageTime || contact.last_message_time || contact.updatedAt).toLocaleString()}</td>
                                            <td className="p-4">
                                                {is24hActive ? 
                                                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold border border-emerald-500/20 flex items-center gap-1 w-max"><Zap size={10}/> Active 24h</span> 
                                                    : 
                                                    <span className="px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs font-bold border border-slate-500/20">Inactive</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className={`p-4 flex justify-between items-center bg-black/20`}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 bg-white/10 text-white`}>Previous</button>
                        <span className={subText}>Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 bg-white/10 text-white`}>Next</button>
                    </div>
                </div>
            )}
        </div>
      </div>
  );
};
export default UserTools;