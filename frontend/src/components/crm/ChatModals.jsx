import React from 'react';
import { X, LayoutTemplate } from 'lucide-react';

const ChatModals = (props) => {
    const { showSendTemplateModal, setShowSendTemplateModal, approvedTemplates, handleSendTemplateMessage } = props;

    return (
        <>
            {showSendTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 bg-slate-900">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                            <h3 className="font-bold text-sm flex items-center gap-2 text-white"><LayoutTemplate size={18} className="text-blue-400"/> Send Official Template</h3>
                            <button onClick={() => setShowSendTemplateModal(false)}><X size={18} className="text-slate-400 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                            {approvedTemplates.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No approved templates available.</p> : approvedTemplates.map(t => (
                                <div key={t.id} className="p-4 rounded-xl border border-white/5 bg-black/40 hover:bg-black/60 transition-colors">
                                    <h4 className="text-sm font-bold mb-1 text-blue-300">{t.name}</h4>
                                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">{t.components?.find(c => c.type === 'BODY')?.text || "Template Message"}</p>
                                    <button onClick={() => handleSendTemplateMessage(t)} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition uppercase tracking-wider">
                                        Send to Customer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatModals;