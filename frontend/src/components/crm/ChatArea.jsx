import React, { useRef, useEffect } from 'react';
import { Paperclip, Zap, Send, Mic, X, StopCircle, Trash2, MessageSquare, Loader, FileText, Play, Download, VideoIcon, ClipboardList, CheckCheck, Reply, PlusCircle, LayoutTemplate } from 'lucide-react';
import { API_BASE_URL } from "../../config";

const FONT_SIZES = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];
const getToken = () => localStorage.getItem('token') || localStorage.getItem('userToken');

const formatDateLabel = (dateInput) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ChatArea = (props) => {
    const {
        selectedContact, messages, isDarkMode, agents,
        newMessage, setNewMessage, handleSendMessage, sending,
        mediaPreview, setMediaPreview, uploading, setUploading,
        isRecording, setIsRecording, recordingTime, setRecordingTime,
        showTemplates, setShowTemplates, templates, setTemplates, 
        isCreatingTemplate, setIsCreatingTemplate, newTemplateTitle, setNewTemplateTitle, newTemplateMsg, setNewTemplateMsg,
        replyingTo, setReplyingTo, scrollRef, fontIndex,
        theme, setTheme, currentTheme, showLeadDetails, setShowLeadDetails,
        fetchApprovedTemplates // 🔥 Meta Template Button එකට මේක ඕනේ
    } = props;

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const timerRef = useRef(null);

    // 🔥 Default Light Theme එකට මාරු කිරීම 🔥
    useEffect(() => {
        if (setTheme) {
            setTheme('light');
        }
    }, []);

    // 🔥 Auto Scroll to Bottom (මැසේජ් ආවම පහළට යන්න) 🔥
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, selectedContact]);

    // Cloudinary Upload (Voice & Files)
    const uploadToCloudinary = async (file, type) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "Chat Bot System"); 
        formData.append("cloud_name", "dyixoaldi"); 
        setUploading(true);
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/dyixoaldi/auto/upload`, { method: "POST", body: formData });
            const data = await res.json();
            setMediaPreview({ url: data.secure_url, type: type, name: file.name || 'Voice_Message.mp3' });
        } catch (e) {
            console.error("Upload failed", e);
            alert("File upload failed!");
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        uploadToCloudinary(file, type);
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

    // Quick Replies Fetch & Save
    const fetchQuickReplies = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/templates`, { headers: { 'Authorization': `Bearer ${getToken()}`, 'token': `Bearer ${getToken()}` } });
            const data = await res.json();
            if(Array.isArray(data)) setTemplates(data);
        } catch(e) {}
    };

    const handleCreateQuickReply = async () => {
        if (!newTemplateTitle || (!newTemplateMsg && !mediaPreview)) return alert("Fill title and message!");
        setUploading(true);
        try {
            // Media Preview එකක් තියෙනවා නම් ඒකත් Quick Reply එකට Save කරනවා
            let finalMessage = newTemplateMsg;
            if (mediaPreview && mediaPreview.url) {
                finalMessage = newTemplateMsg ? `${mediaPreview.url}\n\n${newTemplateMsg}` : mediaPreview.url;
            }

            await fetch(`${API_BASE_URL}/api/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ name: newTemplateTitle, message: finalMessage }) 
            });
            setIsCreatingTemplate(false);
            setNewTemplateTitle('');
            setNewTemplateMsg('');
            setMediaPreview(null);
            fetchQuickReplies();
        } catch(e) {} finally { setUploading(false); }
    };

    const handleTyping = (e) => { 
        setNewMessage(e.target.value); 
        if (e.target.value.endsWith('/')) {
            setShowTemplates(true);
            fetchQuickReplies();
        } else if (e.target.value.trim() === '') {
            setShowTemplates(false);
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
                {messages.map((msg, index, arr) => {
                    
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
                    
                    const isMe = msg.direction === 'outbound' || msg.sender === 'me' || msg.sender_type === 'STAFF' || msg.sender_type === 'AI_BOT';
                    const agentName = msg.agentName || msg.agent_name || msg.sender_type || 'System';
                    
                    return (
                        <div key={msg._id || msg.id || index} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'} mb-2`}>
                            {isMe && <span className="text-[10px] font-bold mb-1"><span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Sent by: {agentName}</span></span>}

                            <div className={`relative group p-3 rounded-2xl shadow-sm border ${isMe ? `${currentTheme.bubbleMe} rounded-tr-none` : `${currentTheme.bubbleThem} rounded-tl-none`}`}>
                                <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 ${isMe ? '-left-10' : '-right-10'}`}>
                                    <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-black/40 rounded-full text-slate-300 hover:text-white"><Reply size={14} /></button>
                                </div>

                                {msg.replyContext && (
                                    <div className="mb-2 p-2 rounded-lg border-l-4 opacity-90 text-[11px] font-medium truncate bg-black/20 text-white/80 border-emerald-500 flex flex-col">
                                        <span className="font-bold text-emerald-400 mb-0.5">Replied to</span>
                                        {msg.replyContext}
                                    </div>
                                )}

                                {mediaUrl && (
                                    <div className="mb-2 rounded-lg overflow-hidden w-full">
                                        {mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i) || mediaUrl.includes('image/upload') ? 
                                            <img src={mediaUrl} className="w-full h-auto max-h-[350px] object-contain rounded-lg cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} alt=""/> :
                                         mediaUrl.match(/\.(mp4|webm|ogg)$/i) || mediaUrl.includes('video/upload') ? 
                                            <video controls src={mediaUrl} className="w-full max-h-[350px] rounded-lg bg-black" /> :
                                         mediaUrl.match(/\.(pdf|doc|docx)$/i) ? 
                                            <a href={mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition"><FileText size={20}/><span className="text-sm font-bold">Document</span><Download size={14}/></a> :
                                            <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg"><Play size={16}/><audio controls src={mediaUrl} className="w-full h-8" /></div>
                                        }
                                    </div>
                                )}
                                
                                {msgText && <p className={`whitespace-pre-wrap leading-relaxed ${FONT_SIZES[fontIndex]} ${mediaUrl ? 'mt-2 pt-2 border-t border-white/10' : ''}`} style={{ wordBreak: 'break-word' }}>{msgText}</p>}
                                
                                <div className="text-[10px] mt-1.5 text-right opacity-70 flex justify-end gap-1 items-center">
                                    {new Date(msg.created_at || msg.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {isMe && <CheckCheck size={12}/>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {/* 🔥 Auto Scroll Ref 🔥 */}
                <div ref={scrollRef} style={{ float:"left", clear: "both" }} />
            </div>

            {/* Input Section */}
            <div className={`${currentTheme.header} p-3 border-t z-20 flex items-center gap-2 transition-colors relative`}>
                
                {showTemplates && (
                    <div className={`absolute bottom-full left-0 mb-2 w-72 border rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 ${currentTheme.inputBg}`}>
                        <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2 flex justify-between items-center">
                            <span className="flex items-center gap-1"><Zap size={12}/> Quick Replies</span>
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
                    <div className="absolute bottom-full left-0 mb-2 p-3 w-full max-w-md border-l-4 border-emerald-500 flex justify-between items-start rounded-r-lg bg-black/80 z-50">
                        <div className="flex-1 overflow-hidden pr-2">
                            <p className="text-[10px] font-bold text-emerald-500 mb-0.5">Replying to {replyingTo.sender_type === 'USER' ? 'Customer' : 'System'}</p>
                            <p className="text-xs truncate text-slate-300">{replyingTo.text || replyingTo.message || 'Media Message'}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
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
                        {/* 🔥 Meta Templates Button 🔥 */}
                        {props.fetchApprovedTemplates && (
                            <button onClick={props.fetchApprovedTemplates} className={`p-2 rounded-xl cursor-pointer self-center transition hover:bg-black/10 ${currentTheme.icon}`} title="Send Meta Template">
                                <LayoutTemplate size={20}/>
                            </button>
                        )}

                        <label className={`p-2 rounded-xl cursor-pointer self-center transition hover:bg-black/10 ${currentTheme.icon}`} title="Attach File">
                            <Paperclip size={20}/><input type="file" className="hidden" onChange={handleFileUpload}/>
                        </label>

                        {/* 🔥 Save as Quick Reply Button (Shows when typing) 🔥 */}
                        {(newMessage.trim() || mediaPreview) && (
                            <button 
                                onClick={() => {
                                    setNewTemplateMsg(newMessage);
                                    setShowTemplates(true);
                                    setIsCreatingTemplate(true);
                                }} 
                                className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-full transition" 
                                title="Save as Quick Reply"
                            >
                                <PlusCircle size={20} />
                            </button>
                        )}
                        
                        <textarea 
                            placeholder={mediaPreview ? "Add a caption..." : "Type '/' for quick replies or a message..."} 
                            className={`flex-1 text-[15px] outline-none px-4 py-3 resize-none rounded-xl custom-scrollbar max-h-32 ${currentTheme.inputBg}`} 
                            rows={1} 
                            value={newMessage} 
                            onChange={handleTyping} 
                            onKeyDown={(e) => { 
                                // 🔥 Multiple Enter Send එක ලොක් කිරීම (Debounce) 🔥
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
            {uploading && <div className="absolute inset-0 flex items-center justify-center gap-2 z-50 bg-black/60"><Loader className="animate-spin text-white" size={20}/><span className="text-white text-xs font-bold">Uploading...</span></div>}
        </div>
    );
};

export default ChatArea;