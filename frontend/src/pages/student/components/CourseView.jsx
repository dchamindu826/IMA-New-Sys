import React, { useState, useEffect } from 'react';
import axios from '../../../api/axios';
import { Loader2, Video, MonitorPlay, FileText, FileSignature, CheckCircle, ArrowLeft, X, Lock, CalendarDays, FolderOpen, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CourseView({ courseId, onBack }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('live');
    const [openFolders, setOpenFolders] = useState({});
    const [playingVideo, setPlayingVideo] = useState(null);

    useEffect(() => {
        axios.get(`/student/module/${courseId}`).then(res => {
            setData(res.data);
            if (res.data?.lessonGroups) {
                const initialOpen = {};
                res.data.lessonGroups.forEach(f => initialOpen[f.id] = true);
                setOpenFolders(initialOpen);
            }
        }).finally(() => setLoading(false));
    }, [courseId]);

    const toggleFolder = (folderId) => setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
    const getEmbedUrl = (url) => url ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/').replace('/view', '/preview').replace('/rec/share/', '/rec/play/') : '';

    if (loading) return <div className="flex justify-center items-center py-40"><Loader2 className="animate-spin text-red-500" size={50} /></div>;

    const tabs = [
        { id: 'live', name: 'Live Classes', icon: Video, data: data?.liveClasses || [] },
        { id: 'recordings', name: 'Recordings', icon: MonitorPlay, data: data?.recordings || [] },
        { id: 'documents', name: 'Documents', icon: FileText, data: data?.documents || [] },
        { id: 'sPapers', name: 'Structured Papers', icon: FileSignature, data: data?.sPapers || [] },
        { id: 'papers', name: 'MCQ Exams', icon: CheckCircle, data: data?.papers || [] },
    ];

    const currentTabInfo = tabs.find(t => t.id === activeTab);
    const currentData = currentTabInfo?.data || [];
    const getTypeInt = (id) => ({ live: 1, recordings: 2, documents: 3, sPapers: 4, papers: 5 }[id] || 1);
    const getFolderId = (item) => String(item.content_group_id ?? item.contentGroupId ?? item.folder_id);

    const renderContentRows = () => {
        if (currentData.length === 0) return <div className="text-white/40 text-center py-20 font-medium">No content uploaded yet.</div>;
        
        const folders = (data?.lessonGroups || []).filter(f => parseInt(f.type) === getTypeInt(activeTab));
        const groupedItems = folders.map(folder => ({ folder, items: currentData.filter(item => getFolderId(item) === String(folder.id)) }));
        const uncategorizedItems = currentData.filter(item => !folders.find(f => String(f.id) === getFolderId(item)));

        return (
            <div className="flex flex-col gap-6">
                {groupedItems.map(({folder, items}) => (
                    <div key={folder.id} className="bg-black/20 border border-white/10 hover:border-red-500/30 rounded-2xl overflow-hidden transition-all">
                        <div onClick={() => toggleFolder(folder.id)} className="flex justify-between items-center bg-white/5 p-4 md:p-6 cursor-pointer hover:bg-white/10">
                            <h4 className="text-base md:text-lg font-bold text-white flex items-center gap-3"><FolderOpen size={20} className="text-red-500"/>{folder.title}</h4>
                            <ChevronDown className={`text-white/50 transition-transform ${openFolders[folder.id] ? 'rotate-180' : ''}`} />
                        </div>
                        {openFolders[folder.id] && (
                            <div className="p-4 md:p-6 flex flex-col gap-3 border-t border-white/5">
                                {items.length === 0 ? <p className="text-sm text-white/40 text-center py-4">Empty folder</p> : items.map((item, index) => renderRow(item, index))}
                            </div>
                        )}
                    </div>
                ))}
                {uncategorizedItems.map((item, index) => renderRow(item, index))}
            </div>
        );
    };

    const renderRow = (item, index) => (
        <div key={item.id} className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-red-500/30 p-4 md:p-5 rounded-2xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 w-full">
                <div className="w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-red-400 font-bold shrink-0 border border-white/5">{index + 1}</div>
                <div className="overflow-hidden">
                    <h4 className="text-white font-bold truncate text-sm md:text-base">{item.title}</h4>
                    <p className="text-xs text-white/50 font-medium flex items-center gap-1.5 mt-1"><CalendarDays size={12} className="text-red-400"/> {item.date ? new Date(item.date).toDateString() : 'No Date'}</p>
                </div>
            </div>
            
            <div className="w-full md:w-auto flex shrink-0 border-t border-white/5 md:border-0 pt-3 md:pt-0">
                {activeTab === 'live' && <a href={item.link} target="_blank" rel="noreferrer" className="w-full md:w-max bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-600/30"><Video size={18}/> Join Live</a>}
                {activeTab === 'recordings' && <button onClick={() => setPlayingVideo(item)} className="w-full md:w-max bg-white/10 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-transparent transition-all"><MonitorPlay size={18} className='text-red-400'/> Play Video</button>}
                {activeTab === 'documents' && <a href={`http://72.62.249.211:5000/documents/${item.fileName}`} target="_blank" rel="noreferrer" download className="w-full md:w-max bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 border border-white/10"><FileText size={18} className="text-yellow-400"/> Download PDF</a>}
                {activeTab === 'sPapers' && <a href={`http://72.62.249.211:5000/documents/${item.fileName}`} target="_blank" rel="noreferrer" className="w-full md:w-max bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 border border-white/10"><FileSignature size={18} className="text-blue-400"/> View Paper</a>}
            </div>
        </div>
    );

    return (
        <div className="w-full animate-fade-in">
            {/* IN-CONTAINER BACK BUTTON (Calls onBack instead of React Router navigate) */}
            <button onClick={onBack} className="mb-8 text-white/70 hover:text-red-400 bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl font-bold flex items-center border border-white/10 w-max transition-colors">
                <ArrowLeft size={16} className="mr-2" /> Back to Subjects
            </button>

            <div className="glass-card p-6 md:p-8 rounded-[2rem] mb-8 border border-white/10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">{data?.course?.name || 'Subject Name'}</h2>
            </div>

            <div className="flex overflow-x-auto gap-3 mb-8 pb-2 custom-scrollbar no-scrollbar scroll-smooth">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all border ${activeTab === tab.id ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}>
                        <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : 'text-white/40'}/> {tab.name} 
                        <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-black/30 text-white/60'}`}>{tab.data?.length || 0}</span>
                    </button>
                ))}
            </div>

            <div className="glass-card p-4 md:p-8 rounded-[2rem] min-h-[400px] border border-white/10">
                {data?.paidStatus !== 1 ? (
                    <div className="text-center py-20 px-4">
                        <Lock size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">Access Locked</h3>
                        <p className="text-white/60 mb-6 text-sm md:text-base">Your payment for this subject is pending or overdue.</p>
                    </div>
                ) : renderContentRows()}
            </div>

            {/* Video Player Modal */}
            {playingVideo && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-fade-in">
                    <div className="w-full max-w-5xl h-[40vh] sm:h-[80vh] bg-black rounded-2xl relative overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <div className="absolute top-0 left-0 w-full h-[55px] bg-[#000000] z-[50] shadow-xl flex items-center px-6">
                            <span className="text-white/80 font-bold text-sm uppercase tracking-widest flex items-center gap-3">
                                <MonitorPlay size={18} className="text-red-500"/> {playingVideo.title}
                            </span>
                        </div>
                        <button onClick={() => setPlayingVideo(null)} className="absolute top-3 right-4 z-[70] text-white bg-white/10 p-2 rounded-xl hover:bg-red-600 transition-colors"><X size={20}/></button>
                        <iframe src={getEmbedUrl(playingVideo.link)} className="w-full h-full border-none pt-[55px]" allowFullScreen title="Player"></iframe>
                    </div>
                </div>
            )}
        </div>
    );
}