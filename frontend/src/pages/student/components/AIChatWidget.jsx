import React, { useState } from 'react';
import axios from '../../../api/axios';
import { Loader2, Send, Bot, MessageSquare, X } from 'lucide-react';

export default function AIChatWidget() {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMsg, setChatMsg] = useState('');
    const [messages, setMessages] = useState([{ sender: 'ai', text: 'Hey there! How can I assist you today?' }]);
    const [msgCount, setMsgCount] = useState(0);
    const [isEscalated, setIsEscalated] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatMsg.trim() || isEscalated) return;

        const newMsg = { sender: 'user', text: chatMsg };
        setMessages(prev => [...prev, newMsg]);
        setChatMsg(''); 
        setChatLoading(true);

        try {
            const res = await axios.post('/student/ai-chat', { message: newMsg.text, messageCount: msgCount });
            setMessages(prev => [...prev, { sender: 'ai', text: res.data.reply }]);
            setMsgCount(prev => prev + 1);
            if (res.data.escalated) setIsEscalated(true);
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Network Error. Please try again.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {isChatOpen && (
                /* 🔥 FULLY SOLID DARK BACKGROUND (No Transparency) 🔥 */
                <div className="mb-4 w-[calc(100vw-3rem)] sm:w-[360px] h-[500px] bg-[#0a0f1c] rounded-[2rem] flex flex-col overflow-hidden animate-fade-in shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-slate-700/50">
                    
                    {/* Chat Header */}
                    <div className="bg-slate-900 border-b border-slate-700/50 p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-800 shadow-inner p-2.5 rounded-xl border border-slate-600">
                                <Bot size={20} className="text-orange-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm tracking-wide">Campus Assistant</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_#34d399]"></span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Online</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:bg-slate-800 hover:text-red-400 p-2 rounded-xl transition-colors">
                            <X size={18} strokeWidth={2.5}/>
                        </button>
                    </div>
                    
                    {/* Chat Area */}
                    <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0a0f1c] custom-scrollbar">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed font-medium shadow-md ${
                                    m.sender === 'user' 
                                    ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-2xl rounded-tr-sm' 
                                    : 'bg-slate-800 border border-slate-700 text-white/90 rounded-2xl rounded-tl-sm'
                                }`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl rounded-tl-sm flex gap-2 items-center">
                                    <Loader2 size={16} className="animate-spin text-orange-400"/>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-slate-900 border-t border-slate-700/50">
                        {isEscalated ? (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest">
                                Handed over to Staff
                            </div>
                        ) : (
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={chatMsg} 
                                    onChange={(e) => setChatMsg(e.target.value)} 
                                    placeholder="Type your message..." 
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400 font-medium" 
                                />
                                <button 
                                    type="submit" 
                                    disabled={!chatMsg.trim() || chatLoading} 
                                    className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 flex items-center justify-center text-white disabled:opacity-50 shadow-lg hover:scale-105 transition-transform"
                                >
                                    <Send size={18} className="ml-0.5"/>
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button 
                onClick={() => setIsChatOpen(!isChatOpen)} 
                className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center text-white hover:-translate-y-1 transition-all z-50"
            >
                {isChatOpen ? <X size={26} strokeWidth={2.5}/> : <MessageSquare size={26} strokeWidth={2.5}/>}
            </button>
        </div>
    );
}