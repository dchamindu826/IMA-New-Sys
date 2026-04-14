import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Search, Edit2, Trash2, Loader2, X, Users, UserCircle } from 'lucide-react';
import api from '../../api/axios';

export default function ManagerStaff() {
  const [staffList, setStaffList] = useState([]);
  const [batches, setBatches] = useState([]);
  const [businessId, setBusinessId] = useState(null); // 🔥 New: Business ID eka save karaganna
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [editingStaff, setEditingStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    fName: '', lName: '', phone: '', nic: '', role: 'Coordinator', password: '', assigned_batch_id: ''
  });

  const fetchData = async () => {
    try {
      // 1. Manager ge business ID eka gannawa (API eken overview eka haraha)
      const overviewRes = await api.get('/admin/manager/overview');
      if(overviewRes.data && overviewRes.data.business) {
          setBusinessId(overviewRes.data.business.id);
      }

      // 2. Staff List eka gannawa
      const res = await api.get('/admin/staff');
      let actualData = res.data?.data || res.data?.staff || res.data || [];
      const filteredForManager = actualData.filter(s => s.role === 'Ass Manager' || s.role === 'Coordinator');
      setStaffList(filteredForManager);

      // 3. Batches Dropdown ekata gannawa
      const batchRes = await api.get('/admin/manager/batches');
      setBatches(batchRes.data || []);
      
    } catch (error) { toast.error("Failed to load data."); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      // FormData eken thama backend ekata yawanne
      const sendData = new FormData();
      sendData.append('fName', formData.fName);
      sendData.append('lName', formData.lName);
      sendData.append('phone', formData.phone);
      sendData.append('nic', formData.nic);
      sendData.append('role', formData.role);
      sendData.append('password', formData.password);
      if(formData.assigned_batch_id) sendData.append('assigned_batch_id', formData.assigned_batch_id);
      
      // 🔥 Meka thama wede: Thamange Business ID eka pass karanawa
      if(businessId) {
          sendData.append('business_id', businessId);
      }

      if (editingStaff) {
        // Backend eke update route eka normal JSON bala poroththu wena nisa formData nathiwa kelinma yawamu
        await api.put(`/admin/staff/update/${editingStaff.id}`, { ...formData, business_id: businessId });
        toast.success("Staff updated successfully!");
      } else {
        await api.post('/admin/staff/add', sendData);
        toast.success("Staff registered successfully under your business!");
      }
      
      setShowModal(false);
      setFormData({ fName: '', lName: '', phone: '', nic: '', role: 'Coordinator', password: '', assigned_batch_id: '' });
      setEditingStaff(null);
      fetchData();
    } catch (error) {
      const errMsg = error.response?.data?.message || "Failed to save.";
      toast.error(errMsg);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await api.delete(`/admin/staff/${id}`);
      toast.success("Staff deleted.");
      fetchData();
    } catch (error) { toast.error("Delete failed."); }
  };

  const openEditModal = (staff) => {
    setEditingStaff(staff);
    setFormData({
        fName: staff.fName || '', lName: staff.lName || '', phone: staff.phone || '', 
        nic: staff.nic || '', role: staff.role || 'Coordinator', password: '', 
        assigned_batch_id: staff.assigned_batch_id || ''
    });
    setShowModal(true);
  };

  const filteredStaff = staffList.filter(s => s.fName?.toLowerCase().includes(search.toLowerCase()) || s.role?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-300 relative h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
        <div>
          <h2 className="text-3xl font-black text-white drop-shadow-md">My Business Team</h2>
          <p className="text-slate-400 text-sm mt-1">Manage Assistant Managers and Coordinators strictly for your business.</p>
        </div>
        <div className="flex gap-4">
            <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Search team..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-black/40 border border-slate-600/50 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:border-blue-400 outline-none backdrop-blur-md transition-all shadow-inner" />
            </div>
            <button onClick={() => { setEditingStaff(null); setFormData({ fName: '', lName: '', phone: '', nic: '', role: 'Coordinator', password: '', assigned_batch_id: '' }); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
                <UserPlus size={16} /> Add Business Staff
            </button>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex-1 p-1">
        <div className="p-0 overflow-x-auto rounded-3xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/80 text-blue-200 border-b border-white/10">
              <tr>
                <th className="p-5 font-bold uppercase tracking-wider text-xs">Staff Name</th>
                <th className="p-5 font-bold uppercase tracking-wider text-xs">Contact Info</th>
                <th className="p-5 font-bold uppercase tracking-wider text-xs">Role & Assignment</th>
                <th className="p-5 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? <tr><td colSpan="4" className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-400" /></td></tr> : 
               filteredStaff.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-5 font-medium text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-xs shadow-lg">{s.fName?.charAt(0)}{s.lName?.charAt(0)}</div>
                      {s.fName} {s.lName}
                  </td>
                  <td className="p-5 text-slate-300">{s.phone} <br/><span className="text-[11px] text-slate-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">{s.nic}</span></td>
                  <td className="p-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${s.role === 'Coordinator' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'}`}>
                          {s.role === 'Coordinator' ? <Users size={12} className="inline mr-1 mb-0.5"/> : <UserCircle size={12} className="inline mr-1 mb-0.5"/>}
                          {s.role}
                      </span>
                      {s.role === 'Coordinator' && s.assigned_batch_id && (
                          <div className="mt-2 text-[10px] font-semibold text-blue-300 bg-blue-500/10 px-2 py-1 rounded w-max border border-blue-500/20">
                              Assigned: {batches.find(b => b.id === s.assigned_batch_id?.toString())?.name || `Batch ID: ${s.assigned_batch_id}`}
                          </div>
                      )}
                  </td>
                  <td className="p-5 text-right">
                    <button onClick={() => openEditModal(s)} className="p-2 text-blue-400 hover:text-white transition bg-blue-500/10 hover:bg-blue-500/40 rounded-xl mr-2 shadow-sm"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 text-red-400 hover:text-white transition bg-red-500/10 hover:bg-red-500/40 rounded-xl shadow-sm"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && !loading && <tr><td colSpan="4" className="text-center p-10 text-slate-500">No staff found for your business.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-lg p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all"><X size={20} /></button>
            
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
                {editingStaff ? 'Edit Staff' : 'Add Business Staff'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">First Name</label>
                    <input required type="text" value={formData.fName} onChange={e => setFormData({...formData, fName: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder="E.g. John" />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Last Name</label>
                    <input required type="text" value={formData.lName} onChange={e => setFormData({...formData, lName: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder="E.g. Doe"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                      <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder="07XXXXXXXX"/>
                  </div>
                  <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">NIC Number</label>
                      <input required type="text" value={formData.nic} onChange={e => setFormData({...formData, nic: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder="NIC..."/>
                  </div>
              </div>
              
              <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Staff Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner appearance-none">
                    <option value="Ass Manager" className="bg-slate-900">Assistant Manager</option>
                    <option value="Coordinator" className="bg-slate-900">Batch Coordinator</option>
                  </select>
              </div>

              {formData.role === 'Coordinator' && (
                  <div className="animate-in zoom-in duration-300 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                      <label className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-2 block">Assign a Batch</label>
                      <select value={formData.assigned_batch_id} onChange={e => setFormData({...formData, assigned_batch_id: e.target.value})} className="w-full bg-black/50 border border-blue-500/30 rounded-xl p-3 text-white outline-none focus:border-blue-400 transition-all cursor-pointer appearance-none">
                          <option value="" className="bg-slate-900 text-slate-500">-- Do Not Assign Yet --</option>
                          {batches.map(b => (
                              <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                          ))}
                      </select>
                  </div>
              )}

              <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{editingStaff ? 'New Password (Optional)' : 'Assign Password'}</label>
                  <input type={editingStaff ? "password" : "text"} required={!editingStaff} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner" placeholder={editingStaff ? "Leave blank to keep current" : "Enter initial password"} />
              </div>
              
              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-wider py-4 rounded-xl mt-6 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform hover:-translate-y-0.5">
                  {editingStaff ? 'Save Changes' : 'Register Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}