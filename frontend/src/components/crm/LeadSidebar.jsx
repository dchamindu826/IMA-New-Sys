import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function LeadSidebar({ selectedBatch, activeSection, onSelectLead, activeLeadId, loggedInUser }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        // Using the Call Campaign API Route
        const { data } = await api.get(`/crm/calls/assigned?phase=${activeSection}`);
        setLeads(data || []);
      } catch (error) {
        console.error("Error fetching leads", error);
      } finally {
        setLoading(false);
      }
    };
    if (selectedBatch && loggedInUser) fetchLeads();
  }, [selectedBatch, activeSection, loggedInUser]);

  const filteredLeads = leads.filter(lead => {
      const matchesSearch = (lead.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || lead.phone_number?.includes(searchQuery));
      return matchesSearch;
  });
  
  const newLeadsCount = leads.length;

  return (
    <div className="bg-slate-900 border-r border-white/10 p-4 h-full flex flex-col shadow-xl">
      <input 
        type="text" 
        placeholder="Search leads..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-2.5 mb-4 bg-black/40 rounded-xl text-white text-sm outline-none border border-white/10 focus:border-blue-500" 
      />
      
      <div className="flex bg-black/40 rounded-xl p-1 mb-4 border border-white/5">
        <button className="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 bg-blue-600 text-white shadow-md">
          Assigned Calls ({newLeadsCount})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
        {loading ? (
           <p className="text-slate-500 text-center text-sm mt-10 animate-pulse">Loading leads...</p>
        ) : filteredLeads.length === 0 ? (
          <p className="text-slate-500 text-center text-sm mt-10">No leads found.</p>
        ) : (
          filteredLeads.map(lead => (
            <div 
              key={lead.id} 
              onClick={() => onSelectLead(lead)}
              className={`p-3 rounded-xl cursor-pointer transition-colors relative group border ${activeLeadId === lead.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-black/20 hover:bg-white/5 border-white/5'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-white font-bold text-sm truncate pr-4">{lead.customer_name || lead.phone_number}</h4>
              </div>
              <p className="text-slate-400 text-xs truncate">{lead.phone_number}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}