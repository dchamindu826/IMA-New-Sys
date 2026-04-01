import React, { useState, useEffect } from 'react';
import { Loader2, Search, CheckCircle, Eye, CreditCard, Banknote, Clock, Ban, Bot, Filter, X, Undo2, ShieldAlert, Calendar, Lock, Settings2, Save, FileBarChart, AlertTriangle, Send, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PaymentHub() {
    const [loading, setLoading] = useState(false);
    
    // Data States
    const [payments, setPayments] = useState([]);
    const [activeTab, setActiveTab] = useState('pending'); 
    const [reportData, setReportData] = useState(null);
    
    // AI Chat States
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([{ role: 'bot', content: 'Hello! I am your Financial AI Assistant. Select a business, run the report, and ask me anything!' }]);
    const [isChatLoading, setIsChatLoading] = useState(false);

    // Filter States
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    const [selectedBusiness, setSelectedBusiness] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [planFilter, setPlanFilter] = useState('all');

    // Modal States
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [nextDueDate, setNextDueDate] = useState('');
    const [postPayDays, setPostPayDays] = useState('');
    
    // Settings States
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [botEnabled, setBotEnabled] = useState(true);
    const [geminiKeys, setGeminiKeys] = useState(['', '', '', '', '']);
    const [bankKeys, setBankKeys] = useState([{name: '', api_key: ''}, {name: '', api_key: ''}, {name: '', api_key: ''}, {name: '', api_key: ''}, {name: '', api_key: ''}]);

    const extractArray = (resData) => {
        if (!resData) return [];
        if (Array.isArray(resData)) return resData;
        if (Array.isArray(resData.data)) return resData.data;
        if (Array.isArray(resData.businesses)) return resData.businesses;
        return [];
    };

    useEffect(() => { fetchInitialDropdowns(); }, []);
    useEffect(() => { fetchPayments(); }, [activeTab, selectedBusiness, selectedBatch, selectedSubject, planFilter, searchQuery]);

    const fetchInitialDropdowns = async () => {
        try {
            const res = await api.get('/admin/businesses'); 
            setBusinesses(extractArray(res.data)); 
        } catch (e) { console.error("Dropdown init error", e); }
    };

    const handleBusinessChange = async (bizId) => {
        setSelectedBusiness(bizId);
        setSelectedBatch('');
        setSelectedSubject('');
        setBatches([]);
        setSubjects([]);
        if(!bizId) return;
        try {
            const res = await api.post('/payments/admin/get-dropdowns', { type: 'batch', businessId: bizId });
            setBatches(extractArray(res.data)); 
        } catch (e) { console.error(e); }
    };

    const handleBatchChange = async (batId) => {
        setSelectedBatch(batId);
        setSelectedSubject('');
        setSubjects([]);
        if(!batId) return;
        try {
            const groupRes = await api.post('/payments/admin/get-dropdowns', { type: 'group', batchId: batId });
            const groupsArray = extractArray(groupRes.data);
            if(groupsArray.length > 0) {
                const subRes = await api.post('/payments/admin/get-dropdowns', { type: 'course', groupId: groupsArray[0].id });
                setSubjects(extractArray(subRes.data)); 
            }
        } catch (e) { console.error(e); }
    };

    const fetchPayments = async () => {
        if (activeTab === 'reports') return; 
        setLoading(true);
        try {
            let currentStatus = activeTab;
            if (activeTab === 'postpay') currentStatus = 'postPay';

            const payload = {
                business: selectedBusiness,
                batch: selectedBatch,
                course: selectedSubject,
                pPlan: planFilter,
                student: isNaN(searchQuery) ? searchQuery : '',
                studentPhone: !isNaN(searchQuery) && searchQuery ? searchQuery : '',
                pStatus: currentStatus
            };

            let endpoint = activeTab === 'installments' ? '/payments/admin/get-installments' : '/payments/admin/get-payments';
            const res = await api.post(endpoint, payload);
            
            if (res.data && res.data.data) setPayments(res.data.data);
            else setPayments([]);
        } catch (error) {
            toast.error("Failed to load payments!");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (paymentData, newStatus, approveType = 'normal', installmentId = null) => {
        try {
            let endpoint = '';
            let payload = { paymentId: paymentData.paymentId || paymentData.id };

            if (activeTab === 'installments' && installmentId) {
                payload.installmentId = installmentId;
                if (newStatus === 1) {
                    endpoint = '/payments/admin/approve-installment';
                    payload.nextPaymentDue = nextDueDate;
                } else if (newStatus === -3) {
                    endpoint = '/payments/admin/delete-installment'; 
                } else if (newStatus === 2) {
                    endpoint = '/payments/admin/approve-post-pay'; 
                    payload.postPayDays = postPayDays;
                }
            } else {
                if (newStatus === -1) endpoint = '/payments/admin/revert'; 
                else if (newStatus === -3) endpoint = '/payments/admin/decline'; 
                else if (newStatus === 1) {
                    if (approveType === 'free') endpoint = '/payments/admin/free';
                    else { endpoint = '/payments/admin/approve'; payload.approveType = 'normal'; }
                } 
                else if (newStatus === 2) {
                    endpoint = '/payments/admin/approve-post-pay';
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + parseInt(postPayDays || 0));
                    payload.postPayDate = targetDate.toISOString().split('T')[0];
                }
            }

            await api.post(endpoint, payload);
            toast.success(`Action successful!`);
            fetchPayments(); 
            if(activeTab !== 'installments') setSelectedSlip(null);
            setNextDueDate('');
            setPostPayDays('');
        } catch(e) { toast.error("Action failed! Check backend."); }
    };

    const isPDF = (url) => url && url.toLowerCase().endsWith('.pdf');
    const getSlipUrl = (filename) => filename ? `http://72.62.249.211:5000/storage/slipImages/${filename}` : null;

    const generateFinancialReport = async () => {
        if (!selectedBusiness) return toast.error("Please select a Business from the top filter!");
        setLoading(true);
        try {
            const res = await api.post('/payments/admin/reports', { businessId: selectedBusiness });
            setReportData(res.data.data || res.data);
            setChatMessages([{ role: 'bot', content: "✅ **Financial data loaded successfully.**\n\nI have analyzed the revenue streams, student enrollments, and batch performances. How can I assist you in optimizing our financial strategies today?" }]);
        } catch(e) { 
            toast.error("Report generation failed!"); 
        }
        setLoading(false);
    };

    const formatAIMessage = (text) => {
        return text.split('\n').map((line, i) => {
            let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
            if (formattedLine.trim().startsWith('* ')) {
                formattedLine = `<span class="text-indigo-400 mr-2">•</span>` + formattedLine.substring(2);
            }
            return <p key={i} className="mb-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
        });
    };

    const handleSendMessage = async () => {
        if(!chatInput.trim() || !reportData) return;
        const newMsg = { role: 'user', content: chatInput };
        setChatMessages(prev => [...prev, newMsg]);
        setChatInput('');
        setIsChatLoading(true);
        try {
            const res = await api.post('/payments/admin/reports/chat', { 
                message: newMsg.content,
                reportData: reportData 
            });
            setChatMessages(prev => [...prev, { role: 'bot', content: res.data.reply }]);
        } catch(e) {
            toast.error("AI Chat failed");
            setChatMessages(prev => [...prev, { role: 'bot', content: "⚠️ Sorry, I couldn't process that request right now. Please check my API key." }]);
        }
        setIsChatLoading(false);
    };

    const handlePinSubmit = () => {
        if (pinInput === '10954') {
            setShowPinModal(false);
            fetchApiSettings();
            setShowSettingsModal(true);
            setPinInput('');
        } else { toast.error("Invalid PIN!"); }
    };

    const fetchApiSettings = async () => {
        try {
            const res = await api.get('/payments/admin/api-settings');
            if(res.data) {
                const gKeys = res.data.geminiKeys || [];
                const bKeys = res.data.bankKeys || [];
                const newGKeys = ['', '', '', '', ''];
                gKeys.forEach((k, i) => { if(i < 5) newGKeys[i] = k.api_key; });
                setGeminiKeys(newGKeys);
                const newBKeys = [{name:'', api_key:''}, {name:'', api_key:''}, {name:'', api_key:''}, {name:'', api_key:''}, {name:'', api_key:''}];
                bKeys.forEach((k, i) => { if(i < 5) newBKeys[i] = { name: k.name, api_key: k.api_key }; });
                setBankKeys(newBKeys);
            }
        } catch(e) { console.error("Settings fetch failed"); }
    };

    const saveApiSettings = async () => {
        try {
            const payload = {
                pin: '10954', geminiKeys: geminiKeys.map(k => ({ api_key: k })).filter(k => k.api_key),
                bankKeys: bankKeys.filter(k => k.name && k.api_key), botEnabled
            };
            await api.post('/payments/admin/api-settings/save', payload);
            toast.success("Settings saved successfully!");
            setShowSettingsModal(false);
        } catch(e) { toast.error("Failed to save settings"); }
    };

    return (
        <div className="w-full text-slate-200 animate-in fade-in duration-500 h-screen overflow-hidden flex flex-col font-sans pb-4 relative bg-transparent">
            
            {/* Header & Main Filters */}
            <div className="bg-slate-800/30 backdrop-blur-md border-b border-white/10 p-5 flex flex-col gap-4 relative z-40 shrink-0 mx-5 mt-5 rounded-t-[2rem]">
                <button onClick={() => setShowPinModal(true)} className="absolute top-5 right-5 bg-blue-500/10 hover:bg-blue-500 border border-blue-500/30 text-blue-400 hover:text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md">
                    <Settings2 size={16}/> Bot Settings
                </button>
                
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight"><Banknote className="text-green-500" size={24}/> Payment Hub</h2>
                        <p className="text-gray-400 mt-1 text-sm font-medium">Manage enrollments, verify slips, and generate financial reports.</p>
                    </div>
                </div>
                
                <div className="flex flex-col xl:flex-row gap-3">
                    <div className="flex flex-wrap gap-2 flex-1">
                        <select value={selectedBusiness} onChange={(e) => handleBusinessChange(e.target.value)} className="bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 flex-1 min-w-[140px] backdrop-blur-sm">
                            <option value="">All Businesses</option>
                            {Array.isArray(businesses) && businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select value={selectedBatch} onChange={(e) => handleBatchChange(e.target.value)} disabled={!selectedBusiness} className="bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 flex-1 min-w-[140px] disabled:opacity-50 backdrop-blur-sm">
                            <option value="">All Batches</option>
                            {Array.isArray(batches) && batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} disabled={!selectedBatch} className="bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 flex-1 min-w-[140px] disabled:opacity-50 backdrop-blur-sm">
                            <option value="">All Subjects</option>
                            {Array.isArray(subjects) && subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-900/40 px-3 py-2 rounded-lg border border-white/10 flex-1 min-w-[200px] backdrop-blur-sm">
                            <Search size={16} className="text-gray-400"/>
                            <input type="text" placeholder="Search Name or Phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-white w-full text-sm placeholder:text-gray-500"/>
                        </div>
                        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="bg-slate-900/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 shrink-0 backdrop-blur-sm">
                            <option value="all">All Plans</option>
                            <option value="full">Full Payments</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Advance Tabs */}
            <div className="flex overflow-x-auto gap-2 custom-scrollbar px-5 pt-4 pb-3 relative z-30 shrink-0 bg-slate-800/30 backdrop-blur-md mx-5 border-b border-white/10">
                {[
                    { id: 'pending', label: 'Needs Review', icon: Clock, color: 'text-orange-500' },
                    { id: 'installments', label: 'Installments Workflow', icon: CreditCard, color: 'text-blue-400' },
                    { id: 'postpay', label: 'Post Pay', icon: Clock, color: 'text-purple-400' },
                    { id: 'late', label: 'Late Payments', icon: AlertTriangle, color: 'text-red-400' },
                    { id: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-500' },
                    { id: 'rejected', label: 'Rejected', icon: Ban, color: 'text-red-500' },
                    { id: 'reports', label: 'Financial Reports', icon: FileBarChart, color: 'text-indigo-400' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} 
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all border ${activeTab === tab.id ? 'bg-slate-700/80 border-white/20 text-white shadow-lg' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                        <tab.icon size={16} className={tab.color}/> {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative z-10 px-5 pt-4 pb-4 flex flex-col min-h-0 bg-slate-800/30 backdrop-blur-md mx-5 rounded-b-[2rem]">
                {activeTab === 'reports' ? (
                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        {/* Reports Section Maintained as is */}
                    </div>
                ) : (
                    // --- DATA TABLE VIEW ---
                    <div className="h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-slate-800/60 backdrop-blur-xl text-gray-400 uppercase text-[10px] font-black tracking-wider sticky top-0 z-20 rounded-t-xl shadow-sm">
                                    <tr>
                                        <th className="p-4 pl-6 rounded-tl-xl">Student</th>
                                        <th className="p-4">Course / Batch</th>
                                        <th className="p-4">Amount & Info</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 pr-6 text-center rounded-tr-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr><td colSpan="5" className="p-10 text-center"><Loader2 size={32} className="animate-spin text-blue-500 mx-auto"/></td></tr>
                                    ) : payments.length === 0 ? (
                                        <tr><td colSpan="5" className="p-10 text-center text-gray-500 font-medium">No records found matching your filters.</td></tr>
                                    ) : payments.map((p, idx) => {
                                        
                                        let displayAmount = parseFloat(p.calculatedAmount || p.subjectAmount || p.amount || 0).toFixed(2);
                                        let activeInst = null;
                                        
                                        let displayStatus = 'PENDING';
                                        let statusColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                                        
                                        if (p.status === 1) {
                                            displayStatus = 'APPROVED';
                                            statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                        } else if (p.status === -3 || p.status === -2) {
                                            displayStatus = 'REJECTED';
                                            statusColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                                        }
                                        
                                        if (p.isInstallment === 1 && p.installments && p.installments.length > 0) {
                                            activeInst = p.installments.find(i => i.status === -1 || i.status === 0) || p.installments.find(i => i.status === 1) || p.installments[0];
                                            if (activeInst && activeInst.amount) displayAmount = parseFloat(activeInst.amount).toFixed(2);
                                        }

                                        return (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 pl-6">
                                                    <p className="font-bold text-white text-sm">{p.fName} {p.lName}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{p.phone}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-bold text-blue-400 text-sm truncate max-w-[200px]">{p.courseName}</p>
                                                    <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{p.businessName} - {p.batchName}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-extrabold text-white text-base font-sans">LKR {displayAmount}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        {p.isFree === 1 && <span className="text-[9px] uppercase font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">FREE</span>}
                                                        <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${p.isInstallment === 1 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                                            {p.isInstallment === 1 ? 'Installment Plan' : (p.groupPType === 1 ? 'Monthly' : 'Full Payment')}
                                                        </span>
                                                        {p.isLate && <span className="text-[9px] uppercase font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/20">LATE</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${statusColor}`}>
                                                            {displayStatus}
                                                        </span>
                                                        {p.approverName && p.status !== -1 && (
                                                            <span className="text-[9px] text-blue-400 flex items-center gap-1 font-semibold">
                                                                {p.approverName === 'AI Bot' ? <Bot size={10}/> : <User size={10}/>} {p.approverName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 pr-6 text-center">
                                                    {/* 🔥 FIX: slipFileName mapping adjusted here 🔥 */}
                                                    <button onClick={() => setSelectedSlip(activeTab === 'installments' ? { ...p, slipFileName: activeInst?.slipFileName || activeInst?.slip_file_name, slipStatus: activeInst?.status } : { ...p, slipFileName: p.slipFileName || p.slip_file_name, slipStatus: p.status })} className="bg-white/5 text-slate-300 hover:bg-blue-600 hover:text-white p-2 rounded-xl transition-all border border-white/10 shadow-sm"><Eye size={18}/></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

           {/* --- VIEW SLIP MODAL --- */}
            {selectedSlip && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-2xl max-w-6xl w-full flex flex-col lg:flex-row overflow-hidden max-h-[90vh]">
                        
                        <div className="flex-1 bg-black/40 p-4 flex items-center justify-center relative border-r border-white/10 overflow-hidden">
                            {!selectedSlip.slipFileName ? (
                                <div className="text-center text-slate-500"><Ban size={48} className="mx-auto mb-4 opacity-50"/><p className="font-bold">No Slip Uploaded</p></div>
                            ) : isPDF(selectedSlip.slipFileName) ? (
                                <iframe src={getSlipUrl(selectedSlip.slipFileName)} className="w-full h-full rounded-xl bg-white" title="PDF Slip" />
                            ) : (
                                <img 
                                    src={getSlipUrl(selectedSlip.slipFileName)} 
                                    alt="Bank Slip" 
                                    className="max-w-full max-h-full object-contain rounded-xl drop-shadow-2xl" 
                                />
                            )}
                        </div>
                        
                        <div className="w-full lg:w-[480px] p-8 flex flex-col overflow-y-auto custom-scrollbar bg-slate-800/30">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                                <h3 className="text-xl font-extrabold text-white uppercase tracking-wider">Review Payment</h3>
                                <button onClick={() => setSelectedSlip(null)} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl transition-colors"><X size={20}/></button>
                            </div>

                            <div className="space-y-4 text-sm text-gray-300 flex-1">
                                <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Student</p><p className="font-bold text-white text-base">{selectedSlip.fName} {selectedSlip.lName}</p></div>
                                <div><p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Course / Batch</p><p className="font-bold text-blue-400">{selectedSlip.courseName} {selectedSlip.isInstallment === 1 ? '(Bundle)' : ''}</p></div>

                                {selectedSlip.isInstallment === 1 && selectedSlip.installments ? (
                                    <div className="mt-6">
                                        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-2">Installment Phases</h4>
                                        <div className="space-y-4">
                                            {selectedSlip.installments.map((inst, idx) => (
                                                <div key={inst.id} className={`p-4 rounded-2xl border transition-all ${inst.status === -1 ? 'bg-orange-500/10 border-orange-500/30' : inst.status === 1 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-black/20 border-white/5'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-bold text-gray-400">Phase {idx + 1}</span>
                                                            <p className="font-extrabold text-white text-lg font-sans mt-1">LKR {parseFloat(inst.amount).toFixed(2)}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${inst.status === 1 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : inst.status === -1 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                            {inst.status === 1 ? 'APPROVED' : inst.status === -1 ? 'SLIP UPLOADED' : 'UNPAID PENDING'}
                                                        </span>
                                                    </div>

                                                    {(inst.status === -1 || inst.status === 0) && (
                                                        <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none focus:border-orange-500" title="Next Due Date"/>
                                                                <input type="number" placeholder="Post Pay Days" value={postPayDays} onChange={(e) => setPostPayDays(e.target.value)} className="w-1/3 bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs outline-none focus:border-purple-500"/>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => handleStatusChange(selectedSlip, 1, 'normal', inst.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition-transform hover:scale-[1.02]"><CheckCircle size={14} className="inline mr-1"/> Approve</button>
                                                                <button onClick={() => handleStatusChange(selectedSlip, 2, 'postpay', inst.id)} disabled={!postPayDays} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg text-xs transition-transform hover:scale-[1.02] disabled:opacity-50"><Clock size={14} className="inline mr-1"/> Post Pay</button>
                                                                <button onClick={() => handleStatusChange(selectedSlip, -3, 'reject', inst.id)} className="w-10 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white font-bold rounded-lg flex justify-center items-center transition-all"><X size={16}/></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-black/20 p-5 rounded-2xl border border-white/5 mt-4">
                                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1">Paid Amount</p>
                                            <p className="font-extrabold text-white font-sans text-3xl">
                                                LKR {parseFloat(selectedSlip.calculatedAmount || selectedSlip.subjectAmount || selectedSlip.amount || 0).toFixed(2)}
                                            </p>
                                            <span className="inline-block mt-3 text-[10px] font-bold bg-white/10 px-3 py-1 rounded-lg text-gray-300 uppercase">
                                                {selectedSlip.groupPType === 1 ? 'MONTHLY' : 'FULL PAYMENT'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {selectedSlip.isInstallment !== 1 && (
                                <div className="mt-8 space-y-3 pt-6 border-t border-white/10">
                                    {(selectedSlip.slipStatus === -1 || selectedSlip.slipStatus === 0) && (
                                        <>
                                            <button onClick={() => handleStatusChange(selectedSlip, 1, 'normal')} className="w-full bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] uppercase tracking-wide text-sm border border-emerald-400/30"><CheckCircle size={18}/> Approve</button>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleStatusChange(selectedSlip, 2, 'postpay')} disabled={!postPayDays} className="flex-1 bg-purple-600/80 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 shadow-lg shadow-purple-500/20 transition-transform hover:scale-[1.02] disabled:opacity-50 text-sm border border-purple-400/30"><Clock size={16}/> Post Pay</button>
                                                <button onClick={() => handleStatusChange(selectedSlip, 1, 'free')} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-transform hover:scale-[1.02] text-sm"><ShieldAlert size={16}/> Free</button>
                                            </div>
                                            <button onClick={() => handleStatusChange(selectedSlip, -3)} className="w-full mt-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-4 rounded-xl border border-red-500/30 hover:border-red-500 transition-all flex justify-center items-center gap-2 uppercase tracking-wide text-sm"><Ban size={18}/> Reject</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Modals for PIN & API Settings */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative text-center">
                        <button onClick={() => setShowPinModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18}/></button>
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 flex items-center justify-center rounded-full mx-auto mb-4 border border-red-500/20"><Lock size={28}/></div>
                        <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wider">Restricted Area</h3>
                        <p className="text-sm text-gray-400 mb-6">Please enter the security PIN to access the Bot & API Settings.</p>
                        
                        <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter PIN" className="w-full bg-black/40 border border-white/10 text-white text-center text-2xl tracking-[0.5em] font-bold p-4 rounded-xl outline-none focus:border-red-500 mb-6" autoFocus/>
                        
                        <button onClick={handlePinSubmit} className="w-full bg-red-600/80 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl uppercase tracking-wider text-sm transition-all shadow-lg border border-red-400/30">Verify & Enter</button>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                            <h3 className="text-xl font-extrabold text-white flex items-center gap-3 uppercase tracking-wider"><Settings2 className="text-blue-500"/> System Settings & Bots</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl transition-colors"><X size={20}/></button>
                        </div>

                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 p-6 rounded-2xl flex justify-between items-center">
                                <div>
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2 mb-1"><Bot className="text-blue-400"/> AI Slip Verification Bot</h4>
                                    <p className="text-sm text-gray-400">Automatically verifies and approves correct deposit slips using AI.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer scale-125">
                                    <input type="checkbox" className="sr-only peer" checked={botEnabled} onChange={() => setBotEnabled(!botEnabled)} />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Gemini API Keys (Max 5)</h4>
                                    {geminiKeys.map((key, idx) => (
                                        <input key={`gem-${idx}`} type="text" placeholder={`API Key ${idx + 1}`} value={key} 
                                            onChange={(e) => { const newKeys = [...geminiKeys]; newKeys[idx] = e.target.value; setGeminiKeys(newKeys); }} 
                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-blue-500 font-mono" />
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Bank API Details (Max 5)</h4>
                                    {bankKeys.map((bank, idx) => (
                                        <div key={`bank-${idx}`} className="flex gap-2">
                                            <input type="text" placeholder="Bank Name" value={bank.name} 
                                                onChange={(e) => { const newKeys = [...bankKeys]; newKeys[idx].name = e.target.value; setBankKeys(newKeys); }} 
                                                className="w-1/3 bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-purple-500" />
                                            <input type="text" placeholder="API Key / Secret" value={bank.api_key} 
                                                onChange={(e) => { const newKeys = [...bankKeys]; newKeys[idx].api_key = e.target.value; setBankKeys(newKeys); }} 
                                                className="w-2/3 bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-purple-500 font-mono" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-white/5">
                            <button onClick={saveApiSettings} className="w-full bg-blue-600/80 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-lg border border-blue-400/30 transition-all uppercase tracking-wide text-sm">
                                <Save size={18}/> Save Settings Securely
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}