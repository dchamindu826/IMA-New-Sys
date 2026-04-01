import React, { useState } from 'react';
import { Truck, MapPin, Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function DeliveryHub() {
    // Dummy Data - Backend එක එනකම්
    const [deliveries, setDeliveries] = useState([
        {
            id: 1,
            courseName: '2026 March Batch - Physics',
            trackingNumber: 'TRK-98234109',
            status: 3, // 1=Packing, 2=Out for Delivery, 3=On the Way (Action needed)
            date: '2026-04-01T10:00:00Z',
            actionNeeded: true // 1 day passed
        },
        {
            id: 2,
            courseName: '2026 March Batch - Chemistry',
            trackingNumber: 'TRK-77443122',
            status: 1, 
            date: '2026-04-03T14:30:00Z',
            actionNeeded: false
        }
    ]);

    const handleAction = (id, actionType) => {
        // Backend එකට Action එක යවන තැන
        setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 4, actionNeeded: false } : d));
        alert(`${actionType} marked for tracking ${id}!`);
    };

    const getStatusInfo = (status) => {
        if(status === 1) return { text: "Tute Packing", color: "text-yellow-400", icon: Package, percent: "25%" };
        if(status === 2) return { text: "Out for Delivery", color: "text-orange-400", icon: Truck, percent: "50%" };
        if(status === 3) return { text: "On the Way", color: "text-red-400", icon: MapPin, percent: "75%" };
        if(status === 4) return { text: "Received", color: "text-emerald-400", icon: CheckCircle, percent: "100%" };
        return { text: "Processing", color: "text-slate-400", icon: Clock, percent: "10%" };
    };

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <Truck size={30} className="text-orange-500"/>
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wider uppercase">Delivery Hub</h2>
                    <p className="text-white/60 mt-1 text-xs md:text-sm font-medium">Track your tutes and study materials.</p>
                </div>
            </div>

            <div className="space-y-6">
                {deliveries.map(item => {
                    const info = getStatusInfo(item.status);
                    const StatusIcon = info.icon;

                    return (
                        <div key={item.id} className="glass-card rounded-[2rem] p-6 md:p-8 border border-white/10 relative overflow-hidden group">
                            
                            {/* Status Glow Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/5 rounded-bl-full blur-[50px] pointer-events-none"></div>

                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">{item.courseName}</h3>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-orange-500/20">
                                            TRK: {item.trackingNumber}
                                        </span>
                                        <span className="text-xs text-white/40 flex items-center gap-1.5 font-medium"><Clock size={14}/> Updated: {new Date(item.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                <div className={`flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 ${info.color}`}>
                                    <StatusIcon size={20} className="animate-pulse"/>
                                    <span className="font-black tracking-wide">{info.text}</span>
                                </div>
                            </div>

                            {/* Animated Timeline Tracker */}
                            <div className="relative z-10 w-full mb-8">
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-1000 ease-out" style={{ width: info.percent }}></div>
                                </div>
                                <div className="flex justify-between text-[10px] sm:text-xs font-bold text-white/40 mt-3 uppercase tracking-wider">
                                    <span className={item.status >= 1 ? 'text-white' : ''}>Packing</span>
                                    <span className={item.status >= 2 ? 'text-white text-center' : 'text-center'}>Dispatched</span>
                                    <span className={item.status >= 3 ? 'text-white text-right' : 'text-right'}>Arriving</span>
                                    <span className={item.status === 4 ? 'text-emerald-400 text-right' : 'text-right hidden sm:block'}>Delivered</span>
                                </div>
                            </div>

                            {/* Action Needed Section (1 Day Passed) */}
                            {item.actionNeeded && item.status !== 4 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 animate-in zoom-in duration-300">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle size={24} className="text-red-400 shrink-0"/>
                                        <div>
                                            <h4 className="text-white font-bold text-sm">Have you received your tute?</h4>
                                            <p className="text-white/60 text-xs mt-1">Please confirm delivery status to help us track your materials.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <button onClick={() => handleAction(item.id, 'Not Received')} className="flex-1 sm:flex-none bg-black/40 hover:bg-red-600/20 text-red-400 border border-red-500/30 hover:border-red-500 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
                                            Not Received
                                        </button>
                                        <button onClick={() => handleAction(item.id, 'Received')} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2">
                                            <CheckCircle size={16}/> Received
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    );
                })}

                {deliveries.length === 0 && (
                    <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
                        <Package size={48} className="mx-auto text-white/20 mb-4"/>
                        <p className="text-white/50 font-bold text-lg">No active deliveries found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}