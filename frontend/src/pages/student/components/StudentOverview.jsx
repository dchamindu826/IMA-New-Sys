import React, { useState, useEffect } from 'react';
import axios from "../../../api/axios";
import { Loader2, Bell, AlertTriangle, Lock, Calendar, Clock, CheckCircle, ChevronRight, Play, User, Image as ImageIcon, X } from 'lucide-react';
import AIChatWidget from './AIChatWidget';

export default function StudentOverview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Image Modal State
    const [selectedImage, setSelectedImage] = useState(null); 
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const profilePic = user.image && user.image !== 'default.png' && user.image !== 'null'
        ? `http://72.62.249.211:5000/storage/images/${user.image}` 
        : null;

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        axios.get('/student/dashboard')
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={40} /></div>;

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 relative px-2 sm:px-0">
            
            {/* --- TOP GREETING CARD --- */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-8 gap-5 glass-card p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem]">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
                        {getGreeting()}, <span className="text-red-500">{user.fName}</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-2.5 text-white/80 font-medium text-xs sm:text-sm">
                        <span className="flex items-center gap-1.5 sm:gap-2 bg-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/10"><Calendar size={14} className="text-yellow-400 sm:w-4 sm:h-4"/> {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <span className="flex items-center gap-1.5 sm:gap-2 bg-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/10"><Clock size={14} className="text-red-400 sm:w-4 sm:h-4"/> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 px-5 md:px-6 py-3.5 md:py-4 rounded-2xl flex items-center gap-4 w-full lg:w-auto shadow-sm">
                    {/* PROFILE PIC ANIMATION */}
                    <div className="relative w-14 h-14 md:w-16 md:h-16 flex items-center justify-center shrink-0">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-[spin_3s_linear_infinite] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                        <div className="absolute inset-1 bg-[#0a0f1c] rounded-full z-10"></div>
                        {profilePic ? (
                            <img src={profilePic} alt="Profile" className="absolute inset-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] rounded-full object-cover z-20 bg-black/50" />
                        ) : (
                            <User size={24} className="text-white/50 relative z-20" />
                        )}
                    </div>
                    <div>
                        <p className="text-[10px] md:text-xs text-white/50 font-bold uppercase tracking-widest mb-0.5">Enrolled</p>
                        <p className="text-2xl md:text-3xl font-black text-white leading-none">{data?.enrolledCount || 0} <span className="text-base md:text-lg font-bold text-white/70">Subjects</span></p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    
                    {/* --- UPCOMING LIVE CARD --- */}
                    {data?.upcomingLive && (
                        <div className="glass-card bg-gradient-to-br from-red-600/10 to-red-900/10 border-red-500/30 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                            <div className="relative z-10 w-full sm:w-auto text-center sm:text-left">
                                <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full mb-3 sm:mb-4 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"></span>
                                    <span className="text-white font-bold uppercase tracking-widest text-[10px] sm:text-[11px]">Upcoming Stream</span>
                                </div>
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1.5 leading-tight">{data.upcomingLive.title}</h2>
                                <p className="text-white/70 text-sm md:text-base font-medium">{data.upcomingLive.courseName}</p>
                            </div>
                            
                            <div className="relative z-10 shrink-0 w-full sm:w-auto flex flex-col items-center">
                                <a href={data.upcomingLive.link} target="_blank" rel="noreferrer" className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-extrabold py-3.5 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
                                    <Play size={18} className="fill-white"/> Join Session
                                </a>
                            </div>
                        </div>
                    )}

                    {/* --- LATEST UPDATES / POSTS SECTION --- */}
                    <div className="glass-card rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-5 md:mb-6 flex items-center gap-3">
                            <div className="bg-white/10 border border-white/10 p-2 md:p-2.5 rounded-lg md:rounded-xl"><Bell className="text-yellow-400 w-5 h-5 md:w-6 md:h-6"/></div>
                            Latest Updates
                        </h3>
                        
                        <div className="space-y-5 md:space-y-6">
                            {data?.posts?.length === 0 ? (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8 md:p-10 text-center text-white/50 text-sm md:text-base font-medium">No new updates available.</div>
                            ) : (
                                data?.posts?.map((post) => {
                                    const postImage = post.image && post.image !== 'default.png' && post.image !== 'null' 
                                        ? `http://72.62.249.211:5000/storage/posts/${post.image}` 
                                        : null;

                                    return (
                                        <div key={post.id} className="bg-black/20 border border-white/10 rounded-[1.2rem] md:rounded-[1.5rem] p-4 md:p-5 hover:bg-black/30 transition-all flex flex-col sm:flex-row gap-4 md:gap-6 shadow-lg">
                                            
                                            {/* Clickable Image Area (Responsive Size) */}
                                            {postImage && (
                                                <div 
                                                    onClick={() => setSelectedImage(postImage)}
                                                    className="w-full sm:w-40 md:w-56 lg:w-64 h-48 sm:h-auto min-h-[12rem] rounded-xl overflow-hidden shrink-0 cursor-pointer relative group border border-white/10 shadow-md bg-black/40"
                                                >
                                                    <img 
                                                        src={postImage} 
                                                        alt={post.title} 
                                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                        <span className="text-white text-[10px] md:text-xs font-bold bg-black/60 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl flex items-center gap-1.5 md:gap-2"><ImageIcon size={14}/> View Image</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Content Area */}
                                            <div className="flex-1 flex flex-col min-w-0">
                                                
                                                {/* Title & Date Row */}
                                                <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-2 md:gap-3 mb-3 md:mb-4">
                                                    <h4 className="text-lg md:text-xl font-bold text-white leading-snug group-hover:text-red-400 transition-colors pr-2">{post.title}</h4>
                                                    <div className="flex flex-row xl:flex-col items-center xl:items-end shrink-0 gap-3 xl:gap-1.5">
                                                        <span className="text-[9px] md:text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1 md:gap-1.5">
                                                            <Calendar size={10} className="text-blue-400 md:w-3 md:h-3"/> {new Date(post.created_at).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[9px] md:text-[10px] text-white/50 font-bold uppercase tracking-widest flex items-center gap-1 md:gap-1.5">
                                                            <Clock size={10} className="text-orange-400 md:w-3 md:h-3"/> {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Scrollable 'Iframe-like' Description Box */}
                                                <div className="bg-[#0a0f1c]/50 border border-white/5 rounded-xl p-3 md:p-4 overflow-y-auto custom-scrollbar max-h-[120px] md:max-h-[160px] shadow-inner flex-1">
                                                    <p className="text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                                        {post.caption || post.description}
                                                    </p>
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* --- ALERTS SECTION --- */}
                <div className="space-y-6 md:space-y-8">
                    <div className="glass-card rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-8">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-5 md:mb-6 flex items-center gap-3">
                            <div className="bg-white/10 border border-white/10 p-2 md:p-2.5 rounded-lg md:rounded-xl"><AlertTriangle className="text-red-500 w-5 h-5 md:w-6 md:h-6"/></div>
                            Tasks & Alerts
                        </h3>
                        <div className="space-y-4">
                            {data?.alerts?.length === 0 ? (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-6 md:p-8 text-center shadow-sm">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                                        <CheckCircle className="text-yellow-400 w-6 h-6 md:w-8 md:h-8"/>
                                    </div>
                                    <p className="text-white font-bold text-base md:text-lg">You're all caught up!</p>
                                    <p className="text-xs md:text-sm text-white/50 mt-1 font-medium">No pending tasks or dues.</p>
                                </div>
                            ) : (
                                data?.alerts?.map((alert, idx) => (
                                    <div key={idx} className={`p-4 md:p-5 rounded-2xl border bg-black/20 ${alert.type === 'locked' ? 'border-red-500/50' : 'border-red-400/30'}`}>
                                        <div className="flex items-start gap-3 md:gap-4">
                                            <div className={`p-2.5 md:p-3 rounded-xl shrink-0 bg-white/5 ${alert.type === 'locked' ? 'text-red-500' : 'text-yellow-400'}`}>
                                                {alert.type === 'locked' ? <Lock size={18} className="md:w-5 md:h-5"/> : <AlertTriangle size={18} className="md:w-5 md:h-5"/>}
                                            </div>
                                            <div>
                                                <p className="text-xs md:text-sm font-medium text-white/80 leading-relaxed mb-2 md:mb-3">{alert.msg}</p>
                                                <button className={`text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-1 md:gap-1.5 transition-all ${alert.type === 'locked' ? 'text-red-400 hover:text-red-300' : 'text-yellow-400 hover:text-yellow-300'}`}>
                                                    Resolve Now <ChevronRight size={12} className="md:w-3.5 md:h-3.5" strokeWidth={3}/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <AIChatWidget />

            {/* 🔥 RESPONSIVE IMAGE POPUP MODAL (LIGHTBOX) 🔥 */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        onClick={() => setSelectedImage(null)} 
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/50 hover:text-white bg-white/10 hover:bg-red-500 border border-white/10 p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all shadow-lg z-50"
                    >
                        <X size={20} className="sm:w-6 sm:h-6" />
                    </button>
                    
                    <img 
                        src={selectedImage} 
                        alt="Post Full View" 
                        // Added safe max-width and max-height for mobile
                        className="max-w-[95vw] sm:max-w-full max-h-[85vh] sm:max-h-[90vh] object-contain rounded-xl sm:rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-white/10 animate-in zoom-in-95 duration-300" 
                        onClick={(e) => e.stopPropagation()} 
                    />
                </div>
            )}
        </div>
    );
}