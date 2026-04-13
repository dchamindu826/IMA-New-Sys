import React, { useRef, useEffect, useState } from 'react';
import { Paperclip, Zap, Send, Mic, X, StopCircle, Trash2, MessageSquare, Loader, FileText, Play, Download, ClipboardList, CheckCheck, Reply, PlusCircle, LayoutTemplate, Image as ImageIcon } from 'lucide-react';
import { API_BASE_URL } from "../../../config";

const FONT_SIZES = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];
const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken');

const formatChatDateHeader = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ChatArea = (props) => {
    const {
        selectedContact, messages, isDarkMode, staff,
        newMessage, setNewMessage, handleSendMessage, sending,
        mediaPreview, setMediaPreview, uploading, setUploading,
        isRecording, setIsRecording, recordingTime, setRecordingTime,
        showTemplates, setShowTemplates, templates, setTemplates, 
        isCreatingTemplate, setIsCreatingTemplate, newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg,
        replyingTo, setReplyingTo, scrollRef, fontIndex,
        theme, setTheme, currentTheme, showLeadDetails, setShowLeadDetails,
        fetchApprovedTemplates, setShowSendTemplateModal, userId
    } = props;

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const timerRef = useRef(null);

    const [personalReplies, setPersonalReplies] = useState([]);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrForm, setQrForm] = useState({ id: null, name: '', body: '', mediaUrl: '', mediaType: '', mediaName: '' });
    const [qrUploading, setQrUploading] = useState(false);
    const [suggestedReplies, setSuggestedReplies] = useState([]);

    useEffect(() => {
        if (setTheme) setTheme('light');
        const currentUserId = userId || localStorage.getItem('id') || 'default';
        const saved = localStorage.getItem(`quick_replies_${currentUserId}`);
        if (saved) setPersonalReplies(JSON.parse(saved));
    }, [userId, setTheme]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedContact]);

    const uploadToCloudinary = async (file, type, isForQR = false) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Chat Bot System"); 
        formData.append("cloud_name", "dyixoaldi"); 
        
        if(isForQR) setQrUploading(true); else setUploading(true);
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/dyixoaldi/auto/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if(isForQR) {
                setQrForm(prev => ({...prev, mediaUrl: data.secure_url, mediaType: type, mediaName: file.name}));
            } else {
                setMediaPreview({ url: data.secure_url, type: type, name: file.name || 'Attachment' });
            }
        } catch (e) {
            alert("File upload failed!");
        } finally {
            if(isForQR) setQrUploading(false); else setUploading(false);
        }
    };

    const handleFileUpload = (e, isForQR = false) => {
        const file = e.target.files[0];
        if(!file) return;
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        uploadToCloudinary(file, type, isForQR);
        e.target.value = null;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp3' });
                const file = new File([audioBlob], "Voice_Message.mp3", { type: 'audio/mp3' });
                uploadToCloudinary(file, 'audio');
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch(e) { alert("Microphone access denied!"); }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
            mediaRecorder.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
            mediaRecorder.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            setMediaPreview(null);
        }
    };

    const formatTime = (time) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;

    const fetchQuickReplies = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/templates`, { headers: { 'Authorization': `Bearer ${getToken()}`, 'token': `Bearer ${getToken()}` } });
            const data = await res.json();
            if(Array.isArray(data)) setTemplates(data);
        } catch(e) {}
    };

    const savePersonalReply = () => {
        if(!qrForm.name || (!qrForm.body && !qrForm.mediaUrl)) return alert("Name and Body/Media are required!");
        let updated;
        if (qrForm.id) updated = personalReplies.map(r => r.id === qrForm.id ? qrForm : r);
        else updated = [...personalReplies, { ...qrForm, id: Date.now() }];
        
        setPersonalReplies(updated);
        const currentUserId = userId || localStorage.getItem('id') || 'default';
        localStorage.setItem(`quick_replies_${currentUserId}`, JSON.stringify(updated));
        setQrForm({ id: null, name: '', body: '', mediaUrl: '', mediaType: '', mediaName: '' });
    };

    const deletePersonalReply = (e, id) => {
        e.stopPropagation();
        if(!window.confirm("Are you sure you want to delete this reply?")) return;
        const updated = personalReplies.filter(r => r.id !== id);
        setPersonalReplies(updated);
        const currentUserId = userId || localStorage.getItem('id') || 'default';
        localStorage.setItem(`quick_replies_${currentUserId}`, JSON.stringify(updated));
    };

    const useQuickReply = (reply) => {
        setNewMessage(reply.body || "");
        if (reply.mediaUrl) setMediaPreview({ url: reply.mediaUrl, type: reply.mediaType, name: reply.mediaName || "Attachment" });
        setSuggestedReplies([]);
        setShowQRModal(false);
    };

    const handleTyping = (e) => { 
        const val = e.target.value;
        setNewMessage(val); 

        if (val.includes('/')) {
            setShowTemplates(true);
            fetchQuickReplies();
        } else {
            setShowTemplates(false);
        }

        if (val.trim().length > 1 && !val.includes('/')) {
            const matches = personalReplies.filter(r => r.name.toLowerCase().includes(val.trim().toLowerCase()));
            setSuggestedReplies(matches);
        } else {
            setSuggestedReplies([]);
        }
    };

    if (!selectedContact) {
        return (
            <div className={`flex-1 flex flex-col items-center justify-center transition-colors z-10 ${isDarkMode ? 'text-slate-500 bg-[#0B1120]' : 'text-gray-400 bg-[#f0f2f5]'}`}>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-pulse ${isDarkMode ? 'bg-[#1e293b]/50 border border-white/5' : 'bg-white border border-gray-200'}`}>
                    <MessageSquare size={40} className="text-indigo-400 opacity-80"/>
                </div>
                <h1 className="text-2xl font-bold mb-2 text-white">Select a Conversation</h1>
            </div>
        );
    }
    
    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-300 border-x ${currentTheme.bg} ${theme === 'light' ? 'border-gray-300' : 'border-slate-600'}`}>
            
            <div className={`${currentTheme.header} p-3 lg:p-4 border-b flex flex-wrap justify-between items-center z-20 shadow-sm transition-colors gap-3`}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-500 flex items-center justify-center font-bold text-white shadow-lg">
                        {((selectedContact.name && !selectedContact.name.toLowerCase().includes('guest') ? selectedContact.name : (selectedContact.phoneNumber || selectedContact.phone_number || '#'))).charAt(0)}
                    </div>
                    <div>
                        <h3 className={`font-bold text-base flex items-center gap-2 ${currentTheme.text}`}>
                            {selectedContact.name && !selectedContact.name.toLowerCase().includes('guest') ? selectedContact.name : (selectedContact.phoneNumber || selectedContact.phone_number)}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-2 bg-black/10 p-1 rounded-lg border border-black/5 hidden md:flex">
                        <button onClick={() => setTheme('light')} className={`w-4 h-4 rounded-full bg-[#efeae2] border border-gray-400 ${theme === 'light' ? 'ring-2 ring-blue-500' : ''}`}></button>
                        <button onClick={() => setTheme('whatsapp')} className={`w-4 h-4 rounded-full bg-[#005c4b] ${theme === 'whatsapp' ? 'ring-2 ring-white' : ''}`}></button>
                        <button onClick={() => setTheme('blue')} className={`w-4 h-4 rounded-full bg-blue-600 ${theme === 'blue' ? 'ring-2 ring-white' : ''}`}></button>
                    </div>
                    <button onClick={() => setShowLeadDetails(!showLeadDetails)} className={`p-2 rounded-lg transition border ${showLeadDetails ? `bg-indigo-500 text-white shadow-lg` : `${currentTheme.icon}`}`}><ClipboardList size={18}/></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 z-10 relative custom-scrollbar">
                
                {(() => {
                    let lastDateHeader = '';
                    
                    return messages.map((msg, index) => {
                        let rawText = msg.message || msg.text || msg.content || "";
                        let msgText = rawText;
                        let mediaUrl = msg.mediaUrl || msg.media_url || null;

                        if (!mediaUrl && rawText.includes("http")) {
                            const urlMatch = rawText.match(/(https?:\/\/[^\s]+)/);
                            if (urlMatch) {
                                mediaUrl = urlMatch[0];
                                msgText = rawText.replace(mediaUrl, "").trim(); 
                            }
                        }

                        if (typeof msgText !== 'string') { try { msgText = JSON.stringify(msgText); } catch(e) { msgText = ""; } }
                        msgText = msgText.replace(/(\s*\n\s*){3,}/g, '\n\n').trim(); 
                        
                        const isMe = msg.direction === 'outbound' || msg.sender === 'me' || msg.sender_type === 'STAFF' || msg.sender_type === 'AI_BOT' || msg.sender_type === 'SYSTEM';
                        
                        let senderLabel = '';
                        if (isMe) {
                            if (msg.sender_type === 'AI_BOT') senderLabel = '🤖 AI Bot';
                            else if (msg.sender_type === 'SYSTEM' || msg.sender_type === 'AUTO_REPLY') senderLabel = '⚙️ System Auto Reply';
                            else {
                                let roleStr = '';
                                const agentName = msg.agentName || msg.agent_name || msg.senderName || 'Staff';
                                if (staff && staff.length > 0) {
                                    const matchedStaff = staff.find(s => s.fName === agentName || s.name === agentName || (msg.sender_id && s.id == msg.sender_id));
                                    if (matchedStaff && matchedStaff.role) {
                                        roleStr = ` - ${matchedStaff.role}`;
                                    }
                                }
                                senderLabel = `👤 ${agentName}${roleStr}`;
                            }
                        }

                        const msgDate = new Date(msg.created_at || msg.createdAt || Date.now());
                        const currentDateHeader = formatChatDateHeader(msgDate);
                        const showDateHeader = currentDateHeader !== lastDateHeader;
                        if (showDateHeader) {
                            lastDateHeader = currentDateHeader;
                        }

                        // 🔥 FIX: Text Colors explicitly handled for Light Theme (both for me and incoming) 🔥
                        const isLightTheme = theme === 'light';
                        const textColorClass = isLightTheme ? 'text-gray-800' : 'text-gray-100';
                        const captionTextColorClass = isLightTheme ? 'text-gray-800 font-medium' : 'text-gray-100 font-medium';
                        const timeColorClass = isLightTheme ? 'text-gray-500' : 'text-gray-400';

                        return (
                            <React.Fragment key={msg._id || msg.id || index}>
                                
                                {showDateHeader && (
                                    <div className="flex justify-center my-4 w-full">
                                        <span className="bg-slate-800/80 backdrop-blur-sm px-4 py-1.5 rounded-xl text-[11px] font-bold text-slate-300 border border-white/10 shadow-sm uppercase tracking-widest">
                                            {currentDateHeader}
                                        </span>
                                    </div>
                                )}

                                <div className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'} mb-2`}>
                                    
                                    {isMe && senderLabel && (
                                        <span className="text-[10px] font-bold mb-1">
                                            <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full shadow-sm">{senderLabel}</span>
                                        </span>
                                    )}

                                    <div className={`relative group p-1.5 rounded-2xl shadow-sm border ${isMe ? `${currentTheme.bubbleMe} rounded-tr-none` : `${currentTheme.bubbleThem} rounded-tl-none`}`}>
                                        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 ${isMe ? '-left-10' : '-right-10'}`}>
                                            <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-black/50 rounded-full text-slate-200 hover:text-white shadow-lg"><Reply size={14} /></button>
                                        </div>

                                        {msg.replyContext && (
                                            <div className={`mb-1.5 mx-1 mt-1 p-2.5 rounded-xl border-l-4 opacity-90 text-[11px] font-medium flex flex-col ${isMe ? 'bg-black/10 text-slate-700 border-emerald-500' : 'bg-black/10 text-slate-700 border-blue-500'}`}>
                                                <span className={`font-black mb-1 flex items-center gap-1 ${isMe ? 'text-emerald-600' : 'text-blue-500'}`}><Reply size={12}/> Replied to Message</span>
                                                <span className={`line-clamp-2 break-words ${textColorClass}`}>{msg.replyContext}</span>
                                            </div>
                                        )}

                                        {mediaUrl ? (
                                            <div className="rounded-xl overflow-hidden w-full relative bg-transparent">
                                                {mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i) || mediaUrl.includes('image/upload') ? 
                                                    <img src={mediaUrl} className="w-full h-auto max-h-[300px] object-cover cursor-pointer rounded-xl" onClick={() => window.open(mediaUrl, '_blank')} alt=""/> :
                                                 mediaUrl.match(/\.(mp4|webm|ogg)$/i) || mediaUrl.includes('video/upload') ? 
                                                    <video controls src={mediaUrl} className="w-full max-h-[300px] bg-black rounded-xl" /> :
                                                 mediaUrl.match(/\.(pdf|doc|docx)$/i) ? 
                                                    <a href={mediaUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-4 transition rounded-xl ${isMe ? 'bg-black/10 hover:bg-black/20' : 'bg-black/5 hover:bg-black/10'}`}><FileText size={24} className={textColorClass}/><span className={`text-sm font-bold truncate ${textColorClass}`}>Document</span><Download size={16} className={textColorClass}/></a> :
                                                    <div className={`flex items-center gap-2 p-3 rounded-xl ${isMe ? 'bg-black/10' : 'bg-black/5'}`}><Play size={18} className={textColorClass}/><audio controls src={mediaUrl} className="w-full h-8" /></div>
                                                }
                                                
                                                {msgText && (
                                                    <div className={`px-2 pt-2 pb-1 ${captionTextColorClass}`}>
                                                        <span className={`whitespace-pre-wrap leading-relaxed ${FONT_SIZES[fontIndex]}`} style={{ wordBreak: 'break-word' }}>{msgText}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            msgText && <div className={`px-2.5 py-1.5 ${textColorClass}`}><p className={`whitespace-pre-wrap leading-relaxed ${FONT_SIZES[fontIndex]}`} style={{ wordBreak: 'break-word' }}>{msgText}</p></div>
                                        )}
                                        
                                        <div className={`text-[9px] mt-1 pr-2 pb-1 text-right flex justify-end gap-1 items-center ${timeColorClass}`}>
                                            {msgDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            {isMe && <CheckCheck size={12}/>}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    });
                })()}
                <div ref={scrollRef} style={{ float:"left", clear: "both" }} />
            </div>

            <div className={`${currentTheme.header} p-3 border-t z-20 flex items-center gap-2 transition-colors relative`}>
                
                {suggestedReplies.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 z-50">
                        <div className="text-[10px] text-amber-400 font-bold uppercase mb-2">Suggested Quick Replies</div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar">
                            {suggestedReplies.map(r => (
                                <div key={r.id} onClick={() => useQuickReply(r)} className="p-2 rounded-lg cursor-pointer hover:bg-white/10 border border-transparent hover:border-white/5">
                                    <div className="font-bold text-xs text-white">{r.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{r.body || "Media attached"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showTemplates && (
                    <div className={`absolute bottom-full left-0 mb-2 w-72 border rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 ${currentTheme.inputBg}`}>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2 flex justify-between items-center">
                            <span className="flex items-center gap-1"><Zap size={12}/> Old Templates</span>
                            <button onClick={() => setShowTemplates(false)}><X size={14}/></button>
                        </div>
                        <div className="max-h-40 overflow-y-auto custom-scrollbar mb-2">
                            {templates?.map(t => (
                                <div key={t.id || t._id} className="p-2 rounded-lg cursor-pointer hover:bg-white/10" onClick={() => { setNewMessage(t.message); setShowTemplates(false); }}>
                                    <div className="font-bold text-xs">{t.title || t.name}</div>
                                    <div className="text-[10px] opacity-70 truncate">{t.message}</div>
                                </div>
                            ))}
                        </div>
                        {isCreatingTemplate ? (
                            <div className="space-y-2 p-2 border border-white/10 rounded-lg">
                                <input type="text" placeholder="Title" value={newTemplateTitle} onChange={(e) => setNewTemplateTitle(e.target.value)} className="w-full bg-transparent border-b border-white/10 text-xs p-1 outline-none text-white" />
                                <textarea placeholder="Message..." value={newTemplateMsg} onChange={(e) => setNewTemplateMsg(e.target.value)} className="w-full bg-transparent border-b border-white/10 text-xs p-1 outline-none text-white resize-none" rows={2}/>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsCreatingTemplate(false)} className="flex-1 py-1 text-[10px] text-slate-400 border border-white/10 rounded">Cancel</button>
                                    <button onClick={handleCreateQuickReply} className="flex-1 py-1 text-[10px] bg-indigo-500 text-white font-bold rounded">Save</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setIsCreatingTemplate(true)} className="w-full py-1.5 text-[10px] font-bold border border-white/10 rounded hover:bg-white/5 flex items-center justify-center gap-1"><PlusCircle size={12}/> Add New</button>
                        )}
                    </div>
                )}

                {mediaPreview && (
                    <div className="absolute bottom-full left-0 mb-2 p-3 w-72 rounded-xl flex items-center justify-between bg-black/80 border border-white/10 z-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white/10">
                                {mediaPreview.type === 'image' ? <img src={mediaPreview.url} className="w-full h-full object-cover"/> : <FileText size={18} className="text-white"/>}
                            </div>
                            <div><p className="text-xs font-bold truncate w-36 text-white">{mediaPreview.name}</p></div>
                        </div>
                        <button onClick={() => setMediaPreview(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14}/></button>
                    </div>
                )}

                {replyingTo && (
                    <div className="absolute bottom-full left-0 mb-2 p-3 w-full max-w-md border-l-4 border-emerald-500 flex justify-between items-start rounded-r-lg bg-slate-900 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                        <div className="flex-1 overflow-hidden pr-2">
                            <p className="text-[10px] font-bold text-emerald-400 mb-0.5 flex items-center gap-1"><Reply size={12}/> Replying to message</p>
                            <p className="text-xs truncate text-slate-300">{replyingTo.text || replyingTo.message || 'Media Message'}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 p-1 bg-white/5 rounded-md"><X size={14} /></button>
                    </div>
                )}

                {isRecording ? (
                    <div className={`flex-1 flex items-center gap-4 px-4 py-3 rounded-xl ${currentTheme.inputBg}`}>
                        <StopCircle className="text-red-500 animate-pulse" size={20}/>
                        <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                        <div className="flex-1"></div>
                        <button onClick={cancelRecording} className="text-slate-400 hover:text-red-400"><Trash2 size={18}/></button>
                        <button onClick={stopRecording} className="p-2 bg-[#00a884] text-white rounded-full"><Send size={16}/></button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setShowSendTemplateModal(true)} className={`p-2 rounded-xl cursor-pointer self-center transition hover:bg-black/10 ${currentTheme.icon}`} title="Send Meta Approved Template">
                            <LayoutTemplate size={20}/>
                        </button>

                        <button onClick={() => setShowQRModal(true)} className={`p-2 rounded-xl transition hover:bg-amber-500/20 text-amber-500`} title="Manage Personal Quick Replies">
                            <Zap size={20}/>
                        </button>

                        <label className={`p-2 rounded-xl cursor-pointer self-center transition hover:bg-black/10 ${currentTheme.icon}`} title="Attach File">
                            <Paperclip size={20}/><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, false)}/>
                        </label>
                        
                        <textarea 
                            placeholder={mediaPreview ? "Add a caption..." : "Type '/' for Quick Replies or a message..."} 
                            className={`flex-1 text-[15px] outline-none px-4 py-3 resize-none rounded-xl custom-scrollbar max-h-32 ${currentTheme.inputBg}`} 
                            rows={1} 
                            value={newMessage} 
                            onChange={handleTyping} 
                            onKeyDown={(e) => { 
                                if(e.key === 'Enter' && !e.shiftKey) { 
                                    e.preventDefault(); 
                                    if(!sending && !uploading && (newMessage.trim() || mediaPreview)) {
                                        handleSendMessage(e); 
                                    }
                                }
                            }} 
                            disabled={uploading || sending}
                        />

                        {newMessage.trim() || mediaPreview ? (
                            <button onClick={(e) => { if(!sending && !uploading) handleSendMessage(e); }} disabled={sending || uploading} className="p-3 bg-[#00a884] rounded-xl text-white shadow-md self-center hover:bg-emerald-600 disabled:opacity-50 transition">
                                {sending ? <Loader className="animate-spin" size={20}/> : <Send size={20}/>}
                            </button>
                        ) : (
                            <button onClick={startRecording} className={`p-3 rounded-xl self-center transition hover:bg-black/10 ${currentTheme.icon}`}>
                                <Mic size={20} />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 🔥 Personal Quick Replies Manager Modal 🔥 */}
            {showQRModal && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90%]">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800 rounded-t-2xl shrink-0">
                            <h3 className="font-bold text-white flex items-center gap-2"><Zap className="text-amber-500"/> My Quick Replies</h3>
                            <button onClick={() => setShowQRModal(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                        </div>
                        
                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3 mb-4">
                                <input type="text" placeholder="Short Name (To search easily)" value={qrForm.name} onChange={e => setQrForm({...qrForm, name: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-white outline-none"/>
                                <textarea placeholder="Message body..." rows={2} value={qrForm.body} onChange={e => setQrForm({...qrForm, body: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-sm text-white outline-none resize-none"/>
                                
                                <div className="flex gap-2 items-center">
                                    <label className="flex-1 bg-slate-800 border border-white/10 p-2 rounded-lg text-xs font-bold text-slate-300 cursor-pointer hover:bg-slate-700 flex items-center justify-center gap-2">
                                        {qrUploading ? <Loader size={14} className="animate-spin text-blue-400"/> : <ImageIcon size={14} className="text-blue-400"/>}
                                        {qrForm.mediaUrl ? 'Media Attached ✅' : 'Attach File (Optional)'}
                                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, true)}/>
                                    </label>
                                    <button onClick={savePersonalReply} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition shadow-lg">Save</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {personalReplies.length === 0 ? <p className="text-center text-xs text-slate-500 py-4">No quick replies saved.</p> : 
                                personalReplies.map(r => (
                                    <div key={r.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col cursor-pointer hover:bg-white/10 transition" onClick={() => useQuickReply(r)}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-amber-400 text-xs uppercase tracking-wider">{r.name}</span>
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setQrForm(r); }} className="text-[10px] text-blue-400 hover:text-blue-300">Edit</button>
                                                <button onClick={(e) => deletePersonalReply(e, r.id)} className="text-[10px] text-red-400 hover:text-red-300">Delete</button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-300 line-clamp-2">{r.body}</p>
                                        {r.mediaUrl && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded mt-2 w-max inline-block border border-blue-500/20">Has Attachment</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {uploading && <div className="absolute inset-0 flex items-center justify-center gap-2 z-50 bg-black/60"><Loader className="animate-spin text-white" size={20}/><span className="text-white text-xs font-bold">Uploading...</span></div>}
        </div>
    );
};

export default ChatArea;