import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
    LayoutDashboard, Users, PieChart, CalendarDays, ListTodo, MonitorPlay, 
    CreditCard, MessageSquare, PhoneCall, Banknote, BookOpen, LogOut, HeadphonesIcon 
} from 'lucide-react';

export default function Sidebar({ userRole, loggedInUser, handleLogout, currentBg, setBgImage }) {
  
  const displayName = loggedInUser?.fName || 'System Admin';
  const roleName = loggedInUser?.role || 'Admin';

  const themes = [
    { id: 1, file: '/adminglass.jpg', color: 'bg-blue-500' },
    { id: 2, file: '/bg1.jpg', color: 'bg-emerald-500' },
    { id: 3, file: '/bg2.jpg', color: 'bg-purple-500' },
    { id: 4, file: '/bg3.jpg', color: 'bg-orange-500' },
    { id: 5, file: '/bg4.jpg', color: 'bg-red-500' },
  ];

  const getNavLinkClass = ({ isActive }) => 
    isActive 
      ? "flex items-center gap-4 px-4 py-3.5 bg-gradient-to-r from-blue-600/20 to-blue-800/10 text-blue-300 border border-blue-500/30 rounded-2xl font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.15)] text-sm"
      : "flex items-center gap-4 px-4 py-3.5 hover:bg-white/5 rounded-2xl font-medium text-white/60 hover:text-white transition-all border border-transparent text-sm";

  const isSystemAdmin = userRole === 'superadmin' || userRole === 'System Admin' || userRole === 'Director';
  const isManager = userRole === 'Manager' || userRole === 'Ass Manager';
  const isCoordinator = userRole === 'Coordinator' || userRole === 'Staff';
  const isFinance = userRole === 'Finance';
  const isStudent = userRole === 'user' || userRole === 'student';

  return (
    <div className="w-[280px] bg-black/20 border-r border-white/10 flex flex-col justify-between relative z-20 backdrop-blur-md transition-all shrink-0 h-full">
      
      {/* 1. TOP LOGO SECTION */}
      <div className="flex items-center justify-center pt-8 pb-6 w-full shrink-0">
        <img src="/logo.png" alt="Logo" className="w-48 h-auto object-contain drop-shadow-2xl" />
      </div>

      {/* 2. USER PROFILE SECTION */}
      <div className="mx-4 mb-4 bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center shrink-0 shadow-inner">
        <h3 className="text-white font-bold text-base truncate w-full text-center tracking-wide">Hello, {displayName}</h3>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
            {roleName}
        </p>

        {/* Theme Changer */}
        <div className="flex items-center gap-2 mt-4 bg-black/40 p-1.5 rounded-full border border-white/5">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setBgImage(theme.file)}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${theme.color} ${currentBg === theme.file ? 'ring-2 ring-white scale-125' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
              title={`Theme ${theme.id}`}
            />
          ))}
        </div>
      </div>
        
      {/* 3. NAVIGATION MENU */}
      <nav className="flex-1 flex flex-col gap-1.5 px-4 overflow-y-auto custom-scrollbar pb-4">
        
        {isSystemAdmin && (
          <>
            <div className="text-[10px] uppercase font-black text-slate-500 mb-1 mt-2 pl-2 tracking-widest">Admin Control</div>
            <NavLink to="/admin/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} /> System Overview</NavLink>
            <NavLink to="/admin/staff" className={getNavLinkClass}><Users size={18} /> Staff Management</NavLink>
            <NavLink to="/admin/crm-setup" className={getNavLinkClass}><MessageSquare size={18} /> AI CRM Setup</NavLink>
            <NavLink to="/admin/student-manager" className={getNavLinkClass}><Users size={18} /> Student Database</NavLink>
            
            <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Academic & Operations</div>
            <NavLink to="/manager/timetable" className={getNavLinkClass}><CalendarDays size={18} /> Master Timetable</NavLink>
            <NavLink to="/manager/tasks" className={getNavLinkClass}><ListTodo size={18} /> Workflow & Tasks</NavLink>
            <NavLink to="/admin/content-hub" className={getNavLinkClass}><MonitorPlay size={18} /> Content Hub</NavLink>
            <NavLink to="/manager/crm" className={getNavLinkClass}><MessageSquare size={18} /> Manager CRM</NavLink>
            <NavLink to="/admin/coordinator-tasks" className={getNavLinkClass}><ListTodo size={18} /> Staff Tasks View</NavLink>
            <NavLink to="/admin/staff-crm" className={getNavLinkClass}><HeadphonesIcon size={18} /> Staff CRM (Agents)</NavLink>
            
            <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Finance Dept</div>
            <NavLink to="/admin/payments" className={getNavLinkClass}><Banknote size={18} /> Payment Hub</NavLink>
          </>
        )}

        {isManager && (
           <>
             <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Manager Tools</div>
             <NavLink to="/manager/dashboard" className={getNavLinkClass}><PieChart size={18} /> My Overview</NavLink>
             <NavLink to="/manager/timetable" className={getNavLinkClass}><CalendarDays size={18} /> Master Timetable</NavLink>
             <NavLink to="/manager/staff" className={getNavLinkClass}><Users size={18} /> My Team (Staff)</NavLink>
             <NavLink to="/manager/tasks" className={getNavLinkClass}><ListTodo size={18} /> Workflow & Tasks</NavLink>
             <NavLink to="/manager/payments" className={getNavLinkClass}><CreditCard size={18} /> Finance & Payments</NavLink>
             <NavLink to="/manager/content-hub" className={getNavLinkClass}><MonitorPlay size={18} /> Content Hub</NavLink>
             <NavLink to="/manager/crm" className={getNavLinkClass}><MessageSquare size={18} /> Manager CRM</NavLink>
           </>
        )}

        {(isFinance && !isSystemAdmin) && (
           <>
             <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Finance Dept</div>
             <NavLink to="/admin/payments" className={getNavLinkClass}><Banknote size={18} /> Payment Hub</NavLink>
           </>
        )}

        {isCoordinator && (
           <>
             <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Operations</div>
             <NavLink to="/coordinator/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} /> My Overview</NavLink>
             <NavLink to="/coordinator/my-tasks" className={getNavLinkClass}><ListTodo size={18} /> My Tasks</NavLink>
             <NavLink to="/coordinator/content-hub" className={getNavLinkClass}><MonitorPlay size={18} /> Manage Content</NavLink>
             {/* 🔥 STAFF CRM නම පැහැදිලිව වෙනස් කළා 🔥 */}
             <NavLink to="/staff/crm" className={getNavLinkClass}><HeadphonesIcon size={18} /> Staff CRM</NavLink>
           </>
        )}

        {isStudent && (
           <>
             <div className="text-[10px] uppercase font-black text-slate-500 mt-3 mb-1 pl-2 tracking-widest">Student Portal</div>
             <NavLink to="/student/dashboard" className={getNavLinkClass}><LayoutDashboard size={18} /> My Dashboard</NavLink>
             <NavLink to="/student/classroom" className={getNavLinkClass}><BookOpen size={18} /> My Classroom</NavLink>
           </>
        )}
      </nav>

      {/* 4. LOGOUT BUTTON (Bottom fixed) */}
      <div className="p-4 border-t border-white/10 shrink-0 bg-black/20">
        <button 
          onClick={handleLogout} 
          className="w-full py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-red-500 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>

    </div>
  );
}