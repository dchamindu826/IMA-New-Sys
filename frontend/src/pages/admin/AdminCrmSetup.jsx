import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
    Loader2, MessageSquare, Building2, Bot, Power, FileText, Settings, 
    KeySquare, UploadCloud, Users, AlertTriangle, Terminal, Trash2, Eye, 
    X, MessageCircle, CheckCircle, LayoutTemplate, PlusCircle, Clock, Send, Check, Plus, RefreshCw
} from 'lucide-react';
import api from '../../api/axios';
import { API_BASE_URL } from '../../config';

const defaultPhaseConfig = {
    isAiBotActive: false, isAutoReplyActive: false, batchId: '', metaPhoneId: '', metaWabaId: '', metaToken: '', geminiKeys: ['', '', '', '', ''], replies: [{ text: '', file: null }, { text: '', file: null }, { text: '', file: null }], handoffLimit: 5, trainedFiles: []
};

export default function AdminCrmSetup() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState(null);
    
    // Tabs: FREE_SEMINAR | AFTER_SEMINAR | TEMPLATES
    const [activeTab, setActiveTab] = useState('FREE_SEMINAR');

    const [config, setConfig] = useState({
        FREE_SEMINAR: JSON.parse(JSON.stringify(defaultPhaseConfig)),
        AFTER_SEMINAR: JSON.parse(JSON.stringify(defaultPhaseConfig))
    });

    const [isIngesting, setIsIngesting] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState([]);
    const terminalRef = useRef(null);

    // --- TEMPLATE LOGIC STATES ---
    const [templates, setTemplates] = useState([]);
    const [templateUploading, setTemplateUploading] = useState(false);
    const [headerMediaUrl, setHeaderMediaUrl] = useState(null); 
    const [tplForm, setTplForm] = useState({
        name: '', category: 'MARKETING', language: 'en_US', headerType: 'NONE', headerText: '', bodyText: '', footerText: '', buttons: []
    });

    const CLOUD_NAME = "dyixoaldi"; 
    const UPLOAD_PRESET = "Chat Bot System"; 

    useEffect(() => {
        const fetchBusinesses = async () => {
            try {
                const res = await api.get('/admin/businesses');
                let bList = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.businesses || []);
                setBusinesses(bList);
                if (bList.length > 0) handleSelectBiz(bList[0]);
            } catch (error) { toast.error("Failed to load businesses"); } 
            finally { setLoading(false); }
        };
        fetchBusinesses();
    }, []);

    useEffect(() => { if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }, [terminalLogs]);

    const handleSelectBiz = async (biz) => {
        setSelectedBiz(biz);
        setConfig({ FREE_SEMINAR: JSON.parse(JSON.stringify(defaultPhaseConfig)), AFTER_SEMINAR: JSON.parse(JSON.stringify(defaultPhaseConfig)) });
        try {
            const batchRes = await api.get(`/admin/batches/${biz.id}`);
            setBatches(batchRes.data?.batches || []);
            
            const crmRes = await api.get(`/crm/business/crm-config/${biz.id}`);
            if (crmRes.data && Object.keys(crmRes.data).length > 0) setConfig(crmRes.data);

            fetchTemplates(biz.id);
        } catch (e) { console.error(e); }
    };

    // --- TEMPLATE FUNCTIONS ---
    const fetchTemplates = async (bizId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/templates?businessId=${bizId}`, { 
                headers: { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` } 
            });
            const data = await res.json();
            if(Array.isArray(data)) setTemplates(data);
        } catch (err) { console.error(err); }
    };

    const handleDeleteTemplate = async (templateName) => {
        if(!window.confirm(`Delete '${templateName}' permanently from Meta?`)) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/templates/${templateName}?businessId=${selectedBiz.id}`, { 
                method: 'DELETE', 
                headers: { 'Authorization': `Bearer ${token}`, 'token': `Bearer ${token}` } 
            });
            if(res.ok) { toast.success("Template deleted!"); fetchTemplates(selectedBiz.id); } 
            else toast.error("Could not delete");
        } catch (err) { toast.error("Failed to delete."); }
    };

    const handleTemplateMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setTemplateUploading(true);
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", UPLOAD_PRESET); 
        data.append("cloud_name", CLOUD_NAME);
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: "POST", body: data });
            const result = await res.json();
            if (result.secure_url) setHeaderMediaUrl(result.secure_url);
            else toast.error("Upload Failed!");
        } catch (error) { toast.error("Upload Failed"); } 
        finally { setTemplateUploading(false); }
    };

    const handleAddButton = () => {
        if (tplForm.buttons.length < 3) setTplForm({ ...tplForm, buttons: [...tplForm.buttons, { type: 'QUICK_REPLY', text: '' }] });
        else toast.error("Max 3 buttons allowed.");
    };

    const handleTemplateSubmit = async (e) => {
        e.preventDefault();
        if (!/^[a-z0-9_]+$/.test(tplForm.name)) return toast.error("Name must be lowercase/numbers/underscores only.");
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tplForm.headerType) && !headerMediaUrl) return toast.error(`Upload ${tplForm.headerType} first!`);
        if (tplForm.buttons.some(btn => btn.text.trim() === '')) return toast.error("Fill all button texts.");

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const payload = { ...tplForm, headerUrl: headerMediaUrl, businessId: selectedBiz.id };
            const res = await fetch(`${API_BASE_URL}/api/templates/create`, {
                method: "POST", 
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "token": `Bearer ${token}` }, 
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                toast.success("Template Submitted for Approval!");
                setTplForm({ name: '', category: 'MARKETING', language: 'en_US', headerType: 'NONE', headerText: '', bodyText: '', footerText: '', buttons: [] });
                setHeaderMediaUrl(null); 
                fetchTemplates(selectedBiz.id);
            } else { toast.error("Submission Failed"); }
        } catch (err) { toast.error("Network Error"); } 
        finally { setSaving(false); }
    };

    // --- CONFIG FUNCTIONS ---
    const handleToggleBot = (phase, botType) => {
        setConfig(prev => {
            const newState = { ...prev };
            const phaseData = { ...newState[phase] };
            if (botType === 'ai') {
                phaseData.isAiBotActive = !phaseData.isAiBotActive;
                if (phaseData.isAiBotActive) phaseData.isAutoReplyActive = false;
            } else {
                phaseData.isAutoReplyActive = !phaseData.isAutoReplyActive;
                if (phaseData.isAutoReplyActive) phaseData.isAiBotActive = false;
            }
            newState[phase] = phaseData;
            return newState;
        });
    };

    const handleConfigChange = (phase, field, value) => {
        setConfig(prev => ({ ...prev, [phase]: { ...prev[phase], [field]: value } }));
    };

    const handleGeminiKeyChange = (phase, index, value) => {
        setConfig(prev => {
            const keys = [...prev[phase].geminiKeys];
            keys[index] = value;
            return { ...prev, [phase]: { ...prev[phase], geminiKeys: keys } };
        });
    };

    const handleReplyChange = (phase, index, field, value) => {
        setConfig(prev => {
            const replies = [...prev[phase].replies];
            replies[index] = { ...replies[index], [field]: value };
            return { ...prev, [phase]: { ...prev[phase], replies } };
        });
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setIsIngesting(true);
        setTerminalLogs(["[SYSTEM] Initializing Data Ingestion...", "[SYSTEM] Allocating Vector Memory..."]);
        let delay = 500;
        files.forEach((file) => {
            setTimeout(() => setTerminalLogs(prev => [...prev, `[READING] Extracting text from ${file.name}...`]), delay);
            delay += 800;
            setTimeout(() => setTerminalLogs(prev => [...prev, `[PROCESS] Tokenizing and Vectorizing...`]), delay);
            delay += 1000;
            setTimeout(() => setTerminalLogs(prev => [...prev, `[SUCCESS] Inserted tokens for ${file.name}`]), delay);
            delay += 600;
        });
        setTimeout(() => {
            setTerminalLogs(prev => [...prev, "", "[SYSTEM] AI Model Training Complete!"]);
            setTimeout(() => {
                setIsIngesting(false);
                const newFiles = files.map(f => ({ name: f.name, size: (f.size / 1024).toFixed(2) + ' KB', type: f.type, fileObj: f, url: URL.createObjectURL(f) }));
                setConfig(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], trainedFiles: [...prev[activeTab].trainedFiles, ...newFiles] } }));
                toast.success("Files ingested!");
            }, 1500);
        }, delay + 500);
    };

    const handleDeleteFile = async (index, file) => {
        if(!window.confirm("Remove file from AI Base?")) return;
        try {
            if (!file.fileObj) await api.post('/crm/business/crm/delete-file', { businessId: selectedBiz.id, phase: activeTab, fileName: file.name });
            setConfig(prev => { const newFiles = [...prev[activeTab].trainedFiles]; newFiles.splice(index, 1); return { ...prev, [activeTab]: { ...prev[activeTab], trainedFiles: newFiles } }; });
            toast.success("File deleted.");
        } catch (error) { toast.error("Failed to delete."); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('businessId', selectedBiz.id);
            formData.append('configData', JSON.stringify(config));
            ['FREE_SEMINAR', 'AFTER_SEMINAR'].forEach(phase => {
                config[phase].trainedFiles.forEach((tf) => { if(tf.fileObj) formData.append(`trainedFiles_${phase}`, tf.fileObj); });
                config[phase].replies.forEach((rep, i) => { if(rep.file) formData.append(`replyFile_${phase}_${i}`, rep.file); });
            });
            await api.post('/crm/business/crm/save', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            toast.success(`CRM settings saved!`);
        } catch (error) { toast.error("Failed to save!"); } 
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

    return (
        <div className="w-full text-slate-200 animate-in fade-in duration-500 flex flex-col font-sans pb-8">
            <div className="mb-6 shrink-0 bg-slate-900/40 border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-lg backdrop-blur-md">
                <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-wide drop-shadow-md mb-2">
                    <MessageSquare className="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" size={32}/> AI CRM Setup & Templates
                </h2>
                <p className="text-slate-300 font-medium">Configure Bots, Meta APIs, and Official WhatsApp Templates.</p>
            </div>

            <div className="flex flex-col gap-6">
                {/* Business Selector */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 shadow-xl backdrop-blur-md">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Building2 size={18} className="text-blue-400"/> Selected Business</h3>
                    <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                        {businesses.map(biz => (
                            <div key={biz.id} onClick={() => handleSelectBiz(biz)} className={`px-6 py-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 min-w-max group ${selectedBiz?.id === biz.id ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'}`}>
                                <div className={`w-2.5 h-2.5 rounded-full transition-all ${selectedBiz?.id === biz.id ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa] scale-125' : 'bg-slate-500 group-hover:bg-slate-400'}`}></div>
                                <h4 className={`font-bold text-base tracking-wide ${selectedBiz?.id === biz.id ? 'text-blue-300' : 'text-slate-300 group-hover:text-white'}`}>{biz.name}</h4>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedBiz && (
                    <div className="bg-slate-900/60 border border-white/10 rounded-[2rem] flex flex-col shadow-2xl backdrop-blur-xl relative">
                        {/* Tabs */}
                        <div className="flex border-b border-white/5 bg-black/10 overflow-x-auto">
                            <button onClick={() => setActiveTab('FREE_SEMINAR')} className={`px-6 py-5 text-sm font-bold tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === 'FREE_SEMINAR' ? 'border-b-2 border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>Free Seminar Config</button>
                            <button onClick={() => setActiveTab('AFTER_SEMINAR')} className={`px-6 py-5 text-sm font-bold tracking-widest uppercase transition-all whitespace-nowrap ${activeTab === 'AFTER_SEMINAR' ? 'border-b-2 border-blue-400 text-blue-300 bg-blue-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>After Seminar Config</button>
                            <button onClick={() => setActiveTab('TEMPLATES')} className={`px-6 py-5 text-sm font-bold tracking-widest uppercase transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TEMPLATES' ? 'border-b-2 border-purple-400 text-purple-300 bg-purple-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><LayoutTemplate size={18}/> Meta Templates</button>
                        </div>

                        {/* TEMPLATES TAB */}
                        {activeTab === 'TEMPLATES' && (
                            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Form */}
                                <div className="space-y-5 border border-white/5 bg-black/20 p-6 rounded-3xl">
                                    <h4 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><PlusCircle className="text-purple-400"/> Create New Template</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs text-slate-400 uppercase font-bold">Template Name</label><input required type="text" value={tplForm.name} onChange={e => setTplForm({...tplForm, name: e.target.value.toLowerCase().replace(/ /g, '_')})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="promo_jan_2026"/></div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold">Category</label>
                                            <select value={tplForm.category} onChange={e => setTplForm({...tplForm, category: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                                                <option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option><option value="AUTHENTICATION">Auth</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold">Language</label>
                                            <select value={tplForm.language} onChange={e => setTplForm({...tplForm, language: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                                                <option value="en_US">English (US)</option><option value="si_LK">Sinhala</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase font-bold">Header Type</label>
                                            <select value={tplForm.headerType} onChange={e => { setTplForm({...tplForm, headerType: e.target.value}); setHeaderMediaUrl(null); }} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                                                <option value="NONE">None</option><option value="TEXT">Text Header</option><option value="IMAGE">Image</option><option value="VIDEO">Video</option><option value="DOCUMENT">PDF</option>
                                            </select>
                                        </div>
                                    </div>

                                    {tplForm.headerType === 'TEXT' && (<div><label className="text-xs text-slate-400 uppercase font-bold">Header Text</label><input type="text" maxLength={60} value={tplForm.headerText} onChange={e => setTplForm({...tplForm, headerText: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"/></div>)}
                                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tplForm.headerType) && (
                                        <div className="bg-black/20 border border-white/10 rounded-xl p-4">
                                            {!headerMediaUrl ? (
                                                <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-white/5 transition ${templateUploading ? 'opacity-50' : ''}`}>
                                                    {templateUploading ? <Loader2 className="animate-spin text-blue-500 mb-2"/> : <UploadCloud className="text-slate-400 mb-2"/>}
                                                    <span className="text-sm text-slate-300">{templateUploading ? 'Uploading...' : 'Click to upload sample'}</span>
                                                    <input type="file" className="hidden" accept={tplForm.headerType === 'IMAGE' ? "image/*" : tplForm.headerType === 'VIDEO' ? "video/*" : ".pdf"} onChange={handleTemplateMediaUpload} disabled={templateUploading}/>
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg"><span className="text-xs font-bold text-emerald-400">Media Uploaded Successfully</span><button type="button" onClick={() => setHeaderMediaUrl(null)} className="text-red-400"><X size={18}/></button></div>
                                            )}
                                        </div>
                                    )}

                                    <div><label className="text-xs text-slate-400 uppercase font-bold">Message Body</label><textarea required rows={4} value={tplForm.bodyText} onChange={e => setTplForm({...tplForm, bodyText: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none" placeholder="Hello {{1}}, we have..."/></div>
                                    <div><label className="text-xs text-slate-400 uppercase font-bold">Footer (Optional)</label><input type="text" value={tplForm.footerText} onChange={e => setTplForm({...tplForm, footerText: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"/></div>
                                    
                                    <div className="border border-white/10 rounded-xl p-4">
                                        <div className="flex justify-between items-center mb-3"><label className="text-xs text-slate-400 uppercase font-bold">Buttons (Max 3)</label>{tplForm.buttons.length < 3 && <button type="button" onClick={handleAddButton} className="text-[10px] text-blue-400 flex items-center gap-1"><PlusCircle size={12}/> Add</button>}</div>
                                        {tplForm.buttons.map((btn, index) => (
                                            <div key={index} className="flex gap-2 mb-2">
                                                <input type="text" maxLength={25} value={btn.text} onChange={(e) => { const newBtns = [...tplForm.buttons]; newBtns[index].text = e.target.value; setTplForm({...tplForm, buttons: newBtns})}} placeholder="Button Text" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"/>
                                                <button type="button" onClick={() => { const newBtns = tplForm.buttons.filter((_, i) => i !== index); setTplForm({...tplForm, buttons: newBtns})}} className="p-2 text-red-400"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={handleTemplateSubmit} disabled={saving || templateUploading} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition flex justify-center items-center gap-2">
                                        {saving ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Submit to Meta
                                    </button>
                                </div>

                                {/* List */}
                                <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-2">
                                    <h4 className="text-lg font-bold text-white mb-2 flex justify-between">Available Templates <button onClick={() => fetchTemplates(selectedBiz.id)} className="text-xs text-blue-400"><RefreshCw size={14}/></button></h4>
                                    {templates.map(tpl => (
                                        <div key={tpl.id} className="bg-black/20 border border-white/5 p-4 rounded-2xl relative group">
                                            <button onClick={() => handleDeleteTemplate(tpl.name)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
                                            <h5 className="font-bold text-white flex items-center gap-2 mb-2">{tpl.name} <span className={`text-[9px] px-2 py-0.5 rounded ${tpl.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{tpl.status}</span></h5>
                                            <p className="text-xs text-slate-400 bg-white/5 p-2 rounded whitespace-pre-wrap">{tpl.components.find(c => c.type === 'BODY')?.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PHASE CONFIG TAB (FREE / AFTER) */}
                        {activeTab !== 'TEMPLATES' && (
                            <>
                                <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 bg-black/20 p-2 rounded-2xl border border-white/5">
                                        <button onClick={() => handleToggleBot(activeTab, 'ai')} className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-bold text-base border transition-all ${config[activeTab].isAiBotActive ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                            <Bot size={20} className={config[activeTab].isAiBotActive ? 'animate-pulse' : ''}/> AI Chat Bot
                                        </button>
                                        <button onClick={() => handleToggleBot(activeTab, 'auto')} className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-bold text-base border transition-all ${config[activeTab].isAutoReplyActive ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}>
                                            <MessageCircle size={20} className={config[activeTab].isAutoReplyActive ? 'animate-pulse' : ''}/> Auto Reply Bot
                                        </button>
                                    </div>

                                    <div className="flex flex-col w-full md:w-64">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-2"><Users size={14}/> Target Batch / Target Audience</label>
                                        <select value={config[activeTab].batchId} onChange={(e) => handleConfigChange(activeTab, 'batchId', e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-blue-500/50 transition appearance-none">
                                            <option value="">Select Batch (Optional)</option>
                                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-10">
                                    <div className="space-y-8">
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Settings className="text-slate-400" size={20}/> Meta WhatsApp API Setup</h3>
                                            <div className="space-y-4 bg-black/20 p-6 rounded-3xl border border-white/5">
                                                <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Phone Number ID</label><input type="text" value={config[activeTab].metaPhoneId} onChange={(e) => handleConfigChange(activeTab, 'metaPhoneId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition" placeholder="e.g. 10123456789"/></div>
                                                <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">WhatsApp Business Account ID</label><input type="text" value={config[activeTab].metaWabaId} onChange={(e) => handleConfigChange(activeTab, 'metaWabaId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition" placeholder="e.g. 10987654321"/></div>
                                                <div><label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 block">Access Token</label><textarea value={config[activeTab].metaToken} onChange={(e) => handleConfigChange(activeTab, 'metaToken', e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500/50 transition resize-none" placeholder="EAAG..."/></div>
                                            </div>
                                        </div>

                                        <div className={!config[activeTab].isAutoReplyActive ? 'opacity-30 pointer-events-none' : ''}>
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><MessageCircle className="text-slate-400" size={20}/> Sequential Auto Replies</h3>
                                            <div className="space-y-4">
                                                {config[activeTab].replies.map((reply, i) => (
                                                    <div key={i} className="flex gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">{i + 1}</div>
                                                        <div className="flex-1 space-y-3">
                                                            <textarea value={reply.text} onChange={(e) => handleReplyChange(activeTab, i, 'text', e.target.value)} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm resize-none" placeholder={`Message ${i + 1}...`}/>
                                                            <div className="flex items-center gap-3">
                                                                <label className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition text-xs font-bold text-slate-300 border border-white/5"><UploadCloud size={14}/> {reply.file ? reply.file.name : reply.fileUrl ? 'Media Attached' : 'Attach Media'}<input type="file" className="hidden" onChange={(e) => handleReplyChange(activeTab, i, 'file', e.target.files[0])} accept="image/*,video/*,.pdf"/></label>
                                                                {reply.file && <button onClick={() => handleReplyChange(activeTab, i, 'file', null)} className="text-red-400 p-1 hover:bg-red-500/20 rounded"><X size={14}/></button>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`space-y-8 ${!config[activeTab].isAiBotActive ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <div>
                                            <div className="flex justify-between items-end mb-4">
                                                <h3 className="text-lg font-bold text-white flex items-center gap-2"><KeySquare className="text-slate-400" size={20}/> Gemini API Keys</h3>
                                                <div className="text-right">
                                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Human Handoff Limit</label>
                                                    <input type="number" min="1" max="20" value={config[activeTab].handoffLimit} onChange={(e) => handleConfigChange(activeTab, 'handoffLimit', e.target.value)} className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-center"/>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-6 rounded-3xl border border-white/5">
                                                {config[activeTab].geminiKeys.map((key, i) => (
                                                    <input key={i} type="text" value={key} onChange={(e) => handleGeminiKeyChange(activeTab, i, e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none text-sm placeholder:text-slate-600" placeholder={`Key ${i + 1}`}/>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText className="text-slate-400" size={20}/> Knowledge Base Setup</h3>
                                            <div className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-4">
                                                <label className={`w-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${isIngesting ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-600 hover:border-blue-500 hover:bg-white/5'}`}>
                                                    {isIngesting ? <Loader2 size={30} className="text-yellow-400 animate-spin mb-3"/> : <UploadCloud size={30} className="text-slate-400 mb-3"/>}
                                                    <span className="font-bold text-slate-300">{isIngesting ? 'Ingesting Data to Vector DB...' : 'Upload Training Documents'}</span>
                                                    <span className="text-xs text-slate-500 mt-2 text-center">PDF, TXT, DOCX supported. <br/>The AI will read and learn from these files.</span>
                                                    <input type="file" multiple className="hidden" accept=".pdf,.txt,.docx" onChange={handleFileUpload} disabled={isIngesting}/>
                                                </label>

                                                {isIngesting && (
                                                    <div className="bg-black/80 rounded-xl p-4 border border-white/10 font-mono text-[10px] text-emerald-400 h-32 overflow-y-auto" ref={terminalRef}>
                                                        <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-white/10 pb-2"><Terminal size={12}/> AI Vectorization Terminal</div>
                                                        {terminalLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                                                    </div>
                                                )}

                                                {config[activeTab].trainedFiles.length > 0 && (
                                                    <div className="space-y-2 mt-4">
                                                        <p className="text-xs font-bold text-slate-400 uppercase">Trained Files Base ({config[activeTab].trainedFiles.length})</p>
                                                        {config[activeTab].trainedFiles.map((file, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0"><CheckCircle size={14}/></div>
                                                                    <div className="truncate"><p className="text-sm font-bold text-white truncate">{file.name}</p><p className="text-[10px] text-slate-400">{file.size} • Vectorized</p></div>
                                                                </div>
                                                                <button onClick={() => handleDeleteFile(i, file)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"><Trash2 size={16}/></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 border-t border-white/10 bg-black/40 flex justify-end shrink-0">
                                    <button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold px-12 py-4 rounded-2xl transition shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2">
                                        {saving ? <Loader2 className="animate-spin" size={20}/> : <Check size={20}/>} Save Configuration
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}