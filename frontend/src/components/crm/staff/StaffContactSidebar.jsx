import React, { useMemo, useState } from 'react';
import { MessageSquare, Search, Upload, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

export default function StaffContactSidebar({
  contacts, staffList, selectedContact, chatFilter, setChatFilter,
  chatSearch, setChatSearch, activePhase, userId, handleContactClick, fetchContacts
}) {
  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ name: '', phone: '' });
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('All');

  const isAssignedToMe = (c) => String(c.assigned_to) === String(userId) || String(c.assignedTo) === String(userId);
  const hasUnread = (c) => (c.unreadCount > 0 || c.unread_count > 0);

  const assignedUnreadCount = contacts.filter(c => isAssignedToMe(c) && hasUnread(c)).length;
  const allUnreadCount = contacts.filter(c => {
    if (selectedStaffFilter !== 'All' && String(c.assigned_to) !== String(selectedStaffFilter)) return false;
    return hasUnread(c);
  }).length;

  const filteredContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts)) return [];
    
    return contacts.filter(c => {
        // 🔥 FIX: Admin හිටියත් Assigned Tab එක පේනවා (එයාට Assign වෙලා නැත්නම් හිස්ව පෙනෙයි) 🔥
        if (chatFilter === 'Assigned' && !isAssignedToMe(c)) return false;
        if (chatFilter === 'All' && selectedStaffFilter !== 'All' && String(c.assigned_to) !== String(selectedStaffFilter)) return false;

        const cPhase = String(c.phase || c.leadType || '').toUpperCase();
        if (activePhase === 'FREE_SEMINAR' && (cPhase.includes('AFTER') || cPhase.includes('2'))) return false;
        if (activePhase === 'AFTER_SEMINAR' && (cPhase.includes('FREE') || cPhase.includes('1'))) return false;

        if (chatSearch) {
          const contactPhone = c.phoneNumber || c.phone_number || "";
          const contactName = c.name || c.customer_name || "";
          const term = chatSearch.toLowerCase();
          if (!contactPhone.includes(term) && !contactName.toLowerCase().includes(term)) return false;
        }
        return true;
      }).sort((a, b) => {
        const aUnread = hasUnread(a) ? 1 : 0;
        const bUnread = hasUnread(b) ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        return new Date(b.lastMessageTime || b.last_message_time || 0) - new Date(a.lastMessageTime || a.last_message_time || 0);
      });
  }, [contacts, chatSearch, userId, activePhase, chatFilter, selectedStaffFilter]);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importForm.phone) return toast.error("Phone number is required!");
    try {
      await api.post('/crm/contact/add', { name: importForm.name || 'Guest', phoneNumber: importForm.phone });
      toast.success("Contact Imported Successfully!");
      setImportForm({ name: '', phone: '' });
      setShowImport(false);
      if(fetchContacts) fetchContacts();
    } catch (error) { toast.error("Failed to import contact."); }
  };

  const formatSidebarDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (date.toDateString() === new Date().toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
  };

  return (
    <div className="h-full flex flex-col relative bg-slate-900/95 backdrop-blur-xl rounded-l-3xl overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <MessageSquare className="text-blue-400" size={18}/> Inbox
            </h2>
            <button onClick={() => setShowImport(true)} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white p-1.5 rounded-lg transition-all" title="Import Contact">
                <Upload size={16}/>
            </button>
        </div>

        {/* 🔥 FIX: Everyone sees both tabs now 🔥 */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-3">
            <button onClick={() => setChatFilter('Assigned')} className={`flex-1 py-1.5 px-1 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${chatFilter === 'Assigned' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                Assigned {assignedUnreadCount > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 rounded-full">{assignedUnreadCount > 99 ? '99+' : assignedUnreadCount}</span>}
            </button>
            <button onClick={() => setChatFilter('All')} className={`flex-1 py-1.5 px-1 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${chatFilter === 'All' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                All Leads {allUnreadCount > 0 && <span className="bg-rose-500 text-white text-[9px] px-1.5 rounded-full">{allUnreadCount > 99 ? '99+' : allUnreadCount}</span>}
            </button>
        </div>

        {chatFilter === 'All' && (
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1.5 rounded-xl mb-3 animate-in fade-in slide-in-from-top-2">
                <Filter size={12} className="text-slate-400 ml-1"/>
                <select value={selectedStaffFilter} onChange={(e) => setSelectedStaffFilter(e.target.value)} className="w-full bg-transparent text-[11px] text-white outline-none cursor-pointer">
                    <option value="All" className="bg-slate-900">All Staff</option>
                    {staffList?.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.fName || s.name}</option>)}
                </select>
            </div>
        )}

        <div className="relative group">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
            <input type="text" placeholder="Search number or name..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500 transition-colors" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {filteredContacts.length === 0 ? (
            <div className="text-center text-slate-500 mt-10 text-sm font-medium">No contacts found.</div>
        ) : (
            filteredContacts.map(contact => {
                const cId = contact._id || contact.id;
                const isSelected = selectedContact?._id === cId || selectedContact?.id === cId;
                const unread = contact.unreadCount || contact.unread_count || 0;
                const phone = contact.phoneNumber || contact.phone_number || "";
                const displayName = (contact.name && !contact.name.toLowerCase().includes('guest')) ? contact.name : phone;

                let assignedAgentName = "Not Assigned";
                if (contact.assigned_to && staffList) {
                    const agent = staffList.find(a => String(a.id) === String(contact.assigned_to));
                    if (agent) assignedAgentName = agent.fName || agent.name;
                }

                return (
                    <div key={cId} onClick={() => handleContactClick(contact)} className={`p-3 rounded-xl cursor-pointer flex items-start gap-3 transition-all border ${isSelected ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                        <div className="w-10 h-10 mt-1 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-lg bg-slate-700 relative">
                            {phone.slice(-2)}
                            {unread > 0 && (
                                <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-[0_0_10px_rgba(244,63,94,0.5)] border-2 border-slate-900">
                                    {unread > 99 ? '99+' : unread}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-bold text-sm truncate pr-2 ${isSelected ? 'text-white' : 'text-slate-300'}`}>{displayName}</h4>
                                <span className={`text-[9px] whitespace-nowrap mt-0.5 ${unread > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                    {formatSidebarDate(contact.lastMessageTime || contact.last_message_time)}
                                </span>
                            </div>
                            <p className={`text-xs truncate pr-2 ${unread > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>{contact.lastMessage || contact.last_message || "New Lead"}</p>
                            
                            {chatFilter === 'All' && contact.assigned_to && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold border border-indigo-500/20 truncate max-w-[100px]" title={assignedAgentName}>
                                        👤 {assignedAgentName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {showImport && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                <button onClick={() => setShowImport(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Upload className="text-emerald-400"/> Import Contacts</h3>
                <form onSubmit={handleImport} className="space-y-4 mb-2">
                    <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Name (Optional)</label><input type="text" placeholder="e.g. Nimal" value={importForm.name} onChange={e=>setImportForm({...importForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" /></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Phone Number *</label><input type="text" required placeholder="e.g. 94714941559" value={importForm.phone} onChange={e=>setImportForm({...importForm, phone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500" /></div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg mt-2">Save Contact & Assign</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}