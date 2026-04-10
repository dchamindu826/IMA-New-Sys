import React from 'react';
import { Search, MessageSquare, CheckSquare, Square } from 'lucide-react';

const ContactSidebar = (props) => {
    const {
        contacts, selectedContact, setSelectedContact,
        activeTab, setActiveTab, searchTerm, setSearchTerm, userRole, filteredContacts, currentTheme,
        isAssignMode, selectedForAssign, setSelectedForAssign
    } = props;

    const tabsToShow = userRole === 'agent' ? ['Assigned', 'Imported'] : ['New Chat', 'Assigned', 'Imported', 'All'];

    const formatSidebarDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleContactClick = async (contact) => {
        if (isAssignMode) {
            const cId = contact._id || contact.id;
            if (selectedForAssign.includes(cId)) setSelectedForAssign(selectedForAssign.filter(id => id !== cId));
            else setSelectedForAssign([...selectedForAssign, cId]);
            return;
        }

        setSelectedContact(contact);
        contact.unreadCount = 0; 
        contact.unread_count = 0;

        const token = localStorage.getItem('token') || localStorage.getItem('userToken');
        try {
            await fetch(`https://imacampus.online/api/crm/contacts/${contact.id || contact._id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Failed to mark as read", e);
        }
    };

    return (
        <div className="w-[350px] border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-xl transition-colors duration-300 z-30 shrink-0 h-full">
            
            <div className="p-5 border-b border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <MessageSquare className="text-blue-400" size={20}/> Inbox
                    </h2>
                </div>
                
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                    {tabsToShow.map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)} 
                            className={`flex-1 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all duration-300 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                    <input type="text" placeholder="Search number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500"/>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {filteredContacts.length === 0 ? <p className="text-center text-slate-500 text-sm mt-10">No chats found.</p> : 
                filteredContacts.map(contact => {
                    const cId = contact._id || contact.id;
                    const phone = contact.phoneNumber || contact.phone_number || "";
                    const displayName = (contact.name && !contact.name.toLowerCase().includes('guest')) ? contact.name : phone;
                    const unread = contact.unreadCount || contact.unread_count || 0;
                    const isSelected = selectedForAssign.includes(cId);

                    return (
                        <div key={cId} onClick={() => handleContactClick(contact)} className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all border ${selectedContact?._id === cId || selectedContact?.id === cId || isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                            
                            {isAssignMode && (
                                <div className="shrink-0 mr-1">
                                    {isSelected ? <CheckSquare className="text-blue-500" size={18}/> : <Square className="text-slate-500" size={18}/>}
                                </div>
                            )}

                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-lg bg-slate-700 relative">
                                {phone.slice(-2)}
                                {unread > 0 && !isAssignMode && (
                                    <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-[0_0_10px_rgba(244,63,94,0.5)] border-2 border-slate-900">
                                        {unread > 99 ? '99+' : unread}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`font-bold text-sm truncate ${selectedContact?._id === cId || selectedContact?.id === cId ? 'text-white' : 'text-slate-300'}`}>{displayName}</h4>
                                    <span className={`text-[10px] ${unread > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>{formatSidebarDate(contact.lastMessageTime || contact.last_message_time)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={`text-xs truncate flex-1 ${unread > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>{contact.lastMessage || contact.last_message || "New Lead"}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ContactSidebar;