import React from 'react';
import { Search, MessageSquare, Upload, Users, UserPlus, Filter, CheckSquare, Square } from 'lucide-react';

const ContactSidebar = (props) => {
    const {
        contacts, selectedContact, setSelectedContact,
        activeTab, setActiveTab, searchTerm, setSearchTerm, userRole, filteredContacts,
        setShowAssignModal, setShowImportModal, staff, customTabs, // 🔥 customTabs අලුතෙන් දැම්මා
        selectedAgentFilter, setSelectedAgentFilter, 
        selectedPhaseFilter, setSelectedPhaseFilter,
        selectedStatusFilter, setSelectedStatusFilter, 
        isAssignMode, setIsAssignMode, selectedForAssign, setSelectedForAssign, handleSelectedAssign
    } = props;

    const normalizedRole = (userRole || '').toLowerCase().trim();
    const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(normalizedRole);
    
    // 🔥 StaffCRM එකෙන් එවන Tabs හරි, නැත්නම් පරණ Tabs හරි පෙන්වනවා
    const tabsToShow = customTabs || ['New', 'Assigned', 'Import', 'All'];

    const formatSidebarDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    const handleContactClick = async (contact) => {
        if (isAssignMode) {
            const cId = contact._id || contact.id;
            if (selectedForAssign.includes(cId)) setSelectedForAssign(selectedForAssign.filter(id => id !== cId));
            else setSelectedForAssign([...selectedForAssign, cId]);
            return;
        }
        setSelectedContact(contact);
        contact.unreadCount = 0; contact.unread_count = 0;
        const token = localStorage.getItem('token') || localStorage.getItem('userToken');
        try {
            await fetch(`https://imacampus.online/api/crm/contacts/${contact.id || contact._id}/read`, {
                method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` }
            });
        } catch (e) { console.error("Failed to mark as read", e); }
    };

    return (
        <div className="w-[350px] border-r border-white/10 flex flex-col bg-slate-900/95 backdrop-blur-xl transition-colors duration-300 z-30 shrink-0 h-full relative">
            <div className="p-4 border-b border-white/10 shrink-0">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <MessageSquare className="text-blue-400" size={18}/> Inbox
                    </h2>
                    <div className="flex gap-2">
                        {isAdmin && (
                            <button onClick={() => setIsAssignMode(!isAssignMode)} className={`p-1.5 rounded-lg transition-all ${isAssignMode ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'}`} title="Select Leads to Re-Assign">
                                <CheckSquare size={16}/>
                            </button>
                        )}
                        <button onClick={() => setShowImportModal(true)} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white p-1.5 rounded-lg transition-all" title="Import Contacts">
                            <Upload size={16}/>
                        </button>
                        {isAdmin && (
                            <button onClick={() => setShowAssignModal(true)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white p-1.5 rounded-lg transition-all" title="Assign Settings">
                                <UserPlus size={16}/>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-3">
                    {tabsToShow.map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setIsAssignMode(false); setSelectedForAssign([]); }} className={`flex-1 py-1.5 px-1 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all duration-300 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="relative group">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                    <input type="text" placeholder="Search number or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500" />
                </div>
            </div>

            {activeTab === 'Assigned' && isAdmin && !customTabs && (
                <div className="flex flex-col gap-2 p-3 shrink-0 border-b border-white/5 bg-slate-800/30">
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-xl">
                            <Filter size={12} className="text-slate-400 ml-1"/>
                            <select value={selectedAgentFilter} onChange={(e) => setSelectedAgentFilter(e.target.value)} className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer">
                                <option value="All" className="bg-slate-900">All Staff</option>
                                {staff?.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.first_name || a.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-xl">
                            <Filter size={12} className="text-slate-400 ml-1"/>
                            <select value={selectedPhaseFilter} onChange={(e) => setSelectedPhaseFilter(e.target.value)} className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer">
                                <option value="All" className="bg-slate-900">All Phases</option>
                                <option value="1" className="bg-slate-900">Phase 1</option>
                                <option value="2" className="bg-slate-900">Phase 2</option>
                                <option value="3" className="bg-slate-900">Phase 3</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-xl">
                        <Filter size={12} className="text-orange-400 ml-1"/>
                        <select value={selectedStatusFilter} onChange={(e) => { if(setSelectedStatusFilter) setSelectedStatusFilter(e.target.value); }} className="w-full bg-transparent text-[11px] text-orange-300 font-bold outline-none cursor-pointer">
                            <option value="All" className="bg-slate-900">All Call Status</option>
                            <option value="Pending" className="bg-slate-900">Pending</option>
                            <option value="Answer" className="bg-slate-900">Answer</option>
                            <option value="No Answer" className="bg-slate-900">No Answer</option>
                            <option value="Reject" className="bg-slate-900">Reject</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {!filteredContacts || filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 text-slate-500">
                        <Users size={32} className="mb-2 opacity-50"/>
                        <p className="text-sm font-medium">No contacts found here.</p>
                    </div>
                ) : 
                filteredContacts.map(contact => {
                    const cId = contact._id || contact.id;
                    const phone = contact.phoneNumber || contact.phone_number || "";
                    const displayName = (contact.name && !contact.name.toLowerCase().includes('guest')) ? contact.name : phone;
                    const unread = contact.unreadCount || contact.unread_count || 0;
                    const isAssigned = !!(contact.assignedTo || contact.assigned_to);
                    const isSelected = selectedForAssign.includes(cId);

                    let assignedAgentName = "Assigned";
                    if (isAssigned && staff) {
                        const agent = staff.find(a => String(a.id) === String(contact.assignedTo || contact.assigned_to));
                        if (agent) assignedAgentName = agent.first_name || agent.name;
                    }

                    const callStatus = contact.call_status || contact.status; 
                    const statusColor = callStatus === 'No Answer' ? 'text-red-400 border-red-500/20 bg-red-500/10' : 
                                        callStatus === 'Answer' ? 'text-green-400 border-green-500/20 bg-green-500/10' : 
                                        'text-orange-400 border-orange-500/20 bg-orange-500/10';

                    return (
                        <div key={cId} onClick={() => handleContactClick(contact)} className={`p-3 rounded-xl cursor-pointer flex items-start gap-3 transition-all border ${selectedContact?._id === cId || selectedContact?.id === cId || isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                            {isAssignMode && (
                                <div className="shrink-0 mt-2 mr-1">
                                    {isSelected ? <CheckSquare className="text-blue-500" size={18}/> : <Square className="text-slate-500" size={18}/>}
                                </div>
                            )}
                            <div className="w-10 h-10 mt-1 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-lg bg-slate-700 relative">
                                {phone.slice(-2)}
                                {unread > 0 && !isAssignMode && (
                                    <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-[0_0_10px_rgba(244,63,94,0.5)] border-2 border-slate-900">
                                        {unread > 99 ? '99+' : unread}
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`font-bold text-sm truncate pr-2 ${selectedContact?._id === cId || selectedContact?.id === cId ? 'text-white' : 'text-slate-300'}`}>
                                        {displayName}
                                    </h4>
                                    <span className={`text-[9px] whitespace-nowrap mt-0.5 ${unread > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                        {formatSidebarDate(contact.lastMessageTime || contact.last_message_time || contact.updated_at)}
                                    </span>
                                </div>
                                <p className={`text-xs truncate pr-2 ${unread > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>
                                    {contact.lastMessage || contact.last_message || "New Lead"}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {isAssigned ? (
                                        <>
                                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold border border-indigo-500/20 truncate max-w-[100px]" title={assignedAgentName}>
                                                👤 {assignedAgentName}
                                            </span>
                                            {/* Show status only if it's explicitly a call status */}
                                            {['Answer', 'No Answer', 'Reject', 'Pending'].includes(callStatus) && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${statusColor}`}>
                                                    {callStatus}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${contact.status === 'Imported' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/20 text-orange-400 border-orange-500/20'}`}>
                                            {contact.status === 'Imported' ? 'Imported Lead' : 'New Lead'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAssignMode && selectedForAssign.length > 0 && (
                <div className="p-3 bg-blue-900/40 border-t border-blue-500/30 flex items-center gap-2 shrink-0 z-40">
                    <span className="text-xs font-bold text-blue-300">{selectedForAssign.length} Selected</span>
                    <select className="flex-1 bg-slate-900 text-white text-xs p-1.5 rounded outline-none border border-white/10" onChange={(e) => { if(e.target.value) handleSelectedAssign(e.target.value); }}>
                        <option value="">Re-Assign To...</option>
                        {staff?.map(a => (<option key={a.id} value={a.id}>{a.first_name || a.name}</option>))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default ContactSidebar;