import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Loader2, FolderOpen, Layers, BookOpen, Plus, Edit3, Trash2, ChevronRight, ChevronDown, X, ArrowLeft, GripVertical, CheckCircle, FolderPlus, Video, MonitorPlay, FileText, FileSignature, ExternalLink, Ban, Power, Building2, UserPlus, CreditCard, Send } from 'lucide-react';
import api from '../../api/axios';


export default function ContentHub() {
  const [loading, setLoading] = useState(true);

  // --- ROLE BASED ACCESS CONTROL (RBAC) ---
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = storedUser.role || 'Staff'; 

  const isSystemAdmin = userRole === 'System Admin' || userRole === 'Director';
  const isManager = userRole === 'Manager' || userRole === 'Ass Manager';
  const isStaff = userRole === 'Coordinator' || userRole === 'Staff';

  const canManageBusiness = isSystemAdmin;
  const canManageBatches = isSystemAdmin || isManager;
  const canManageGroupsAndSubjects = isSystemAdmin || isManager;
  const canManageContent = isSystemAdmin || isManager || isStaff;

  // --- Navigation States ---
  const [viewLevel, setViewLevel] = useState(isSystemAdmin ? 'businesses' : 'batches'); 
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batchTab, setBatchTab] = useState('subjects'); 
  const [activeSubject, setActiveSubject] = useState(null);
  const [contentTab, setContentTab] = useState('live'); 

  // --- Data States ---
  const [businesses, setBusinesses] = useState([]);
  const [managersList, setManagersList] = useState([]);
  const [batches, setBatches] = useState([]); 
  const [uniqueSubjects, setUniqueSubjects] = useState([]);
  const [lessonGroups, setLessonGroups] = useState([]); 
  const [subjectContents, setSubjectContents] = useState([]);

  // --- Modals State ---
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showLessonGroupModal, setShowLessonGroupModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false); // 🔥 NEW POST MODAL STATE 🔥
  
  const [previewData, setPreviewData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);
  
  // Custom Form States
  const [selectedGroupPrices, setSelectedGroupPrices] = useState({}); 
  const [discountRules, setDiscountRules] = useState([{ courseCount: '', pricePerCourse: '' }]); 
  const [contentType, setContentType] = useState('');
  const [prefilledFolder, setPrefilledFolder] = useState('');
  const [massAssignSubjects, setMassAssignSubjects] = useState([]);
  const [openFolders, setOpenFolders] = useState({});

  // 🔥 POST TARGET STATES 🔥
  const [postBizId, setPostBizId] = useState('all');
  const [postBatches, setPostBatches] = useState([]);

  useEffect(() => {
    if (postBizId === 'all' || !postBizId) {
        setPostBatches([]);
        return;
    }
    if (!isSystemAdmin) {
        setPostBatches(batches); // Managers ලට දැනටමත් Batches තියෙනවා
        return;
    }
    // Admin ට අදාල Batches ටික ගේනවා
    api.get(`/admin/batches/${postBizId}`).then(res => {
        const fetched = res.data.batches || res.data || [];
        setPostBatches(Array.isArray(fetched) ? fetched : []);
    }).catch(e => console.error(e));
}, [postBizId, isSystemAdmin, batches]);

  // 🔥 INSTALLMENTS STATES 🔥
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [existingInstallments, setExistingInstallments] = useState([]);
  const [editInstallmentId, setEditInstallmentId] = useState(null);
  const [installmentSubjectCount, setInstallmentSubjectCount] = useState('');
  const [installmentSteps, setInstallmentSteps] = useState([{ step: 1, amount: '', gapDays: '0' }]);

  // ==========================================
  // HELPER FUNCTIONS FOR STATES
  // ==========================================
  const toggleFolder = (folderId) => setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  const addDiscountRule = () => setDiscountRules([...discountRules, { courseCount: '', pricePerCourse: '' }]);
  const removeDiscountRule = (index) => setDiscountRules(discountRules.filter((_, i) => i !== index));
  const handleDiscountRuleChange = (index, field, value) => { const newRules = [...discountRules]; newRules[index][field] = value; setDiscountRules(newRules); };
  
  const addInstallmentStep = () => setInstallmentSteps([...installmentSteps, { step: installmentSteps.length + 1, amount: '', gapDays: '30' }]);
  const removeInstallmentStep = (idx) => {
      const newSteps = installmentSteps.filter((_, i) => i !== idx);
      setInstallmentSteps(newSteps.map((s, i) => ({...s, step: i + 1})));
  };

  const toggleGroupPrice = (groupId) => {
      setSelectedGroupPrices(prev => {
          if (prev[groupId] !== undefined) {
              const newPrices = { ...prev };
              delete newPrices[groupId];
              return newPrices;
          }
          return { ...prev, [groupId]: '' };
      });
  };
  const setGroupPrice = (groupId, price) => setSelectedGroupPrices(prev => ({...prev, [groupId]: price}));
  const toggleMassAssignSubject = (subId) => setMassAssignSubjects(prev => prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]);

  // ==========================================
  // DATA FETCHING 
  // ==========================================
  const extractArray = (resData) => {
      if (!resData) return [];
      if (Array.isArray(resData)) return resData;
      if (Array.isArray(resData.data)) return resData.data;
      if (Array.isArray(resData.businesses)) return resData.businesses;
      if (Array.isArray(resData.staff)) return resData.staff;
      return [];
  };

  const fetchInitialData = async () => {
      setLoading(true);
      try {
          if(isSystemAdmin) {
              try {
                  const mgrRes = await api.get('/admin/staff');
                  setManagersList(extractArray(mgrRes.data).filter(s => s.role && s.role.includes('Manager')));
              } catch (err) {}
              try {
                  const bizRes = await api.get('/admin/businesses'); 
                  setBusinesses(extractArray(bizRes.data));
              } catch (err) {}
          } else {
              const overviewRes = await api.get('/admin/manager/overview');
              if (overviewRes.data && overviewRes.data.business) setActiveBusiness(overviewRes.data.business);
              const batchRes = await api.get('/admin/manager/batches-full');
              setBatches(extractArray(batchRes.data));
          }
      } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const refreshBatches = async (bizId) => {
      try {
          const res = await api.get(isSystemAdmin ? `/admin/batches/${bizId}` : '/admin/manager/batches-full');
          const fetchedBatches = extractArray(isSystemAdmin ? res.data.batches : res.data);
          setBatches(fetchedBatches);
          if (activeBatch) {
              const updatedBatch = fetchedBatches.find(b => b.id.toString() === activeBatch.id.toString());
              if (updatedBatch) { setActiveBatch(updatedBatch); extractUniqueSubjects(updatedBatch); }
          }
      } catch(e) { console.error(e); }
  };

  const extractUniqueSubjects = (batch) => {
      const subs = [];
      batch?.groups?.forEach(g => {
          g.courses?.forEach(c => {
              const existing = subs.find(s => s.name === c.name);
              if(!existing) { subs.push({...c, groupPrices: [{ groupId: g.id, groupName: g.name, groupType: g.type, price: c.price }] }); } 
              else { existing.groupPrices.push({ groupId: g.id, groupName: g.name, groupType: g.type, price: c.price }); }
          });
      });
      setUniqueSubjects(subs.sort((a,b) => a.itemOrder - b.itemOrder));
  };

  const fetchContents = async (subject, batch) => {
      try {
          const safeCode = subject.code || `SUB_${subject.id}`;
          const res = await api.get(`/admin/manager/get-contents?batchId=${batch.id}&courseCode=${safeCode}&courseId=${subject.id}`);
          
          setLessonGroups(res.data?.lessonGroups || []);
          setSubjectContents(res.data?.contents || []);
          const newOpenState = {};
          (res.data?.lessonGroups || []).forEach(f => newOpenState[f.id] = true);
          setOpenFolders(newOpenState);
      } catch (e) { toast.error("Failed to load contents"); }
  };

  // ==========================================
  // NAVIGATION & UI HELPERS
  // ==========================================
  const handleBack = (level) => {
      setViewLevel(level);
      if(level === 'businesses') { setActiveBusiness(null); setActiveBatch(null); setActiveSubject(null); }
      if(level === 'batches') { setActiveBatch(null); setActiveSubject(null); }
      if(level === 'batch_details') { setActiveSubject(null); }
  };

  const openBusinessDetails = (biz) => { setActiveBusiness(biz); setViewLevel('batches'); refreshBatches(biz.id); };
  const openBatchDetails = (batch) => { setActiveBatch(batch); extractUniqueSubjects(batch); setViewLevel('batch_details'); setBatchTab('subjects'); };
  const openContentsView = async (subject) => { setActiveSubject(subject); setViewLevel('contents'); setLoading(true); await fetchContents(subject, activeBatch); setLoading(false); };

  const getImageUrl = (imageName) => imageName ? `http://72.62.249.211:5000/storage/icons/${imageName}` : '/logo.png';
  const getManagerName = (id) => { const m = managersList.find(m => m.id.toString() === id?.toString()); return m ? `${m.fName} ${m.lName}` : 'Not Assigned'; };
  const getBatchStreams = () => { try { return activeBusiness?.streams ? activeBusiness.streams.split(',').map(s=>s.trim()) : []; } catch(e) { return []; } };

  const groupedSubjects = uniqueSubjects.reduce((acc, sub) => {
      if (activeBusiness?.category === 'Advance Level' || activeBusiness?.category === 'AL') {
          const subStreams = (sub.streams && sub.streams.length > 0) ? sub.streams : (sub.stream ? [sub.stream] : ['Common Subjects']);
          subStreams.forEach(st => {
              if(!acc[st]) acc[st] = [];
              if(!acc[st].find(s => s.id === sub.id)) acc[st].push(sub);
          });
      } else {
          if(!acc['All Subjects']) acc['All Subjects'] = [];
          acc['All Subjects'].push(sub);
      }
      return acc;
  }, {});

  const getTypeInt = (tabStr) => {
      switch(tabStr) { case 'live': return 1; case 'recording': return 2; case 'document': return 3; case 'sPaper': return 4; case 'paper': return 5; default: return 1; }
  };
  const getEmbedUrl = (url) => {
      if (!url) return '';
      if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
      if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
      if (url.includes('drive.google.com') && url.includes('/view')) return url.replace('/view', '/preview');
      return url; 
  };
  const isMatchedType = (item) => {
      const itemType = item.type ?? item.content_type ?? item.contentType;
      return itemType !== null && (parseInt(itemType) === getTypeInt(contentTab) || itemType.toString() === contentTab);
  };
  const getFolderId = (item) => { const fId = item.content_group_id ?? item.contentGroupId ?? item.folder_id; return fId ? String(fId) : null; };

  // ==========================================
  // STATUS TOGGLES & DELETES
  // ==========================================
  const toggleBusinessStatus = async (biz) => {
      if(!window.confirm(`Are you sure you want to ${biz.status === 1 ? 'Disable' : 'Enable'} this Business?`)) return;
      try { await api.put('/course-setup/business/toggle-status', { business_id: biz.id, status: biz.status === 1 ? 0 : 1 }); toast.success("Business Updated!"); fetchInitialData(); } catch (e) { toast.error("Failed"); }
  };

  const toggleBatchStatus = async (batch) => {
      if(!window.confirm(`Are you sure you want to ${batch.status === 1 ? 'Disable' : 'Enable'} this Batch?`)) return;
      try { await api.put('/course-setup/batch/toggle-status', { batch_id: batch.id, status: batch.status === 1 ? 0 : 1 }); toast.success("Batch Updated!"); refreshBatches(activeBusiness.id); } catch (e) { toast.error("Failed"); }
  };

  const deleteItem = async (url, payload, successMsg) => {
      if(window.confirm("Are you sure you want to delete this item? This action might fail if students are already enrolled.")) {
          try { 
              await api.delete(url, { data: payload }); 
              toast.success(successMsg); 
              if(viewLevel==='businesses') fetchInitialData(); else refreshBatches(activeBusiness.id); 
              if(viewLevel==='contents') fetchContents(activeSubject, activeBatch);
          } catch(e) { 
              toast.error("Error: Cannot delete because it is being used elsewhere. Please Deactivate it instead."); 
          }
      }
  };

  // ==========================================
  // INSTALLMENTS CRUD 
  // ==========================================
  // ... (Installment Functions remain exactly the same)
  const openInstallmentModal = async () => {
      setInstallmentSubjectCount('');
      setInstallmentSteps([{step: 1, amount: '', gapDays: '0'}]);
      setEditInstallmentId(null);
      setShowInstallmentModal(true);
      try {
          const res = await api.get(`/course-setup/installment/${activeBatch.id}`);
          setExistingInstallments(res.data || []);
      } catch (e) { console.error("Error fetching installments", e); }
  };

  const handleEditInstallment = (plan) => {
      setEditInstallmentId(plan.id);
      setInstallmentSubjectCount(plan.subjectCount);
      setInstallmentSteps(typeof plan.details === 'string' ? JSON.parse(plan.details) : plan.details);
  };

  const handleDeleteInstallment = async (id) => {
      if(!window.confirm("Delete this installment plan?")) return;
      try {
          await api.delete('/course-setup/installment', { data: { plan_id: id } });
          toast.success("Installment Plan Deleted!");
          setExistingInstallments(existingInstallments.filter(i => i.id.toString() !== id.toString()));
          if(editInstallmentId === id) {
              setEditInstallmentId(null);
              setInstallmentSubjectCount('');
              setInstallmentSteps([{step: 1, amount: '', gapDays: '0'}]);
          }
      } catch (e) { toast.error("Delete failed"); }
  };

  const handleInstallmentSubmit = async (e) => {
      e.preventDefault();
      try {
          if (editInstallmentId) {
              await api.put('/course-setup/installment', { plan_id: editInstallmentId, subjectCount: installmentSubjectCount, installmentsData: installmentSteps });
              toast.success("Installment Plan Updated!");
          } else {
              await api.post('/course-setup/installment', { batch_id: activeBatch.id, subjectCount: installmentSubjectCount, installmentsData: installmentSteps });
              toast.success("Installment Setup Complete!");
          }
          const res = await api.get(`/course-setup/installment/${activeBatch.id}`);
          setExistingInstallments(res.data || []);
          setEditInstallmentId(null);
          setInstallmentSubjectCount('');
          setInstallmentSteps([{step: 1, amount: '', gapDays: '0'}]);
      } catch(e) { toast.error("Failed to setup installments"); }
  };

  // ==========================================
  // ADMIN POSTS SUBMISSION 🔥
  // ==========================================
  const handlePostSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      const formData = new FormData(e.target);
      
      try {
          // අපි අලුතින් හදපු Route එකට යවනවා
          await api.post('/admin/manager/post/create', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
          toast.success("Post Published & Notifications Sent Successfully!");
          setShowPostModal(false);
      } catch (err) {
          toast.error("Failed to publish post.");
      } finally {
          setLoading(false);
      }
  };

  const openPostModal = () => {
      setPostBizId(isSystemAdmin ? 'all' : (activeBusiness?.id || 'all'));
      setShowPostModal(true);
  };

  // ==========================================
  // OTHER FORM SUBMISSIONS
  // ==========================================
  const handleBusinessSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      if(formData.get('category') === 'Advance Level' || formData.get('category') === 'AL') {
          const streams = [];
          ['Art', 'Commerce', 'Tech', 'Bio', 'Maths'].forEach(s => { if(formData.get(`stream_${s}`)) streams.push(s); });
          formData.append('streams', streams.join(','));
      }
      formData.append('isDiscountEnabledForInstallments', formData.get('isDiscountEnabledForInstallments') ? 1 : 0);

      try {
          if(editMode) { formData.append('businessId', editData.id); await api.put('/admin/business/update', formData); } 
          else { await api.post('/course-setup/business', formData); }
          toast.success(editMode ? "Business Updated!" : "Business Created!");
          setShowBusinessModal(false); fetchInitialData();
      } catch(e) { toast.error("Error saving business"); }
  };

  const handleAssignManagers = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
          await api.put(`/admin/businesses/${editData.id}/assign`, { head_manager_id: formData.get('head_manager'), ass_manager_id: formData.get('ass_manager') });
          toast.success("Managers Assigned!");
          setShowAssignModal(false); fetchInitialData();
      } catch(e) { toast.error("Assignment Failed"); }
  };

  const handleBatchSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      formData.append('business_id', activeBusiness.id);
      try {
          if(editMode) { formData.append('batch_id', editData.id); await api.put('/admin/batch/update', formData); } 
          else { await api.post('/course-setup/batch', formData); }
          toast.success(editMode ? "Batch Updated!" : "Batch Created!");
          setShowBatchModal(false); refreshBatches(activeBusiness.id);
      } catch(e) { toast.error("Error saving batch"); }
  };

  const handleGroupSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const pType = formData.get('paymentType');
      const cleanDiscountRules = discountRules.filter(rule => rule.courseCount !== '' && rule.pricePerCourse !== '').map(rule => ({ courseCount: parseInt(rule.courseCount, 10), pricePerCourse: parseFloat(rule.pricePerCourse) }));

      const payload = { 
          group_id: editData?.id, batch_id: activeBatch.id, name: formData.get('name'), paymentType: pType, itemOrder: formData.get('itemOrder'), 
          discountRules: pType === 'Full Payment' ? cleanDiscountRules : [] 
      };
      
      try {
          if(editMode) await api.put('/course-setup/group/update', payload); 
          else await api.post('/course-setup/group', payload);
          toast.success(editMode ? "Group Updated!" : "Group Created!");
          setShowGroupModal(false); refreshBatches(activeBusiness.id);
      } catch (error) { toast.error("Action Failed"); }
  };

  const handleCourseSubmit = async (e) => {
      e.preventDefault();
      const keys = Object.keys(selectedGroupPrices);
      if (keys.length === 0) return toast.error("Please tick at least one group and enter a price!");
      const formattedPrices = keys.map(k => ({ groupId: k, price: selectedGroupPrices[k] }));
      const formData = new FormData(e.target);
      const selectedStreams = formData.getAll('streams');

      const payload = { 
          course_id: editData?.id, name: formData.get('name'), code: formData.get('code'), 
          stream: selectedStreams.length > 0 ? selectedStreams[0] : null, streams: selectedStreams, 
          description: formData.get('description'), itemOrder: formData.get('itemOrder'), courseType: 1,
          groupPricing: JSON.stringify(formattedPrices), groupPrices: JSON.stringify(formattedPrices) 
      };
      
      try {
          if(editMode) { payload.price = formattedPrices[0].price; await api.put('/admin/course/update', payload); } 
          else { await api.post('/course-setup/subject', payload); }
          toast.success(editMode ? "Subject Updated!" : "Subject Created!");
          setShowCourseModal(false); refreshBatches(activeBusiness.id);
      } catch (error) { toast.error("Action Failed"); }
  };

  const handleLessonGroupSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const folderType = getTypeInt(contentTab); 
      const payload = { 
          contentGroupId: editData?.id, title: formData.get('title'), type: folderType, order: formData.get('order') || 1, 
          batch_id: activeBatch.id, course_code: activeSubject.code || `SUB_${activeSubject.id}`
      };

      try {
          if(editMode) await api.put('/admin/content-group/update', payload); 
          else await api.post('/admin/manager/content-group/add', payload);
          toast.success(editMode ? "Folder Updated!" : "Folder Created!");
          setShowLessonGroupModal(false); fetchContents(activeSubject, activeBatch); 
      } catch (error) { toast.error(error.response?.data?.error || "Action Failed"); }
  };

  const handleMassAssignSubmit = async (e) => {
      e.preventDefault();
      if(!editMode && massAssignSubjects.length === 0) return toast.error("Please select at least one subject to assign this content!");
      const formData = new FormData(e.target);
      formData.append('type', contentType);
      if(!editMode) formData.append('selectedCourses', JSON.stringify(massAssignSubjects));
      if(editMode && editData?.id) formData.append('content_id', editData.id);

      try {
          if (editMode) await api.put('/admin/manager/contents/update', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
          else await api.post('/admin/manager/contents/mass-assign', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
          toast.success("Content Saved!");
          setShowContentModal(false); if(activeSubject) fetchContents(activeSubject, activeBatch); 
      } catch (error) { toast.error("Failed to process content"); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 size={50} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-4">
      
      {/* --- HEADER --- */}
      <div className="mb-8 bg-slate-800/30 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col gap-5 shadow-lg">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-400">
              {viewLevel !== 'businesses' && <button onClick={() => handleBack(viewLevel==='contents' ? 'batch_details' : viewLevel==='batch_details' ? 'batches' : 'businesses')} className="hover:text-blue-400 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl transition-colors"><ArrowLeft size={16}/> Back</button>}
              {isSystemAdmin && <button onClick={() => handleBack('businesses')} className={`hover:text-white transition-colors ${viewLevel==='businesses' ? 'text-white font-bold' : ''}`}>Businesses</button>}
              {(viewLevel === 'batches' || viewLevel === 'batch_details' || viewLevel === 'contents') && activeBusiness && (
                  <><ChevronRight size={16} className="text-slate-600"/> <button onClick={() => handleBack('batches')} className={`hover:text-white transition-colors truncate max-w-[150px] sm:max-w-none ${viewLevel==='batches' ? 'text-white font-bold' : ''}`}>{activeBusiness.name}</button></>
              )}
              {activeBatch && (viewLevel === 'batch_details' || viewLevel === 'contents') && (
                  <><ChevronRight size={16} className="text-slate-600"/> <button onClick={() => handleBack('batch_details')} className={`hover:text-white transition-colors truncate max-w-[150px] sm:max-w-none ${viewLevel==='batch_details' ? 'text-white font-bold' : ''}`}>{activeBatch.name}</button></>
              )}
              {activeSubject && viewLevel === 'contents' && (
                  <><ChevronRight size={16} className="text-slate-600"/> <span className="text-blue-400 font-bold px-3 py-1 bg-blue-500/10 rounded-lg truncate max-w-[150px] sm:max-w-none">{activeSubject.name}</span></>
              )}
          </div>

          <div className="flex flex-wrap justify-between items-center gap-6">
              <h2 className="text-3xl font-bold text-white flex items-center gap-4 tracking-tight truncate flex-1">
                  {viewLevel === 'businesses' && <><Building2 className="text-blue-500 shrink-0" size={32}/> Manage Businesses</>}
                  {viewLevel === 'batches' && <><Layers className="text-blue-500 shrink-0" size={32}/> <span className="truncate" title={activeBusiness?.name}>{activeBusiness?.name} - Batches</span></>}
                  {viewLevel === 'batch_details' && <><FolderOpen className="text-blue-500 shrink-0" size={32}/> <span className="truncate" title={activeBatch?.name}>{activeBatch?.name}</span></>}
                  {viewLevel === 'contents' && <><MonitorPlay className="text-green-500 shrink-0" size={32}/> <span className="truncate" title={activeSubject?.name}>{activeSubject?.name}</span></>}
              </h2>
              <div className="flex flex-wrap gap-4 shrink-0">
                  
                  {/* 🔥 POST CREATE BUTTON (Appears everywhere for Admins/Managers) 🔥 */}
                  {canManageContent && (
                      <button onClick={openPostModal} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg shadow-purple-500/20">
                          <Send size={20}/> Create Post
                      </button>
                  )}

                  {viewLevel === 'businesses' && canManageBusiness && (
                      <button onClick={() => { setEditMode(false); setShowBusinessModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg"><Plus size={20}/> New Business</button>
                  )}
                  {viewLevel === 'batches' && canManageBatches && (
                      <button onClick={() => { setEditMode(false); setShowBatchModal(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg"><Plus size={20}/> New Batch</button>
                  )}
                  {viewLevel === 'batch_details' && canManageGroupsAndSubjects && (
                      <>
                          <button onClick={openInstallmentModal} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg shadow-orange-500/20"><CreditCard size={20}/> Setup Installments</button>
                          {batchTab === 'groups' && <button onClick={() => { setEditMode(false); setShowGroupModal(true); setDiscountRules([{courseCount:'',pricePerCourse:''}]); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"><Plus size={20}/> New Group</button>}
                          {batchTab === 'subjects' && <button onClick={() => { setEditMode(false); setShowCourseModal(true); setSelectedGroupPrices({}); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"><Plus size={20}/> New Subject</button>}
                      </>
                  )}
                  {viewLevel === 'contents' && canManageContent && (
                      <>
                          <button onClick={() => { setShowLessonGroupModal(true); setEditMode(false); }} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors border border-white/10"><FolderPlus size={20}/> Add Folder</button>
                          <button onClick={() => { setShowContentModal(true); setContentType(''); setPrefilledFolder(''); setEditMode(false); }} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-2xl font-semibold text-base flex items-center gap-2 transition-colors shadow-lg shadow-green-500/20"><Plus size={20}/> Add Content</button>
                      </>
                  )}
              </div>
          </div>
      </div>

      {/* --- Rest of the UI remains the same (Lists, Folders, etc) --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 relative">
          {viewLevel === 'businesses' && isSystemAdmin && (
              businesses.length === 0 ? <p className="text-center text-slate-400 py-16 bg-slate-800/30 rounded-3xl border border-white/10 backdrop-blur-xl text-lg">No businesses created yet.</p> : 
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {businesses.map((biz) => (
                    <div key={biz.id} className="group bg-slate-800/40 hover:bg-slate-800/60 border border-white/10 p-6 rounded-3xl flex flex-col gap-6 transition-all backdrop-blur-xl shadow-lg">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center p-2 border border-white/5 group-hover:bg-white/20 transition-colors shrink-0">
                                <img src={getImageUrl(biz.logo)} onError={(e) => { e.target.src = '/logo.png'; }} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-2xl font-bold text-white mb-1 truncate" title={biz.name}>{biz.name}</h3>
                                <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg border border-blue-500/30">{biz.category}</span>
                            </div>
                        </div>
                        
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-slate-400">Head Manager:</span> <span className="text-white font-semibold truncate pl-2">{getManagerName(biz.head_manager_id)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Asst Manager:</span> <span className="text-white font-semibold truncate pl-2">{getManagerName(biz.ass_manager_id)}</span></div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-auto">
                            <button onClick={() => { setEditData(biz); setShowAssignModal(true); }} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors border border-white/5" title="Assign Managers"><UserPlus size={16}/></button>
                            <button onClick={() => { setEditData(biz); setEditMode(true); setShowBusinessModal(true); }} className="text-blue-400 bg-white/5 hover:bg-blue-500 hover:text-white p-3 rounded-xl transition-colors" title="Edit Business"><Edit3 size={20}/></button>
                            <button onClick={() => toggleBusinessStatus(biz)} className={`p-3 rounded-xl border transition-colors ${biz.status === 1 ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500 hover:text-white' : 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500 hover:text-white'}`} title="Toggle Status">
                                <Power size={20}/>
                            </button>
                            <button onClick={() => deleteItem('/admin/business/delete', { business_id: biz.id }, "Business Deleted")} className="text-red-400 bg-white/5 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors" title="Delete Business"><Trash2 size={20}/></button>
                        </div>
                        <button onClick={() => openBusinessDetails(biz)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-base font-bold flex justify-center items-center gap-2 transition-colors shadow-lg shadow-blue-500/20 mt-1">Manage Batches <ChevronRight size={18}/></button>
                    </div>
                ))}
              </div>
          )}

          {viewLevel === 'batches' && (
              batches.length === 0 ? <p className="text-center text-slate-400 py-16 bg-slate-800/30 rounded-3xl border border-white/10 backdrop-blur-xl text-lg">No batches available yet.</p> : 
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {batches.map((batch) => (
                    <div key={batch.id} className="group bg-slate-800/40 hover:bg-slate-800/60 border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 transition-all backdrop-blur-xl shadow-lg">
                        <div className="flex items-center gap-6 overflow-hidden w-full sm:w-auto">
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center p-3 border border-white/5 group-hover:bg-white/20 transition-colors shrink-0">
                                <img src={getImageUrl(batch.logo || activeBusiness?.logo)} onError={(e) => { e.target.src = '/logo.png'; }} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-xl font-bold text-white mb-1 truncate" title={batch.name}>{batch.name}</h3>
                                <p className="text-base text-blue-400 font-medium">{batch.groups?.length || 0} Groups Assigned</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 shrink-0">
                            {canManageBatches && (
                                <>
                                    <button onClick={() => toggleBatchStatus(batch)} className={`p-3 rounded-xl border transition-colors ${batch.status === 1 ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500 hover:text-white' : 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500 hover:text-white'}`}><Power size={20}/></button>
                                    <button onClick={() => { setEditData(batch); setEditMode(true); setShowBatchModal(true); }} className="text-blue-400 bg-white/5 hover:bg-blue-500 hover:text-white p-3 rounded-xl transition-colors"><Edit3 size={20}/></button>
                                    <button onClick={() => deleteItem('/admin/batch/delete', { batch_id: batch.id }, "Batch Deleted")} className="text-red-400 bg-white/5 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                </>
                            )}
                            <button onClick={() => openBatchDetails(batch)} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-base font-bold flex justify-center items-center gap-2 transition-colors ml-2 shadow-lg shadow-blue-500/20">Manage <ChevronRight size={18}/></button>
                        </div>
                    </div>
                ))}
              </div>
          )}

          {viewLevel === 'batch_details' && (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                  <div className="flex flex-wrap gap-3 mb-6 bg-slate-800/60 p-2.5 rounded-2xl w-max border border-white/10 shadow-lg">
                      <button onClick={() => setBatchTab('groups')} className={`px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition-all whitespace-nowrap ${batchTab === 'groups' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Layers size={20}/> Payment Groups</button>
                      <button onClick={() => setBatchTab('subjects')} className={`px-6 py-3 rounded-xl font-bold text-base flex items-center gap-2 transition-all whitespace-nowrap ${batchTab === 'subjects' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><BookOpen size={20}/> Subjects List</button>
                  </div>

                  <div className="space-y-6">
                      {batchTab === 'groups' && (
                          activeBatch?.groups?.length === 0 ? <p className="text-center text-slate-400 py-16 bg-slate-800/30 rounded-3xl border border-white/10 backdrop-blur-xl text-lg">No payment groups created yet.</p> :
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {activeBatch?.groups?.map((group) => (
                                <div key={group.id} className="bg-slate-800/40 border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col justify-between gap-5 transition-all backdrop-blur-xl hover:bg-slate-800/60 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                                    <div className="flex justify-between items-start">
                                        <div className="pl-4 overflow-hidden pr-4">
                                            <h3 className="text-xl font-bold text-white mb-2 truncate" title={group.name}>{group.name}</h3>
                                            <span className="text-sm font-semibold bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30">{group.type === 1 ? 'Monthly Payment' : 'Full Payment'}</span>
                                        </div>
                                        {canManageGroupsAndSubjects && (
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => { setEditData(group); setEditMode(true); setDiscountRules(group.discount_rules ? JSON.parse(group.discount_rules) : []); setShowGroupModal(true); }} className="text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white p-3 rounded-xl transition-colors"><Edit3 size={20}/></button>
                                                <button onClick={() => deleteItem('/admin/group/delete', { group_id: group.id }, "Group Deleted")} className="text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {group.type !== 1 && group.discount_rules && JSON.parse(group.discount_rules).length > 0 && (
                                        <div className="flex flex-wrap gap-3 pt-4 pl-4 border-t border-white/10">
                                            {JSON.parse(group.discount_rules).map((rule, ridx) => (
                                                <span key={ridx} className="text-sm font-medium bg-white/5 text-slate-300 px-4 py-2 rounded-xl border border-white/10">Buy {rule.courseCount} @ Rs {rule.pricePerCourse}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                          </div>
                      )}

                      {batchTab === 'subjects' && (
                          Object.keys(groupedSubjects).length === 0 ? <p className="text-center text-slate-400 py-16 bg-slate-800/30 rounded-3xl border border-white/10 backdrop-blur-xl text-lg">No subjects created yet.</p> : 
                          <div className="space-y-8">
                              {Object.keys(groupedSubjects).map((streamName, idx) => (
                                  <div key={idx} className="bg-slate-800/30 p-6 md:p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-lg">
                                      {(activeBusiness?.category === 'Advance Level' || activeBusiness?.category === 'AL') && (
                                          <h3 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-3 uppercase tracking-wide"><Layers size={24}/> {streamName} Stream</h3>
                                      )}
                                      <div className="grid grid-cols-1 gap-4">
                                          {groupedSubjects[streamName].map((sub) => (
                                              <div key={sub.id} className="bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 transition-colors overflow-hidden">
                                                  <div className="flex items-center gap-4 w-full xl:w-auto overflow-hidden">
                                                      {canManageGroupsAndSubjects && <div className="cursor-move text-slate-500 hover:text-white shrink-0"><GripVertical size={24}/></div>}
                                                      <div className="overflow-hidden">
                                                          <div className="flex items-center gap-3 mb-2">
                                                              <h3 className="text-lg font-bold text-white truncate max-w-[200px] md:max-w-[400px]" title={sub.name}>{sub.name}</h3>
                                                              {sub.code && <span className="text-sm font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-lg border border-white/10 shrink-0">{sub.code}</span>}
                                                          </div>
                                                          <div className="flex flex-wrap gap-2">
                                                              {sub.groupPrices.map((gp, i) => (
                                                                  <span key={i} className="text-sm font-medium text-blue-300 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 flex items-center gap-2 whitespace-nowrap">
                                                                      {gp.groupName}: <span className="text-white font-bold">Rs {gp.price}</span>
                                                                  </span>
                                                              ))}
                                                          </div>
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-3 items-center w-full xl:w-auto justify-end mt-2 xl:mt-0 shrink-0">
                                                      <button onClick={() => openContentsView(sub)} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl text-base font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-500/20"><MonitorPlay size={18}/> Manage Content</button>
                                                      {canManageGroupsAndSubjects && (
                                                          <>
                                                              <button onClick={() => { 
                                                                  setEditData(sub); setEditMode(true); 
                                                                  const gPrices = {}; sub.groupPrices.forEach(p => gPrices[p.groupId] = p.price); 
                                                                  setSelectedGroupPrices(gPrices); setShowCourseModal(true); 
                                                              }} className="text-blue-400 bg-white/5 hover:bg-blue-600 hover:text-white border border-white/5 p-3 rounded-xl transition-colors"><Edit3 size={20}/></button>
                                                              <button onClick={() => deleteItem('/admin/course/delete', { course_id: sub.id }, "Subject Deleted")} className="text-red-400 bg-white/5 hover:bg-red-600 hover:text-white border border-white/5 p-3 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                                          </>
                                                      )}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          )}

          {viewLevel === 'contents' && (
              <div className="bg-slate-800/40 border border-white/10 rounded-3xl flex flex-col min-h-[600px] overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="flex overflow-x-auto custom-scrollbar border-b border-white/10 bg-slate-900/50 p-4 gap-3">
                      {[ { id: 'live', label: 'Live Classes', icon: Video }, { id: 'recording', label: 'Recordings', icon: MonitorPlay },
                         { id: 'document', label: 'Documents', icon: FileText }, { id: 'sPaper', label: 'Structured', icon: FileSignature }, { id: 'paper', label: 'MCQs', icon: CheckCircle }
                      ].map(tab => (
                          <button key={tab.id} onClick={() => setContentTab(tab.id)} className={`flex items-center gap-3 px-6 py-3.5 rounded-xl text-base font-bold transition-all whitespace-nowrap ${contentTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}>
                              <tab.icon size={20}/> {tab.label}
                          </button>
                      ))}
                  </div>
                  
                  <div className="p-6 md:p-8 space-y-10 overflow-y-auto">
                      {lessonGroups.filter(isMatchedType).length > 0 && (
                          <div className="space-y-6">
                              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-2">Organized Folders</h4>
                              
                              {lessonGroups.filter(isMatchedType).map((folder) => (
                                  <div key={folder.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden transition-all">
                                      <div className="flex flex-wrap justify-between items-center cursor-pointer p-6 hover:bg-white/5 transition-colors gap-4" onClick={() => toggleFolder(folder.id)}>
                                          <div className="flex items-center gap-4">
                                              <div className={`p-2 rounded-xl transition-colors ${openFolders[folder.id] ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-slate-400'}`}>
                                                <FolderOpen size={24}/>
                                              </div>
                                              <h4 className={`text-lg font-bold transition-colors truncate max-w-[150px] md:max-w-[300px] ${openFolders[folder.id] ? 'text-white' : 'text-slate-300'}`} title={folder.title || folder.name}>{folder.title || folder.name}</h4>
                                              <ChevronDown size={20} className={`text-slate-500 transition-transform ${openFolders[folder.id] ? 'rotate-180 text-blue-400' : ''}`}/>
                                          </div>
                                          <div className="flex gap-2 items-center">
                                              {canManageContent && (
                                                  <>
                                                      <button onClick={(e) => { e.stopPropagation(); setContentType(contentTab); setPrefilledFolder(folder.id); setShowContentModal(true); setEditMode(false); }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md mr-2"><Plus size={16}/> Add Content</button>
                                                      <button onClick={(e) => { e.stopPropagation(); setEditData(folder); setEditMode(true); setShowLessonGroupModal(true); }} className="text-blue-400 hover:bg-blue-500 hover:text-white bg-blue-500/10 p-2.5 rounded-xl transition-colors"><Edit3 size={18}/></button>
                                                      <button onClick={(e) => { e.stopPropagation(); deleteItem('/admin/content-group/delete', { contentGroupId: folder.id }, "Folder Deleted"); }} className="text-red-400 hover:bg-red-500 hover:text-white bg-red-500/10 p-2.5 rounded-xl transition-colors"><Trash2 size={18}/></button>
                                                  </>
                                              )}
                                          </div>
                                      </div>
                                      
                                      {openFolders[folder.id] && (
                                        <div className="border-t border-white/5 bg-black/20 p-4">
                                            {subjectContents.filter(c => isMatchedType(c) && getFolderId(c) === String(folder.id)).map((content) => (
                                                <div key={content.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-2xl transition-colors gap-4">
                                                    <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
                                                        {canManageContent && <GripVertical size={20} className="text-slate-600 cursor-grab hover:text-white shrink-0"/>}
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-base font-bold text-slate-200 group-hover:text-white transition-colors truncate" title={content.title}>{content.title}</span>
                                                            <span className="text-sm font-medium text-blue-400 mt-1">{content.date ? content.date.split('T')[0] : 'No Date'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 mt-2 sm:mt-0">
                                                        <button onClick={() => setPreviewData(content)} className="bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">PREVIEW</button>
                                                        {canManageContent && (
                                                            <>
                                                                <button onClick={() => { setEditData(content); setEditMode(true); setShowContentModal(true); setContentType(contentTab); }} className="bg-white/5 text-blue-400 hover:bg-blue-500 hover:text-white p-2.5 rounded-xl transition-colors"><Edit3 size={18}/></button>
                                                                <button onClick={() => deleteItem('/admin/content/delete', { content_id: content.id }, "Content Deleted")} className="bg-white/5 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors"><Trash2 size={18}/></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {subjectContents.filter(c => isMatchedType(c) && getFolderId(c) === String(folder.id)).length === 0 && <p className="text-base text-slate-500 py-6 text-center font-medium">This folder is empty.</p>}
                                        </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}

                      <div className="mt-10">
                          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 pl-2">Uncategorized Items</h4>
                          <div className="bg-white/5 border border-white/10 rounded-3xl p-4">
                              {subjectContents.filter(c => isMatchedType(c) && !getFolderId(c)).map((content) => (
                                  <div key={content.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-2xl transition-colors gap-4">
                                      <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
                                          {canManageContent && <GripVertical size={20} className="text-slate-600 cursor-grab hover:text-white shrink-0"/>}
                                          <div className="flex flex-col overflow-hidden">
                                              <span className="text-base font-bold text-slate-200 group-hover:text-white transition-colors truncate" title={content.title}>{content.title}</span>
                                              <span className="text-sm font-medium text-blue-400 mt-1">{content.date ? content.date.split('T')[0] : 'No Date'}</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 mt-2 sm:mt-0">
                                          <button onClick={() => setPreviewData(content)} className="bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">PREVIEW</button>
                                          {canManageContent && (
                                              <>
                                                  <button onClick={() => { setEditData(content); setEditMode(true); setShowContentModal(true); setContentType(contentTab); }} className="bg-white/5 text-blue-400 hover:bg-blue-500 hover:text-white p-2.5 rounded-xl transition-colors"><Edit3 size={18}/></button>
                                                  <button onClick={() => deleteItem('/admin/content/delete', { content_id: content.id }, "Content Deleted")} className="bg-white/5 text-red-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-colors"><Trash2 size={18}/></button>
                                              </>
                                          )}
                                      </div>
                                  </div>
                              ))}
                              {subjectContents.filter(c => isMatchedType(c) && !getFolderId(c)).length === 0 && <p className="text-base text-slate-500 py-6 text-center font-medium">No uncategorized items.</p>}
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* --- MODALS --- */}
      {/* (Other existing modals like showBusinessModal, showBatchModal, showGroupModal, showCourseModal, showLessonGroupModal, showContentModal, previewData stay here unchanged) */}
      
      {/* 🔥 NEW POST MODAL 🔥 */}
      {showPostModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
            <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3"><Send className="text-purple-400"/> Create Announcement</h3>
                    <button onClick={() => setShowPostModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button>
                </div>
                <form onSubmit={handlePostSubmit} className="space-y-6">
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Post Title *</label>
                        <input type="text" name="title" required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-purple-500" />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Description *</label>
                        <textarea name="description" required rows="3" className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-purple-500"></textarea>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Image (Optional)</label>
                        <input type="file" name="image" accept="image/*" className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-purple-500/10 p-5 rounded-2xl border border-purple-500/20">
                        <div>
                            <label className="text-sm font-semibold text-purple-300 mb-2 block">Target Business</label>
                            <select name="businessId" value={postBizId} onChange={(e) => setPostBizId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none">
                                {isSystemAdmin ? (
                                    <>
                                        <option value="all">All Businesses (Global Post)</option>
                                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </>
                                ) : (
                                    <option value={activeBusiness?.id}>{activeBusiness?.name}</option>
                                )}
                            </select>
                        </div>
                        <div>
    <label className="text-sm font-semibold text-purple-300 mb-2 block">Target Batch</label>
    <select name="batchId" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none">
        <option value="all">All Batches</option>
        {postBatches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
        ))}
    </select>
</div>
                        <p className="text-xs text-purple-300/70 md:col-span-2">
                            * Posts targeted to "All" will reach all registered students, even if they haven't enrolled in a specific class yet.
                        </p>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4 flex justify-center items-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={24}/> : <><Send size={20}/> Publish Post & Send Push</>}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* OTHER EXISTING MODALS */}
      {previewData && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-2xl">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-3"><MonitorPlay size={24} className="text-blue-400"/> {previewData.title}</h3>
                      <div className="flex gap-3">
                          <a href={previewData.link || `http://72.62.249.211:5000/documents/${previewData.fileName}`} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
                              <ExternalLink size={18}/> Open External
                          </a>
                          <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500 border border-white/5 p-2.5 rounded-xl transition-colors"><X size={20}/></button>
                      </div>
                  </div>
                  <div className="flex-1 bg-black/40 p-4 relative flex items-center justify-center">
                      {previewData.fileName ? (
                          <iframe src={`http://72.62.249.211:5000/documents/${previewData.fileName}`} className="w-full h-full rounded-2xl bg-white" title="Document Preview" />
                      ) : previewData.link ? (
                          <iframe src={getEmbedUrl(previewData.link)} className="w-full h-full rounded-2xl bg-black border border-white/10" title="Video/Live Preview" allowFullScreen />
                      ) : (
                          <div className="text-center text-slate-500"><Ban size={48} className="mx-auto mb-4 opacity-50"/><p className="text-lg font-medium">No preview available.</p></div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showBusinessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white">{editMode ? 'Edit Business' : 'New Business'}</h3><button onClick={() => setShowBusinessModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                <form onSubmit={handleBusinessSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Business Name *</label><input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Logo *</label><input type="file" name="logo" required={!editMode} className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" /></div>
                        <div>
                            <label className="text-sm font-semibold text-slate-300 mb-2 block">Medium *</label>
                            <select name="medium" defaultValue={editData?.isEnglish ? 'English' : 'Sinhala'} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500">
                                <option value="Sinhala" className="bg-slate-800">Sinhala</option><option value="English" className="bg-slate-800">English</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-300 mb-2 block">Category *</label>
                            <select name="category" defaultValue={editData?.category || "Advance Level"} required onChange={(e) => { document.getElementById('streamsDiv').style.display = (e.target.value === 'Advance Level' || e.target.value === 'AL') ? 'block' : 'none'; }} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500">
                                <option value="Advance Level" className="bg-slate-800">Advance Level</option><option value="Ordinary Level" className="bg-slate-800">Ordinary Level</option><option value="Others" className="bg-slate-800">Others</option>
                            </select>
                        </div>
                        <div className="md:col-span-2"><label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label><textarea name="description" defaultValue={editData?.description} rows="2" className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500"></textarea></div>
                    </div>
                    <div id="streamsDiv" style={{display: (editData?.category === 'Advance Level' || editData?.category === 'AL' || !editData) ? 'block' : 'none'}} className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                        <label className="text-sm font-bold text-blue-300 mb-3 block">Select Streams</label>
                        <div className="flex flex-wrap gap-4">
                            {['Art', 'Commerce', 'Tech', 'Bio', 'Maths'].map(s => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer text-white font-medium bg-black/20 p-2 rounded-lg border border-white/10 hover:bg-white/10"><input type="checkbox" name={`stream_${s}`} value={s} defaultChecked={editData?.streams?.includes(s)} className="w-4 h-4"/> {s}</label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="mt-4">
                        <label className="flex items-center gap-3 cursor-pointer text-white font-medium bg-orange-500/10 p-4 rounded-xl border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                            <input type="checkbox" name="isDiscountEnabledForInstallments" value="1" defaultChecked={editData?.isDiscountEnabledForInstallments} className="w-5 h-5 accent-orange-500"/>
                            Allow Bundle Discounts even if student pays via Installments?
                        </label>
                        <p className="text-xs text-gray-400 mt-2 ml-2">If UNTICKED: Students choosing installments will NOT get the bundle discount.</p>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">{editMode ? 'Update Business' : 'Create Business'}</button>
                </form>
              </div>
          </div>
      )}

      {showAssignModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white">Assign Managers</h3><button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                <form onSubmit={handleAssignManagers} className="space-y-6">
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Head Manager</label>
                        <select name="head_manager" defaultValue={editData?.head_manager_id || ""} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500">
                            <option value="" className="bg-slate-800">-- Select Manager --</option>
                            {managersList.map(m => <option key={m.id} value={m.id} className="bg-slate-800">{m.fName} {m.lName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Assistant Manager</label>
                        <select name="ass_manager" defaultValue={editData?.ass_manager_id || ""} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500">
                            <option value="" className="bg-slate-800">-- Select Asst. Manager --</option>
                            {managersList.map(m => <option key={m.id} value={m.id} className="bg-slate-800">{m.fName} {m.lName}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">Assign Staff</button>
                </form>
              </div>
          </div>
      )}

      {showBatchModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white">{editMode ? 'Edit Batch' : 'New Batch'}</h3><button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                <form onSubmit={handleBatchSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Batch Name *</label><input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Logo Image</label><input type="file" name="logo" className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white" /></div>
                        <div>
                            <label className="text-sm font-semibold text-slate-300 mb-2 block">Batch Type *</label>
                            <select name="type" defaultValue={editData?.type || "1"} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500">
                                <option value="1" className="bg-slate-800">Theory only</option><option value="2" className="bg-slate-800">Paper only</option><option value="3" className="bg-slate-800">Theory and Paper</option><option value="4" className="bg-slate-800">Others</option>
                            </select>
                        </div>
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Display Order</label><input type="number" name="itemOrder" defaultValue={editData?.itemOrder || "1"} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div className="md:col-span-2"><label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label><textarea name="description" defaultValue={editData?.description} rows="2" className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500"></textarea></div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">{editMode ? 'Update Batch' : 'Create Batch'}</button>
                </form>
              </div>
          </div>
      )}

      {showGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white">{editMode ? 'Edit Payment Group' : 'New Payment Group'}</h3><button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                <form onSubmit={handleGroupSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Group Name *</label><input type="text" name="name" defaultValue={editData?.name} placeholder="e.g. 2026 Monthly Jan" required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Order Number</label><input type="number" name="itemOrder" defaultValue={editData?.itemOrder || "1"} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div className="md:col-span-2">
                            <label className="text-sm font-semibold text-slate-300 mb-2 block">Payment Type *</label>
                            <select name="paymentType" defaultValue={editData?.type === 1 ? "Monthly" : "Full Payment"} required onChange={(e) => { document.getElementById('discountRulesSection').style.display = e.target.value === 'Full Payment' ? 'block' : 'none'; }} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500 cursor-pointer">
                                <option value="Monthly" className="bg-slate-800">Monthly Payment</option><option value="Full Payment" className="bg-slate-800">Full Payment</option>
                            </select>
                        </div>
                    </div>
                    <div id="discountRulesSection" style={{display: (editData?.type === 2 || (!editMode && discountRules.length > 0)) ? 'block' : 'none'}} className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div><h4 className="text-lg font-bold text-blue-400">Bundle Discount Rules</h4></div>
                            <button type="button" onClick={addDiscountRule} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={18}/> Rule</button>
                        </div>
                        <div className="space-y-4">
                            {discountRules.map((rule, idx) => (
                                <div key={idx} className="flex gap-4 items-end bg-black/20 p-4 rounded-xl border border-white/10">
                                    <div className="flex-1"><label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wider">Subject Count:</label><input type="number" value={rule.courseCount} onChange={(e) => handleDiscountRuleChange(idx, 'courseCount', e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500" /></div>
                                    <div className="flex-1"><label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wider">Price/Subject:</label><input type="number" value={rule.pricePerCourse} onChange={(e) => handleDiscountRuleChange(idx, 'pricePerCourse', e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500" /></div>
                                    <button type="button" onClick={() => removeDiscountRule(idx)} className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">{editMode ? 'Update Group' : 'Create Group'}</button>
                </form>
              </div>
          </div>
      )}

      {showInstallmentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white flex items-center gap-3"><CreditCard className="text-orange-500"/> Setup Installments</h3><button onClick={() => setShowInstallmentModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                
                {existingInstallments.length > 0 && (
                    <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
                        <h4 className="text-sm font-bold text-orange-400 mb-3">Existing Installment Plans</h4>
                        <div className="space-y-3">
                            {existingInstallments.map(plan => (
                                <div key={plan.id} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                                    <div>
                                        <span className="font-bold text-white text-lg">Trigger: {plan.subjectCount} Subjects</span>
                                        <span className="text-sm text-slate-400 ml-3">({JSON.parse(plan.details).length} Steps)</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => handleEditInstallment(plan)} className="text-blue-400 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-colors"><Edit3 size={18}/></button>
                                        <button type="button" onClick={() => handleDeleteInstallment(plan.id)} className="text-red-400 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleInstallmentSubmit} className="space-y-6">
                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Trigger Subject Count * (e.g. 3)</label>
                        <input type="number" name="subjectCount" value={installmentSubjectCount} onChange={(e) => setInstallmentSubjectCount(e.target.value)} placeholder="Number of subjects needed to trigger installment" required className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-orange-500" />
                    </div>
                    
                    <div className="bg-orange-500/10 p-6 rounded-2xl border border-orange-500/20">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-bold text-orange-400">Installment Steps</h4>
                            <button type="button" onClick={addInstallmentStep} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus size={18}/> Add Step</button>
                        </div>
                        <div className="space-y-3">
                            {installmentSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-4 items-center bg-black/40 p-4 rounded-xl border border-white/10">
                                    <div className="font-bold text-slate-400 w-16">Step {step.step}:</div>
                                    <div className="flex-1">
                                        <label className="text-xs text-slate-400 mb-1 block">Amount (Rs) *</label>
                                        <input type="number" required value={step.amount} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].amount=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-orange-500" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs text-slate-400 mb-1 block" title="Gap from previous payment">Gap (Days) *</label>
                                        <input type="number" required value={step.gapDays} onChange={(e) => { const newSteps=[...installmentSteps]; newSteps[idx].gapDays=e.target.value; setInstallmentSteps(newSteps); }} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-orange-500" />
                                    </div>
                                    {installmentSteps.length > 1 && (
                                        <button type="button" onClick={() => removeInstallmentStep(idx)} className="mt-5 text-red-400 hover:bg-red-500 hover:text-white p-3 rounded-xl transition-colors"><Trash2 size={20}/></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">
                        {editInstallmentId ? 'Update Installment Plan' : 'Save Installment Plan'}
                    </button>
                </form>
              </div>
          </div>
      )}

      {showCourseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold text-white">{editMode ? 'Edit Subject' : 'New Subject'}</h3><button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5"><X size={20}/></button></div>
                <form onSubmit={handleCourseSubmit} className="space-y-6">
                    {(activeBusiness?.category === 'Advance Level' || activeBusiness?.category === 'AL') && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl mb-4">
                            <label className="text-sm font-semibold text-blue-300 mb-3 block">Select A/L Streams (Can select multiple) *</label>
                            <div className="flex flex-wrap gap-4">
                                {getBatchStreams().map(s => (
                                    <label key={s} className="flex items-center gap-2 cursor-pointer text-white font-medium bg-black/20 p-2 rounded-lg border border-white/10 hover:bg-white/10">
                                        <input type="checkbox" name="streams" value={s} defaultChecked={editData?.streams?.includes(s) || editData?.stream === s} className="w-4 h-4"/> {s}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Subject Name *</label><input type="text" name="name" defaultValue={editData?.name} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Subject Code (Optional)</label><input type="text" name="code" defaultValue={editData?.code} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" /></div>
                        <div className="md:col-span-2"><label className="text-sm font-semibold text-slate-300 mb-2 block">Description</label><textarea name="description" defaultValue={editData?.description} rows="2" className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500"></textarea></div>
                    </div>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mt-4">
                        <h4 className="text-lg font-bold text-slate-200 mb-6">Assign to Groups & Pricing *</h4>
                        <div className="space-y-4">
                            {activeBatch?.groups?.length === 0 ? <p className="text-red-400 text-sm font-medium bg-red-500/10 p-4 rounded-xl border border-red-500/20">Create Groups first!</p> : 
                            activeBatch?.groups?.map(g => (
                                <div key={g.id} className={`flex flex-col md:flex-row items-start md:items-center gap-5 p-5 rounded-2xl border transition-all ${selectedGroupPrices[g.id] !== undefined ? 'bg-blue-500/10 border-blue-500/40' : 'bg-black/20 border-white/5 hover:border-white/20'}`}>
                                    <label className="flex items-center gap-4 cursor-pointer min-w-[250px] group">
                                        <input type="checkbox" checked={selectedGroupPrices[g.id] !== undefined} onChange={() => toggleGroupPrice(g.id)} className="hidden" />
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${selectedGroupPrices[g.id] !== undefined ? 'bg-blue-500 border-blue-500' : 'border-slate-500 group-hover:border-slate-400'}`}>{selectedGroupPrices[g.id] !== undefined && <CheckCircle size={14} className="text-white"/>}</div>
                                        <span className="text-base font-bold text-slate-300 group-hover:text-white transition-colors">{g.name}</span>
                                    </label>
                                    {selectedGroupPrices[g.id] !== undefined && (
                                        <div className="flex-1 w-full flex items-center animate-in fade-in duration-200">
                                            <input type="number" required placeholder={`Price for ${g.type===1?'Monthly':'Full'}`} value={selectedGroupPrices[g.id]} onChange={(e) => setGroupPrice(g.id, e.target.value)} className="w-full bg-slate-900 border border-blue-500/50 rounded-xl p-3 text-white text-base font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">{editMode ? 'Update Subject' : 'Save Subject'}</button>
                </form>
              </div>
          </div>
      )}

      {showLessonGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl backdrop-blur-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FolderPlus className="text-blue-400" size={28}/> 
                        {editMode ? 'Edit Folder' : 'New Folder'}
                    </h3>
                    <button onClick={() => setShowLessonGroupModal(false)} className="text-slate-400 hover:text-white bg-white/5 p-2.5 rounded-xl border border-white/5">
                        <X size={20}/>
                    </button>
                </div>
                <form onSubmit={handleLessonGroupSubmit} className="space-y-6">
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Folder Name *</label>
                        <input type="text" name="title" defaultValue={editData?.title} required className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-300 mb-2 block">Display Order Number *</label>
                        <input type="number" name="order" required 
                            defaultValue={editData?.itemOrder || (lessonGroups.filter(g => parseInt(g.type) === getTypeInt(contentTab)).length + 1)} 
                            className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500" />
                        <p className="text-xs text-gray-400 mt-2">This number decides the arrangement order in the Student Dashboard.</p>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 text-lg rounded-2xl shadow-lg mt-4">
                        {editMode ? 'Update Folder' : 'Create Folder'}
                    </button>
                </form>
              </div>
          </div>
      )}

      {showContentModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 animate-in fade-in duration-200">
              <div className="bg-slate-800/90 border border-white/10 rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-2xl">
                  <div className="p-6 md:p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                      <h3 className="text-2xl font-bold text-white flex items-center gap-3"><Plus className="text-green-400" size={28}/> {editMode ? 'Edit Content' : 'Add Content'}</h3>
                      <button onClick={() => { setShowContentModal(false); setContentType(''); setPrefilledFolder(''); setMassAssignSubjects([]); }} className="text-slate-400 hover:text-white bg-white/5 border border-white/5 p-2.5 rounded-xl transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                      <form onSubmit={handleMassAssignSubmit} className="space-y-8 max-w-5xl mx-auto">
                          
                          <div className="flex flex-col md:flex-row gap-6">
                              <div className="flex-1">
                                  <label className="text-sm font-semibold text-slate-300 mb-2 block uppercase tracking-wider">Content Type *</label>
                                  <select value={contentType} onChange={e => setContentType(e.target.value)} disabled={editMode} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-green-500 disabled:opacity-50">
                                      <option value="" disabled className="bg-slate-800">Select Type</option>
                                      <option value="live" className="bg-slate-800">Live Class</option><option value="recording" className="bg-slate-800">Recording</option>
                                      <option value="document" className="bg-slate-800">Document / PDF</option><option value="sPaper" className="bg-slate-800">Structured Paper</option><option value="paper" className="bg-slate-800">MCQ Paper</option>
                                  </select>
                              </div>
                              
                              {contentType && (
                                  <div className="flex-1 animate-in fade-in duration-300">
                                      <label className="text-sm font-semibold text-slate-300 mb-2 block uppercase tracking-wider">Target Folder</label>
                                      <select name="contentGroupId" defaultValue={editMode ? (editData?.content_group_id || "") : prefilledFolder} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-green-500">
                                          <option value="" className="bg-slate-800">No Folder (Uncategorized)</option>
                                          {lessonGroups.filter(g => parseInt(g.type) === getTypeInt(contentType)).map(folder => (
                                              <option key={folder.id} value={folder.id} className="bg-slate-800">{folder.title || folder.name}</option>
                                          ))}
                                      </select>
                                  </div>
                              )}
                          </div>

                          {contentType && (
                              <>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/10">
                                      <div className="md:col-span-2">
                                          <label className="text-sm font-semibold text-slate-300 mb-2 block">Title *</label>
                                          <input type="text" name="title" defaultValue={editData?.title} required className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" />
                                      </div>
                                      
                                      {(contentType === 'live' || contentType === 'recording') && (
                                          <div className="md:col-span-2">
                                              <label className="text-sm font-semibold text-slate-300 mb-2 block">URL Link *</label>
                                              <input type="url" name="link" defaultValue={editData?.link} required className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" />
                                          </div>
                                      )}

                                      {contentType === 'recording' && (
                                          <div>
                                              <label className="text-sm font-semibold text-slate-300 mb-2 block">Meeting ID</label>
                                              <input type="text" name="zoomMeetingId" defaultValue={editData?.meetingId} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" />
                                          </div>
                                      )}

                                      {(contentType === 'document' || contentType === 'sPaper' || contentType === 'paper') && (
                                          <div className="md:col-span-2">
                                              <label className="text-sm font-semibold text-slate-300 mb-2 block">File Upload {editMode && <span className="text-green-400 font-normal ml-2">(Leave empty to keep existing)</span>}</label>
                                              <input type="file" name="file" required={!editMode} className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-slate-400 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:bg-white/10 file:text-white" />
                                          </div>
                                      )}

                                      <div>
                                          <label className="text-sm font-semibold text-slate-300 mb-2 block">Date</label>
                                          <input type={(contentType==='document'||contentType==='sPaper'||contentType==='paper') ? "month":"date"} name="date" defaultValue={editData?.date ? editData.date.split('T')[0] : ''} required className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" />
                                      </div>

                                      {contentType === 'live' && (
                                          <>
                                              <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Start Time</label><input type="time" name="startTime" defaultValue={editData?.startTime} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                              <div><label className="text-sm font-semibold text-slate-300 mb-2 block">End Time</label><input type="time" name="endTime" defaultValue={editData?.endTime} className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                          </>
                                      )}

                                      {contentType === 'paper' && (
                                          <>
                                              <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Time (Min) *</label><input type="number" name="paperTime" defaultValue={editData?.paperTime} required className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                              <div><label className="text-sm font-semibold text-slate-300 mb-2 block">Questions *</label><input type="number" name="questionCount" defaultValue={editData?.questionCount} required className="w-full bg-black/20 border border-white/10 focus:border-green-500 rounded-xl p-4 text-white outline-none" /></div>
                                          </>
                                      )}
                                      
                                      <div className="md:col-span-2 mt-4">
                                          <label className="flex items-center gap-4 cursor-pointer w-max group bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                              <div className="relative flex items-center justify-center">
                                                  <input type="checkbox" name="isFree" value="1" defaultChecked={editData?.isFree} className="peer w-6 h-6 appearance-none bg-black/40 border-2 border-slate-600 rounded-lg checked:bg-green-500 checked:border-green-500" />
                                                  <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                              </div>
                                              <span className="text-base font-bold text-slate-200 group-hover:text-white">Mark as Free Content (Open for all)</span>
                                          </label>
                                      </div>
                                  </div>

                                  {!editMode && (
                                      <div className="pt-6">
                                          <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-3"><BookOpen size={24} className="text-blue-500"/> Assign to Subjects</h4>
                                          <div className="bg-white/5 rounded-3xl p-6 md:p-8 border border-white/10 space-y-8">
                                              {activeBatch?.groups?.map((group, gIdx) => (
                                                  <div key={`g-assign-${gIdx}`}>
                                                      <h5 className="text-base font-bold text-blue-400 mb-4">{group.name} <span className="text-xs font-medium text-slate-400 bg-white/5 px-3 py-1 rounded-lg ml-2 border border-white/5">{group.type === 1 ? 'Monthly' : 'Full'}</span></h5>
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                          {uniqueSubjects.filter(s => s.groupPrices.some(gp => gp.groupId === group.id)).map((course, cIdx) => {
                                                              const realCourse = group.courses?.find(c => c.name === course.name);
                                                              if(!realCourse) return null;
                                                              return (
                                                                  <label key={`c-assign-${cIdx}`} className={`flex items-center gap-4 cursor-pointer p-4 rounded-2xl border transition-colors group ${massAssignSubjects.includes(realCourse.id) ? 'bg-blue-600/20 border-blue-500/50' : 'bg-black/20 border-white/10 hover:border-white/20'}`}>
                                                                      <div className="relative flex items-center justify-center shrink-0">
                                                                          <input type="checkbox" checked={massAssignSubjects.includes(realCourse.id)} onChange={() => toggleMassAssignSubject(realCourse.id)} className="peer w-6 h-6 appearance-none bg-black/40 border-2 border-slate-600 rounded-lg checked:bg-blue-500 checked:border-blue-500" />
                                                                          <CheckCircle size={16} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none"/>
                                                                      </div>
                                                                      <span className={`text-base font-bold truncate ${massAssignSubjects.includes(realCourse.id) ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{realCourse.name}</span>
                                                                  </label>
                                                              )
                                                          })}
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}

                                  <div className="pt-6 pb-4">
                                      <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-green-500/20 mt-4">
                                          {editMode ? 'Update Content' : 'Publish Content'}
                                      </button>
                                  </div>
                              </>
                          )}
                      </form>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}