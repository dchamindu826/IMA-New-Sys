import React, { useState, useEffect } from 'react';
import axios from "../../../api/axios";
import { Loader2, Bell, AlertTriangle, Lock, Calendar, Clock, CheckCircle, ChevronRight, Play, User } from 'lucide-react';
import AIChatWidget from './AIChatWidget';

export default function StudentOverview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // User data from LocalStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Safe Profile Picture URL handling
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

    let countdownText = "";
    if (data?.upcomingLive) {
        const liveDate = new Date(`${data.upcomingLive.date.split('T')[0]}T${data.upcomingLive.startTime}`);
        const diff = liveDate - currentTime;
        if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            countdownText = `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
        } else {
            countdownText = "Live Now";
        }
    }

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 glass-card p-6 md:p-8 rounded-[2rem]">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
                        {getGreeting()}, <span className="text-red-500">{user.fName}</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-white/80 font-medium text-sm">
                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10"><Calendar size={16} className="text-yellow-400"/> {currentTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10"><Clock size={16} className="text-red-400"/> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-5 w-full md:w-auto shadow-sm">
                    
                    {/* 🔥 ADVANCED PROFILE PIC ANIMATION 🔥 */}
                    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        {/* Spinning Gradient Border */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-400 animate-[spin_3s_linear_infinite] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                        {/* Inner Dark Mask to make it look like a thin border */}
                        <div className="absolute inset-1 bg-[#0a0f1c] rounded-full z-10"></div>
                        {/* Actual Profile Image or Fallback Icon */}
                        {profilePic ? (
                            <img src={profilePic} alt="Profile" className="absolute inset-1.5 w-[calc(100%-12px)] h-[calc(100%-12px)] rounded-full object-cover z-20 bg-black/50" />
                        ) : (
                            <User size={24} className="text-white/50 relative z-20" />
                        )}
                    </div>

                    <div>
                        <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-0.5">Enrolled</p>
                        <p className="text-3xl font-black text-white">{data?.enrolledCount || 0} <span className="text-lg font-bold text-white/70">Subjects</span></p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    {data?.upcomingLive && (
                        <div className="glass-card bg-gradient-to-br from-red-600/10 to-red-900/10 border-red-500/30 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                            <div className="relative z-10 w-full md:w-auto text-center md:text-left">
                                <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-4 py-1.5 rounded-full mb-4 shadow-sm">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"></span>
                                    <span className="text-white font-bold uppercase tracking-widest text-[11px]">Upcoming Stream</span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">{data.upcomingLive.title}</h2>
                                <p className="text-white/70 font-medium">{data.upcomingLive.courseName}</p>
                            </div>
                            
                            <div className="relative z-10 shrink-0 w-full md:w-auto flex flex-col items-center">
                                <a href={data.upcomingLive.link} target="_blank" rel="noreferrer" className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-extrabold py-4 px-8 rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 flex items-center justify-center gap-3">
                                    <Play size={20} className="fill-white"/> Join Session
                                </a>
                            </div>
                        </div>
                    )}

                    <div className="glass-card rounded-[2rem] p-6 md:p-8">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <div className="bg-white/10 border border-white/10 p-2.5 rounded-xl"><Bell className="text-yellow-400" size={22}/></div>
                            Latest Updates
                        </h3>
                        <div className="space-y-4">
                            {data?.posts?.length === 0 ? (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center text-white/50 font-medium">No new updates available.</div>
                            ) : (
                                data?.posts?.map((post) => (
                                    <div key={post.id} className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden hover:bg-black/40 transition-all">
                                        <div className="p-6">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                                                <h4 className="text-lg font-bold text-white">{post.title}</h4>
                                                <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg whitespace-nowrap">
                                                    {new Date(post.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-white/70 text-sm leading-relaxed font-medium">{post.description}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                    <div className="glass-card rounded-[2rem] p-6 md:p-8">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <div className="bg-white/10 border border-white/10 p-2.5 rounded-xl"><AlertTriangle className="text-red-500" size={22}/></div>
                            Tasks & Alerts
                        </h3>
                        <div className="space-y-4">
                            {data?.alerts?.length === 0 ? (
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-8 text-center shadow-sm">
                                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} className="text-yellow-400"/>
                                    </div>
                                    <p className="text-white font-bold text-lg">You're all caught up!</p>
                                    <p className="text-sm text-white/50 mt-1 font-medium">No pending tasks or dues.</p>
                                </div>
                            ) : (
                                data?.alerts?.map((alert, idx) => (
                                    <div key={idx} className={`p-5 rounded-2xl border bg-black/20 ${alert.type === 'locked' ? 'border-red-500/50' : 'border-red-400/30'}`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl shrink-0 bg-white/5 ${alert.type === 'locked' ? 'text-red-500' : 'text-yellow-400'}`}>
                                                {alert.type === 'locked' ? <Lock size={20}/> : <AlertTriangle size={20}/>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white/80 leading-relaxed mb-3">{alert.msg}</p>
                                                <button className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all ${alert.type === 'locked' ? 'text-red-400 hover:text-red-300' : 'text-yellow-400 hover:text-yellow-300'}`}>
                                                    Resolve Now <ChevronRight size={14} strokeWidth={3}/>
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
            
            {/* Make sure Chat Widget still works! */}
            <AIChatWidget />
        </div>
    );
}