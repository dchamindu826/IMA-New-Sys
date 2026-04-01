import React from 'react';
import { LayoutDashboard, BookOpen, Wallet, Video, Settings, LogOut, X, Truck } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, handleLogout }) => {

    const menuItems = [
        { id: 'home', label: 'Dashboard Overview', icon: LayoutDashboard },
        { id: 'courses', label: 'Enroll in Courses', icon: BookOpen },
        { id: 'mycourses', label: 'My Classrooms', icon: Video },
        { id: 'delivery', label: 'Delivery Hub', icon: Truck }, // 🔥 අලුත් එක 🔥
        { id: 'history', label: 'Payment History', icon: Wallet },
        { id: 'profile', label: 'Profile Settings', icon: Settings },
    ];

    return (
        <>
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={() => setSidebarOpen(false)}></div>
            )}

            <aside className={`fixed lg:static top-0 left-0 h-full w-72 bg-black/20 border-r border-white/10 flex flex-col transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                
                <div className="h-24 flex items-center justify-between px-8 border-b border-white/10">
                    <img src="/logo.png" alt="IMA Campus" className="h-10 w-auto" />
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 bg-white/10 p-2 rounded-xl">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-8 px-5 space-y-2 custom-scrollbar">
                    <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest mb-4 px-3">Main Menu</p>
                    
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all duration-300 ${
                                activeTab === item.id 
                                ? 'bg-gradient-to-r from-red-600/20 to-red-800/20 text-white border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                                : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                        >
                            <item.icon size={22} className={activeTab === item.id ? 'text-red-500' : 'text-white/50'} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-6 border-t border-white/10">
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl font-bold text-white/70 hover:bg-red-500/20 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30">
                        <LogOut size={20} strokeWidth={2.5} /> Logout
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;