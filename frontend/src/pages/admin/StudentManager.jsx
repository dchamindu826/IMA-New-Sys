import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Search, Users, ExternalLink, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentManager({ loggedInUser }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const isAdmin = ['System Admin', 'Admin', 'Director', 'Manager'].includes(loggedInUser?.role);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('all');

  useEffect(() => {
    if (isAdmin) {
      api.get('/admin/businesses').then(res => {
          setBusinesses(Array.isArray(res.data) ? res.data : (res.data?.businesses || []));
      }).catch(console.error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchStudents();
  }, [selectedBusiness, searchTerm]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/students-list?search=${searchTerm}&business_id=${selectedBusiness}`);
      setStudents(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGhostLogin = async (studentId) => {
    const toastId = toast.loading("Granting Access...");
    try {
        // 🔥 FIX: Backend route updated to /admin/ghost-login
        const res = await api.post(`/admin/ghost-login/${studentId}`);
        const studentUrl = `${window.location.origin}/student/dashboard?token=${res.data.token}`;
        window.open(studentUrl, '_blank');
        toast.success("Dashboard Opened!", { id: toastId });
    } catch (error) {
        toast.error("Access Denied.", { id: toastId });
    }
  };

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col font-sans pb-4 max-w-screen-2xl mx-auto px-4 lg:px-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="text-blue-500" size={32}/> Student Database
          </h2>
        </div>

        <div className="flex gap-4 items-center">
            {isAdmin && (
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-2 rounded-xl border border-white/10">
    <Filter size={16} className="text-slate-400"/>
    <select value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)} className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer">
        {/* 🔥 FIX: Option tags වලට Background Color එකක් දුන්නා 🔥 */}
        <option value="all" className="bg-slate-900 text-white">All Businesses</option>
        {businesses.map(b => (
            <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                {b.name}
            </option>
        ))}
    </select>
</div>
            )}
            
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16}/>
                <input 
                    type="text" 
                    placeholder="Search Name, Phone, NIC..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500 w-64"
                />
            </div>
        </div>
      </div>

      <div className="flex-1 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                <tr>
                  <th className="p-4 rounded-tl-xl">Full Name</th>
                  <th className="p-4">Phone Number</th>
                  <th className="p-4">NIC Number</th>
                  <th className="p-4">Address</th>
                  <th className="p-4 rounded-tr-xl text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                    <tr><td colSpan="5" className="text-center py-10 text-blue-500 font-bold animate-pulse">Loading Database...</td></tr>
                ) : students.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 text-slate-500">No students found.</td></tr>
                ) : (
                    students.map(student => (
                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white">{student.fName} {student.lName}</td>
                            <td className="p-4 text-slate-300">{student.phone || 'N/A'}</td>
                            <td className="p-4 text-slate-300">{student.nic || 'N/A'}</td>
                            <td className="p-4 text-slate-400 text-xs truncate max-w-[200px]">{student.address || 'N/A'}</td>
                            <td className="p-4 text-center">
                                <button onClick={() => handleGhostLogin(student.id)} className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 px-3 py-1.5 rounded-lg transition-all shadow-lg flex items-center gap-2 text-xs font-bold mx-auto">
                                    <ExternalLink size={14}/> Ghost Login
                                </button>
                            </td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}