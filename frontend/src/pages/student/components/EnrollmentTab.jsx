import React, { useState } from 'react';
import axios from '../../../api/axios';
import { UploadCloud, CreditCard, ChevronRight, Wallet, ArrowLeft, CheckCircle, Tag, CalendarClock, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const EnrollmentTab = ({ businesses, setActiveTab }) => {
  const [selectionLevel, setSelectionLevel] = useState(0);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(null); 

  const [activeStream, setActiveStream] = useState('All');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  
  const [showInstallmentPrompt, setShowInstallmentPrompt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [finalPaymentType, setFinalPaymentType] = useState(null); 
  const [availableInstallmentPlan, setAvailableInstallmentPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('slip'); 
  const [slipFile, setSlipFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getImageUrl = (imageName) => (!imageName || imageName === 'default.png' || imageName === 'null') ? '/logo.png' : `http://72.62.249.211:5000/storage/icons/${imageName}`;
  const parseStreams = (streamString) => streamString ? streamString.split(',').map(s => s.trim()).filter(s => s) : [];
  
  const getFilteredBatches = () => selectedBusiness?.batches || [];
  
  const getFilteredGroups = () => {
    if (!selectedBatch) return [];
    if (paymentPlan === 'monthly') return selectedBatch.groups.filter(g => g.type === 1).sort((a, b) => a.itemOrder - b.itemOrder);
    if (paymentPlan === 'full') return selectedBatch.groups.filter(g => g.type !== 1).sort((a, b) => a.itemOrder - b.itemOrder);
    return [];
  };

  const getFilteredCourses = () => {
    if (!selectedGroup || !selectedGroup.courses) return [];
    let courses = selectedGroup.courses;
    if (activeStream !== 'All') {
        courses = courses.filter(c => {
            let parsedStreams = [];
            try {
                if (c.streams && typeof c.streams === 'string') parsedStreams = JSON.parse(c.streams);
                else if (Array.isArray(c.streams)) parsedStreams = c.streams;
            } catch(e) {}
            if (parsedStreams && parsedStreams.length > 0 && parsedStreams.includes(activeStream)) return true;
            if (c.stream && c.stream.includes(activeStream)) return true;
            return false;
        });
    }
    return courses;
  };

  const getActiveDiscount = () => {
      if (!selectedGroup || !selectedGroup.discount_rules) return null;
      try {
          const rules = JSON.parse(selectedGroup.discount_rules);
          rules.sort((a, b) => b.courseCount - a.courseCount);
          for (let rule of rules) {
              if (selectedSubjects.length >= rule.courseCount) return { triggerCount: rule.courseCount, newPricePerCourse: rule.pricePerCourse };
          }
      } catch (e) {}
      return null;
  };

  const calculateTotal = () => {
    const courses = getFilteredCourses();
    if (!selectedGroup || !courses || selectedSubjects.length === 0) return 0;
    const activeDiscount = getActiveDiscount();
    if (activeDiscount) return selectedSubjects.length * activeDiscount.newPricePerCourse;
    return courses.filter(c => selectedSubjects.includes(c.id)).reduce((sum, course) => sum + Number(course.price || 0), 0);
  };

  const getOriginalTotal = () => getFilteredCourses().filter(c => selectedSubjects.includes(c.id)).reduce((sum, course) => sum + Number(course.price || 0), 0);

  const checkInstallmentEligibility = () => {
      if (paymentPlan !== 'full' || !selectedBatch.installment_plans_parsed) return null;
      const plans = selectedBatch.installment_plans_parsed;
      if(!plans || plans.length === 0) return null;
      let sortedPlans = [...plans].sort((a, b) => b.subjectCount - a.subjectCount);
      for (let plan of sortedPlans) {
          if (selectedSubjects.length >= plan.subjectCount) return plan;
      }
      return null;
  };

  const handleProceedToPay = () => {
      if (selectedSubjects.length === 0) return toast.error("Please select subjects first.");
      const eligiblePlan = checkInstallmentEligibility();
      if (eligiblePlan) {
          setAvailableInstallmentPlan(eligiblePlan);
          setShowInstallmentPrompt(true); 
      } else {
          setFinalPaymentType('pay_full');
          setShowPaymentModal(true); 
      }
  };

  const handleFinalSubmit = async () => {
    if (paymentMethod === 'slip' && !slipFile) return toast.error("Please upload your bank slip.");
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('businessId', selectedBusiness.id);
      formData.append('batchId', selectedBatch.id);
      formData.append('groupId', selectedGroup.id);
      formData.append('subjects', JSON.stringify(selectedSubjects));
      formData.append('paymentMethodChosen', finalPaymentType); 
      if (paymentMethod === 'slip') formData.append('slipImage', slipFile);

      const response = await axios.post('/student/enroll-with-slip', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if(response.status === 200) {
          toast.success("Enrollment successful! Awaiting verification.");
          setShowPaymentModal(false);
          setSlipFile(null);
          setActiveTab('history'); 
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Error submitting enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackNavigation = () => {
    if (selectionLevel > 0) {
      setSelectionLevel(prev => prev - 1);
      setFinalPaymentType(null);
      if (selectionLevel === 1) setSelectedBusiness(null);
      if (selectionLevel === 2) setSelectedBatch(null);
      if (selectionLevel === 3) { setPaymentPlan(null); setSelectedGroup(null); setSelectedSubjects([]); setActiveStream('All'); }
    }
  };

  const installmentStepsParsed = availableInstallmentPlan ? JSON.parse(availableInstallmentPlan.details) : [];
  const availableStreams = selectedBusiness ? ['All', ...parseStreams(selectedBusiness.streams)] : ['All'];

  return (
    <div className="w-full h-full relative text-white">
        <div className="w-full mx-auto pb-24 md:pt-4">
            
            {selectionLevel > 0 && (
                <div className="mb-6 relative z-20">
                    <button onClick={handleBackNavigation} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-xl font-bold flex items-center transition-colors w-max border border-white/10">
                        <ArrowLeft size={18} className="mr-2" /> Back
                    </button>
                </div>
            )}

            <div className="w-full">
                
                {/* LEVEL 0 */}
                {selectionLevel === 0 && (
                    <div className="space-y-8 w-full animate-fade-in">
                      <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-8 text-center uppercase tracking-wide">Select An Institute</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {businesses.map(business => (
                          <div key={business.id} onClick={() => { setSelectedBusiness(business); setSelectionLevel(1); }}
                            className="cursor-pointer rounded-[2rem] overflow-hidden glass-card hover:border-red-400/50 transition-colors w-full flex flex-col group">
                            <div className="h-48 w-full relative border-b border-white/10 p-6 bg-black/20 flex items-center justify-center">
                               <img src={getImageUrl(business.logo)} alt="" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="p-6 flex-1 flex items-center justify-center">
                              <h3 className="font-bold text-lg text-white text-center group-hover:text-red-400 transition-colors">{business.name}</h3>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                )}

                {/* LEVEL 1 */}
                {selectionLevel === 1 && (
                    <div className="space-y-8 w-full animate-fade-in">
                      <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-8 text-center uppercase tracking-wide">Select A Batch</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {getFilteredBatches().map(batch => (
                          <div key={batch.id} onClick={() => { setSelectedBatch(batch); setSelectionLevel(2); }}
                            className="cursor-pointer rounded-[2rem] glass-card hover:border-red-500/50 transition-colors flex flex-col sm:flex-row items-center p-4 md:p-6 group">
                            <div className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 bg-white/5 rounded-2xl p-4 flex justify-center items-center border border-white/10 w-full sm:w-auto">
                              <img src={getImageUrl(batch.logo || selectedBusiness.logo)} className="max-w-full max-h-full object-contain" alt="" />
                            </div>
                            <div className="p-6 flex-1 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                              <h4 className="font-bold text-white text-xl md:text-2xl group-hover:text-red-400 transition-colors">{batch.name}</h4>
                              {batch.duration && <p className="text-sm text-white/60 mt-2 flex items-center gap-1.5 font-medium"><CalendarClock size={16} className="text-red-500"/> {batch.duration} Months</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                )}

                {/* LEVEL 2 */}
                {selectionLevel === 2 && (
                    <div className="space-y-8 w-full max-w-5xl mx-auto animate-fade-in">
                      <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-8 text-center uppercase tracking-wide">Select Payment Plan</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div onClick={() => { setPaymentPlan('full'); setSelectionLevel(3); }} 
                             className={`cursor-pointer rounded-[2.5rem] p-10 md:p-14 text-center border transition-colors flex flex-col items-center justify-center ${paymentPlan === 'full' ? 'bg-red-600/20 border-red-500' : 'bg-black/20 border-white/10 hover:bg-black/40 hover:border-red-500/50'}`}>
                          <div className={`p-6 rounded-3xl mb-6 transition-colors ${paymentPlan === 'full' ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/50'}`}>
                            <Wallet size={56} strokeWidth={1.5} />
                          </div>
                          <h3 className="font-black text-2xl md:text-3xl text-white mb-3">One-Time Payment</h3>
                          <p className="text-base text-white/60 font-medium">Pay upfront and unlock bundle discounts.</p>
                        </div>
                        <div onClick={() => { setPaymentPlan('monthly'); setSelectionLevel(3); }} 
                             className={`cursor-pointer rounded-[2.5rem] p-10 md:p-14 text-center border transition-colors flex flex-col items-center justify-center ${paymentPlan === 'monthly' ? 'bg-red-600/20 border-red-500' : 'bg-black/20 border-white/10 hover:bg-black/40 hover:border-red-500/50'}`}>
                          <div className={`p-6 rounded-3xl mb-6 transition-colors ${paymentPlan === 'monthly' ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/50'}`}>
                            <CreditCard size={56} strokeWidth={1.5} />
                          </div>
                          <h3 className="font-black text-2xl md:text-3xl text-white mb-3">Monthly Payment</h3>
                          <p className="text-base text-white/60 font-medium">Pay your subject fees on a monthly basis.</p>
                        </div>
                      </div>
                    </div>
                )}

                {/* LEVEL 3 */}
                {selectionLevel === 3 && (
                    <div className="w-full pb-10 animate-fade-in">
                      
                      <div className="flex items-center space-x-4 mb-8 glass-card p-4 rounded-3xl w-max border-white/10">
                          <div className="w-14 h-14 rounded-2xl bg-white/10 text-red-500 flex items-center justify-center shrink-0 border border-white/10">
                            {paymentPlan === 'monthly' ? <CreditCard size={28} /> : <Wallet size={28} />}
                          </div>
                          <div className="pr-4">
                              <h2 className="text-xl font-extrabold text-white">{selectedBatch.name}</h2>
                              <p className="text-red-400 mt-1 text-xs font-bold uppercase tracking-widest">{paymentPlan === 'full' ? 'One-Time Plan' : 'Monthly Plan'}</p>
                          </div>
                      </div>

                      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                          
                          <div className="flex-1 glass-card rounded-[2.5rem] p-6 md:p-10 w-full border-white/10">
                            
                            <div className="mb-8">
                                <h4 className="text-sm font-bold text-white/50 mb-4 uppercase tracking-wider">Select Stream</h4>
                                <div className="flex flex-wrap gap-3">
                                    {availableStreams.map(stream => (
                                        <button key={stream} onClick={() => { setActiveStream(stream); setSelectedSubjects([]); }}
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

                            {paymentPlan === 'monthly' && (
                              <div className="mb-8">
                                <h4 className="text-sm font-bold text-white/50 mb-4 uppercase tracking-wider">Select Month</h4>
                                <div className="flex flex-wrap gap-3">
                                  {getFilteredGroups().map(group => (
                                    <button key={group.id} onClick={() => { setSelectedGroup(group); setSelectedSubjects([]); setFinalPaymentType(null); }}
                                      className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${
                                        selectedGroup?.id === group.id 
                                        ? 'bg-red-600 text-white border border-red-500' 
                                        : 'bg-black/30 border border-white/10 text-white/60 hover:bg-black/50 hover:text-white'
                                      }`}>
                                      {group.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {paymentPlan === 'full' && getFilteredGroups().length > 0 && !selectedGroup && setSelectedGroup(getFilteredGroups()[0])}

                            {selectedGroup && (
                              <div className="space-y-4">
                                 <h4 className="text-sm font-bold text-white/50 mb-4 uppercase tracking-wider">Choose Subjects</h4>
                                 
                                 {/* OPTIMIZED LIST RENDERING (No heavy transitions) */}
                                 <div className="flex flex-col gap-4">
                                    {getFilteredCourses().map(course => (
                                      <label key={course.id} className={`flex items-center p-5 md:p-6 rounded-2xl cursor-pointer border transition-colors ${
                                          selectedSubjects.includes(course.id) ? 'bg-red-600/10 border-red-500' : 'bg-black/20 border-white/10 hover:border-white/30'
                                        }`}>
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <input type="checkbox" className="w-6 h-6 rounded-lg border-2 border-white/30 bg-black/50 text-red-600 focus:ring-red-600 cursor-pointer appearance-none checked:bg-red-600 checked:border-transparent"
                                            checked={selectedSubjects.includes(course.id)} 
                                            onChange={() => setSelectedSubjects(prev => prev.includes(course.id) ? prev.filter(id => id !== course.id) : [...prev, course.id])} 
                                            />
                                            {selectedSubjects.includes(course.id) && <CheckCircle size={16} className="absolute text-white pointer-events-none" strokeWidth={3}/>}
                                        </div>
                                        
                                        <div className="ml-5 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                          <div>
                                              <span className="block font-bold text-white text-lg md:text-xl mb-1">{course.name}</span>
                                              {course.code && <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 font-bold uppercase tracking-widest">{course.code}</span>}
                                          </div>
                                          <div className="flex flex-col md:items-end bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                              {getActiveDiscount() && selectedSubjects.includes(course.id) ? (
                                                  <>
                                                      <span className="text-white/40 line-through text-xs font-medium mb-0.5">LKR {course.price}</span>
                                                      <span className="text-yellow-400 font-black text-lg md:text-xl flex items-center gap-1.5"><Tag size={14}/> LKR {getActiveDiscount().newPricePerCourse}</span>
                                                  </>
                                              ) : (
                                                  <span className="text-red-400 font-black text-lg md:text-xl">LKR {course.price}</span>
                                              )}
                                          </div>
                                        </div>
                                      </label>
                                    ))}
                                 </div>
                                 {getFilteredCourses().length === 0 && <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/10"><p className="text-white/50 font-medium">No subjects available for this selection.</p></div>}
                              </div>
                            )}
                          </div>

                          <div className="w-full lg:w-[380px] shrink-0 lg:sticky top-24">
                             <div className={`bg-black/20 border border-white/10 rounded-[2.5rem] p-8 transition-opacity duration-200 ${calculateTotal() > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <h4 className="text-lg font-extrabold text-white mb-6 uppercase tracking-widest border-b border-white/10 pb-4 flex items-center gap-3"><Wallet className="text-red-500"/> Order Summary</h4>
                                
                                <div className="space-y-4 text-sm text-white/70 mb-8 font-medium">
                                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span>Plan:</span> 
                                        <span className="font-bold text-white bg-white/10 px-3 py-1 rounded-lg">{paymentPlan === 'full' ? 'One-Time' : 'Monthly'}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <span>Subjects Selected:</span> 
                                        <span className="font-bold text-white bg-red-600 px-3 py-1 rounded-lg">{selectedSubjects.length}</span>
                                    </div>
                                </div>

                                {getActiveDiscount() && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6 text-center">
                                        <p className="text-yellow-400 font-bold text-sm flex items-center justify-center gap-2"><CheckCircle size={16}/> Bundle Discount Active</p>
                                        <p className="text-yellow-300/80 text-xs mt-1.5 uppercase font-bold tracking-widest">Saved LKR {getOriginalTotal() - calculateTotal()}</p>
                                    </div>
                                )}

                                 <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center mb-8">
                                    <span className="block text-xs text-white/50 uppercase font-bold tracking-widest mb-2">Total Payable</span>
                                    <span className="block text-4xl text-white font-black">LKR {calculateTotal().toFixed(2)}</span>
                                </div>

                                <button onClick={handleProceedToPay} className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black py-4 md:py-5 rounded-2xl flex justify-center items-center transition-colors text-sm uppercase tracking-widest border border-red-500/50">
                                    Proceed to Pay <ChevronRight className="ml-2" size={20}/>
                                </button>
                            </div>
                          </div>
                      </div>
                    </div>
                )}
            </div>
        </div>

        {/* MODALS */}
        {showInstallmentPrompt && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-black/80 border border-white/10 rounded-[2.5rem] p-6 md:p-10 max-w-lg w-full relative">
                    <button onClick={() => setShowInstallmentPrompt(false)} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2.5 rounded-xl"><X size={20}/></button>
                    <h2 className="text-2xl font-extrabold text-white mb-2">Payment Options</h2>
                    <p className="text-white/60 text-sm mb-8 font-medium">You can pay the full amount now or choose installments.</p>
                    
                    <div className="flex flex-col gap-4">
                        <button onClick={() => { setFinalPaymentType('pay_full'); setShowInstallmentPrompt(false); setShowPaymentModal(true); }} 
                                className="w-full bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/50 text-left p-6 rounded-[2rem] transition-colors group">
                            <span className="block text-xs text-white/40 mb-2 uppercase tracking-widest font-bold group-hover:text-red-400">Option 1</span>
                            <span className="block text-xl text-white font-extrabold mb-2">Pay Full Amount</span>
                            <span className="block text-3xl text-red-500 font-black">LKR {calculateTotal().toFixed(2)}</span>
                        </button>

                        <button onClick={() => { setFinalPaymentType('installment'); setShowInstallmentPrompt(false); setShowPaymentModal(true); }} 
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-left p-6 rounded-[2rem] transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <span className="block text-xs text-white/40 uppercase tracking-widest font-bold">Option 2</span>
                                <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-3 py-1 rounded-lg font-bold uppercase tracking-widest border border-yellow-500/30">Available</span>
                            </div>
                            <span className="block text-xl text-white font-extrabold mb-4">Pay via Installments</span>

                            <div className="bg-black/40 rounded-2xl p-4 mb-5 space-y-3 border border-white/5">
                                {installmentStepsParsed.map((step, idx) => (
                                    <div key={idx} className="flex justify-between text-sm font-medium text-white/70">
                                        <span>Installment {step.step}:</span>
                                        <span className="text-white font-bold bg-white/5 px-2 py-1 rounded-lg border border-white/10">LKR {step.amount}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-red-600 text-white font-extrabold py-4 rounded-2xl text-sm text-center">
                                Select & Pay LKR {installmentStepsParsed[0]?.amount} Today
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showPaymentModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-black/80 border border-white/10 rounded-[2.5rem] p-6 md:p-10 max-w-md w-full relative">
                    <button onClick={() => setShowPaymentModal(false)} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2.5 rounded-xl"><X size={20}/></button>
                    <h2 className="text-2xl font-extrabold text-white mb-2">Submit Payment</h2>
                    <p className="text-white/60 font-medium text-sm mb-8">Choose your preferred payment method.</p>
                    
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-5 text-center mb-8">
                        <span className="block text-xs text-white/50 uppercase font-bold tracking-widest mb-2">Amount to Pay Now</span>
                        <span className="block text-4xl text-red-500 font-black">LKR {finalPaymentType === 'installment' ? installmentStepsParsed[0]?.amount : calculateTotal().toFixed(2)}</span>
                    </div>

                    <div className="flex gap-3 bg-black/30 p-2 rounded-2xl border border-white/10 mb-8">
                        <button onClick={() => setPaymentMethod('slip')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${paymentMethod === 'slip' ? 'bg-white/20 text-white border border-white/10' : 'text-white/40 hover:text-white/80'}`}>Bank Slip</button>
                        <button onClick={() => setPaymentMethod('payhere')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${paymentMethod === 'payhere' ? 'bg-white/20 text-white border border-white/10' : 'text-white/40 hover:text-white/80'}`}>PayHere (Online)</button>
                    </div>

                    {paymentMethod === 'slip' ? (
                        <div className="border-2 border-dashed border-white/20 bg-white/5 rounded-[2rem] p-8 text-center hover:border-red-500/50 hover:bg-red-500/5 transition-colors cursor-pointer mb-8 group">
                            <input type="file" id="slip-upload" className="hidden" accept="image/*,.pdf" onChange={(e) => setSlipFile(e.target.files[0])} />
                            <label htmlFor="slip-upload" className="cursor-pointer flex flex-col items-center w-full">
                                <UploadCloud size={40} className="text-white/30 group-hover:text-red-500 mb-4 transition-colors" />
                                <span className="text-white font-bold text-base mb-2">{slipFile ? slipFile.name : 'Click to Upload Slip'}</span>
                                <span className="text-xs text-white/50 font-medium">Max: 10MB (PNG, JPG, PDF)</span>
                            </label>
                        </div>
                    ) : (
                        <div className="bg-white/10 rounded-[2rem] p-6 flex justify-center items-center h-32 mb-8 border border-white/20">
                            <span className="text-white font-black text-3xl tracking-wider">Pay<span className="text-blue-500">Here</span></span>
                        </div>
                    )}

                    <button onClick={handleFinalSubmit} disabled={isSubmitting} 
                        className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white font-black py-4 rounded-2xl transition-colors hover:from-red-500 hover:to-red-700 disabled:opacity-50 text-sm uppercase tracking-widest border border-red-500/50">
                        {isSubmitting ? 'Uploading...' : 'Confirm Enrollment'}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default EnrollmentTab;