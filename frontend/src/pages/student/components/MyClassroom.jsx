import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../../api/axios';
import { Loader2, BookOpen, Layers, ArrowLeft, ChevronRight, GraduationCap, Component, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import CourseView from './CourseView'; 

export default function MyClassroom() {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectionLevel, setSelectionLevel] = useState(0);
    const [selectedBusiness, setSelectedBusiness] = useState(null);
    const [selectedStream, setSelectedStream] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(null);
    
    const [openedCourseId, setOpenedCourseId] = useState(null);
    const [activeStream, setActiveStream] = useState('All');

    useEffect(() => {
        axios.get('/student/classroom')
            .then(res => setBusinesses(res.data?.businesses || []))
            .catch(() => toast.error("Failed to load data."))
            .finally(() => setLoading(false));
    }, []);

    const getImageUrl = (imageName) => imageName && imageName !== 'null' && imageName !== 'default.png' ? `http://72.62.249.211:5000/storage/icons/${imageName}` : '/logo.png';

    const getEnrolledStreams = (business) => {
        if (!business) return [];
        const streams = new Set();
        let hasCommon = false;
        business.batches?.forEach(b => {
            b.groups?.forEach(g => {
                g.courses?.forEach(c => {
                    if (c.stream) streams.add(c.stream);
                    else hasCommon = true;
                });
            });
        });
        const arr = Array.from(streams);
        if (hasCommon) arr.push("Common Subjects");
        return arr;
    };

    const getFilteredBatches = () => {
        if (!selectedBusiness || !selectedStream) return [];
        return selectedBusiness.batches.filter(b => {
            return b.groups.some(g => 
                g.courses.some(c => 
                    (c.stream === selectedStream) || (!c.stream && selectedStream === "Common Subjects")
                )
            );
        });
    };

    const getFilteredCourses = () => {
        if (!selectedBatch) return [];
        let allCourses = [];
        selectedBatch.groups?.forEach(g => g.courses?.forEach(c => allCourses.push({...c, groupName: g.name})));
        
        if (activeStream !== 'All') {
            allCourses = allCourses.filter(c => (c.stream === activeStream) || (!c.stream && activeStream === "Common Subjects"));
        }
        return allCourses;
    };

    const handleBack = () => {
        if (openedCourseId) {
            setOpenedCourseId(null);
            return;
        }
        if (selectionLevel > 0) {
            setSelectionLevel(prev => prev - 1);
            if (selectionLevel === 1) setSelectedBusiness(null);
            if (selectionLevel === 2) { setSelectedStream(null); setSelectedBatch(null); setActiveStream('All'); }
            if (selectionLevel === 3) { setSelectedBatch(null); setActiveStream('All'); }
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={40} /></div>;

    if (openedCourseId) {
        return <CourseView courseId={openedCourseId} onBack={handleBack} />;
    }

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <GraduationCap size={30} className="text-red-500"/>
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wider uppercase">My Classroom</h2>
                    <p className="text-white/60 mt-1 text-xs md:text-sm font-medium">Access your enrolled subjects and materials.</p>
                </div>
            </div>

            {selectionLevel > 0 && (
                <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                    <button onClick={handleBack} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-2.5 rounded-xl font-bold flex items-center w-max transition-colors">
                        <ArrowLeft size={16} className="mr-2" /> Back
                    </button>
                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-white/50 uppercase tracking-widest bg-black/20 border border-white/5 px-4 py-2.5 rounded-xl w-max">
                        <span className={selectionLevel >= 1 ? "text-red-400" : ""}>{selectedBusiness?.name}</span>
                        {selectionLevel >= 2 && <><ChevronRight size={12}/> <span className="text-red-400">{selectedStream}</span></>}
                        {selectionLevel >= 3 && <><ChevronRight size={12}/> <span className="text-red-400">{selectedBatch?.name}</span></>}
                    </div>
                </div>
            )}

            {selectionLevel === 0 && (
                <div className="glass-card rounded-[2rem] p-6 md:p-10 border-white/10">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-8 flex items-center gap-3"><BookOpen className="text-red-500"/> Select Institution</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {businesses.map(biz => (
                            <div key={biz.id} onClick={() => { setSelectedBusiness(biz); setSelectionLevel(1); }} className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 p-8 rounded-[2rem] flex flex-col items-center cursor-pointer transition-colors group">
                                <img src={getImageUrl(biz.logo)} className="w-24 h-24 object-contain mb-6" alt="" />
                                <h4 className="text-xl font-bold text-white text-center group-hover:text-red-400 transition-colors">{biz.name}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectionLevel === 1 && (
                <div className="glass-card rounded-[2rem] p-6 md:p-10 animate-fade-in border-white/10">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-8 flex items-center gap-3"><Component className="text-yellow-500"/> Enrolled Streams</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {getEnrolledStreams(selectedBusiness).map((stream, idx) => (
                            <div key={idx} onClick={() => { setSelectedStream(stream); setSelectionLevel(2); }} className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/50 p-6 md:p-8 rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 cursor-pointer transition-colors group">
                                <h4 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors uppercase tracking-widest text-center sm:text-left">{stream}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectionLevel === 2 && (
                <div className="glass-card rounded-[2rem] p-6 md:p-10 animate-fade-in border-white/10">
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-8 flex items-center gap-3"><Layers className="text-red-500"/> Enrolled Batches</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {getFilteredBatches().map(batch => (
                            <div key={batch.id} onClick={() => { setSelectedBatch(batch); setSelectionLevel(3); }} className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 p-6 md:p-8 rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 cursor-pointer transition-colors group">
                                <div className="w-20 h-20 bg-black/20 rounded-2xl p-4 border border-white/5">
                                    <img src={getImageUrl(batch.logo)} className="w-full h-full object-contain" alt="" />
                                </div>
                                <div className="text-center sm:text-left">
                                    <h4 className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">{batch.name}</h4>
                                    <p className="text-xs text-white/50 mt-2 font-medium bg-white/5 px-3 py-1 rounded-lg w-max mx-auto sm:mx-0">Click to view subjects</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectionLevel === 3 && (
                <div className="glass-card rounded-[2.5rem] p-6 md:p-10 animate-fade-in border-white/10">
                    <div className="mb-10">
                        <h4 className="text-sm font-bold text-white/50 mb-4 uppercase tracking-wider">Filter by Stream</h4>
                        <div className="flex flex-wrap gap-3">
                            {['All', ...Array.from(new Set(selectedBatch?.groups?.flatMap(g => g.courses?.map(c => c.stream).filter(Boolean))))].map(stream => (
                                <button key={stream} onClick={() => setActiveStream(stream)}
                                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${
                                        activeStream === stream 
                                        ? 'bg-red-600 text-white border border-red-500' 
                                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}>
                                    {stream}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* OPTIMIZED LIST RENDERING */}
                        {getFilteredCourses().map(course => (
                            <div key={course.id} onClick={() => setOpenedCourseId(course.id)} className="bg-black/30 hover:bg-black/50 border border-white/5 hover:border-red-500/40 p-5 md:p-6 rounded-2xl cursor-pointer transition-colors flex flex-col sm:flex-row justify-between items-center gap-4 group">
                                <div className="text-center sm:text-left">
                                    <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-red-400 transition-colors">{course.name}</h3>
                                    <div className="flex items-center gap-3 justify-center sm:justify-start mt-2">
                                        <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded font-bold uppercase">{course.groupName}</span>
                                        {course.code && <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 font-bold">{course.code}</span>}
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-red-500 flex items-center justify-center text-white/50 group-hover:text-white shrink-0 border border-white/10 group-hover:border-transparent transition-colors">
                                    <PlayCircle size={24} />
                                </div>
                            </div>
                        ))}
                        {getFilteredCourses().length === 0 && <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10"><p className="text-white/50 font-medium">No subjects found for this stream.</p></div>}
                    </div>
                </div>
            )}
        </div>
    );
}