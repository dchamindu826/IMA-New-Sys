import React, { useState, useEffect } from 'react';
import axios from '../../../api/axios';
import { Loader2, CheckCircle, Clock, Wallet, CalendarDays, RefreshCw, AlertTriangle } from 'lucide-react';

export default function PaymentHistory() {
    const [payments, setPayments] = useState({ upcoming: [], completed: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 🔥 FIX: 404 Error එක එන නිසා path එක '/payments/my-payments' විදිහට හැදුවා 🔥
        // (ඔයාගේ Backend එකේ /api/payments කියලා තියෙනවා කියලා හිතලා)
        axios.get('/payments/my-payments')
            .then(res => {
                const all = res.data?.oldPayments || [];
                const upcomingList = [];
                const historyList = [];

                all.forEach(p => {
                    if (p.isInstallment && p.allInstallments) {
                        // 🚀 Installments වල හැම Step එකක්ම වෙන වෙනම කඩලා ගන්නවා 🚀
                        p.allInstallments.forEach(inst => {
                            const instData = {
                                ...p,
                                isInstStep: true,
                                stepAmount: inst.amount,
                                stepStatus: inst.status,
                                stepDueDate: inst.due_date,
                                stepNumber: inst.step,
                                instId: inst.id
                            };
                            
                            // 1 = Approved, -3 = Rejected
                            if (inst.status === 1 || inst.status === -3) {
                                historyList.push(instData);
                            } else {
                                // 0 = Pending/Unpaid, -1 = Verifying
                                upcomingList.push(instData);
                            }
                        });
                    } else {
                        // 🚀 සාමාන්‍ය Payments 🚀
                        if (p.status === 1 || p.status === -3) {
                            historyList.push(p);
                        } else {
                            upcomingList.push(p);
                        }
                    }
                });

                setPayments({ upcoming: upcomingList, completed: historyList });
            })
            .catch(err => {
                console.error("Payment Fetch Error:", err);
                // Error එකක් ආවොත් Fallback එකක් විදිහට student path එකත් try කරමු
                if(err.response?.status === 404) {
                    axios.get('/student/my-payments').then(res => {
                        // (Same logic here if the path was /student/my-payments)
                        window.location.reload(); // Quick fallback reload
                    }).catch(e => setLoading(false));
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (ds) => ds ? new Date(ds).toISOString().split('T')[0] : 'N/A';

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" size={40}/></div>;

    return (
        <div className="w-full max-w-6xl mx-auto animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <Wallet size={30} className="text-red-500"/>
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-wider uppercase">My Payments</h2>
                    <p className="text-white/60 mt-1 text-xs md:text-sm font-medium">Track your upcoming dues and payment history.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* UPCOMING & PENDING SECTION */}
                <div className="glass-card rounded-[2rem] p-6 md:p-8 border border-white/10 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Clock className="text-orange-400"/> Upcoming / Pending</h3>
                    <div className="space-y-4">
                        {payments.upcoming.length === 0 ? (
                            <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10">
                                <CheckCircle size={40} className="mx-auto text-emerald-500/50 mb-3"/>
                                <p className="text-white/50 font-bold">No pending payments.</p>
                            </div>
                        ) : payments.upcoming.map((p, idx) => {
                            let ds = p.isInstStep ? p.stepStatus : p.status;
                            let amt = p.isInstStep ? p.stepAmount : p.amount;
                            let isLate = p.isInstStep && p.stepDueDate ? new Date(p.stepDueDate) < new Date() : false;

                            return (
                                <div key={idx} className={`bg-black/30 border p-5 md:p-6 rounded-2xl flex flex-col relative overflow-hidden transition-all ${isLate ? 'border-red-500/50' : 'border-white/10'}`}>
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${ds === -1 ? 'bg-yellow-400' : 'bg-red-500'}`}></div>
                                    <div className="pl-3">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                            <h4 className="text-base md:text-lg font-bold text-white">{p.isInstStep ? `${p.courseName} (Bundle)` : p.courseName}</h4>
                                            {p.isInstStep && p.stepNumber && (
                                                <span className="text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-lg border border-orange-500/30 w-max shrink-0">
                                                    Phase {p.stepNumber}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p className={`text-xs mt-2 flex items-center gap-1.5 font-bold ${isLate ? 'text-red-400' : 'text-white/50'}`}>
                                            <CalendarDays size={14}/> 
                                            {p.isInstStep && p.stepDueDate ? `Due: ${formatDate(p.stepDueDate)}` : `Date Generated: ${formatDate(p.createdDate)}`}
                                            {isLate && <AlertTriangle size={14} className="ml-1"/>}
                                        </p>
                                        
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mt-4 pt-4 border-t border-white/10 gap-4">
                                            <div>
                                                <span className="text-xs font-bold text-white/40 block mb-1 uppercase tracking-widest">Amount Payable</span>
                                                <span className="text-xl md:text-3xl font-black text-white">LKR {parseFloat(amt).toFixed(2)}</span>
                                            </div>
                                            <div>
                                                {ds === -1 ? (
                                                    <span className="text-yellow-400 text-xs font-bold flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 px-4 py-2.5 rounded-xl">
                                                        <RefreshCw size={14} className="animate-spin"/> Verifying Slip
                                                    </span>
                                                ) : (
                                                    <button className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-red-500/20 transition-transform hover:scale-105">
                                                        Pay Due Amount
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* COMPLETED HISTORY SECTION */}
                <div className="glass-card rounded-[2rem] p-6 md:p-8 border border-white/10 shadow-2xl h-max">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><CheckCircle className="text-emerald-400"/> Payment History</h3>
                    <div className="space-y-4">
                        {payments.completed.length === 0 ? (
                            <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10">
                                <p className="text-white/50 font-bold">No history found.</p>
                            </div>
                        ) : payments.completed.map((p, idx) => {
                            let ds = p.isInstStep ? p.stepStatus : p.status;
                            let amt = p.isInstStep ? p.stepAmount : p.amount;

                            return (
                                <div key={idx} className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-5 rounded-2xl group">
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-1 group-hover:text-red-400 transition-colors">
                                                {p.isInstStep ? `${p.courseName} (Bundle)` : p.courseName}
                                            </h4>
                                            {p.isInstStep && p.stepNumber && (
                                                <span className="text-[9px] uppercase font-bold text-white/50 bg-black/40 px-2 py-0.5 rounded border border-white/10 mb-2 inline-block">
                                                    Phase {p.stepNumber}
                                                </span>
                                            )}
                                            <p className="text-[10px] text-white/40 font-medium flex items-center gap-1 mt-1"><CalendarDays size={10}/> {formatDate(p.createdDate)}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-black text-white/90 block mb-1">LKR {parseFloat(amt).toFixed(2)}</span>
                                            {ds === 1 ? (
                                                <span className="text-emerald-400 text-[10px] font-bold border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider inline-block">Approved</span>
                                            ) : (
                                                <span className="text-red-400 text-[10px] font-bold border border-red-400/30 bg-red-500/10 px-2 py-0.5 rounded uppercase tracking-wider inline-block">Rejected</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}