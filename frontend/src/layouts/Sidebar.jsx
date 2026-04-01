import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, PieChart, CalendarDays, ListTodo, MonitorPlay, CreditCard, Bot, FileCheck2, BookOpen, MessageSquare, PhoneCall, Banknote } from 'lucide-react';

export default function Sidebar({ userRole }) {
  // Theme එකට ගැලපෙන විදිහට Active/Inactive styles හැදුවා
  const getNavLinkClass = ({ isActive }) => 
    isActive 
      ? "flex items-center gap-4 p-3.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 rounded-xl font-bold transition-all shadow-md dark:shadow-lg"
      : "flex items-center gap-4 p-3.5 hover:bg-slate-200/60 dark:hover:bg-slate-400/10 rounded-xl font-medium text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all border border-transparent";

  const isSystemAdmin = userRole === 'superadmin' || userRole === 'System Admin' || userRole === 'Director';
  const isManager = userRole === 'Manager' || userRole === 'Ass Manager';
  const isCoordinator = userRole === 'Coordinator' || userRole === 'Staff';
  const isFinance = userRole === 'Finance';
  const isStudent = userRole === 'user' || userRole === 'student';

  return (
    <div className="w-[280px] bg-white/40 dark:bg-slate-400/10 border-r border-slate-200/60 dark:border-slate-400/20 flex flex-col justify-between relative z-20 backdrop-blur-md transition-colors duration-500">
      <div>
        <div className="flex items-center justify-center pt-8 pb-8 w-full border-b border-slate-200/60 dark:border-slate-400/20 transition-colors duration-500">
          <img src="/logo.png" alt="Logo" className="w-32 h-auto object-contain drop-shadow-lg dark:drop-shadow-2xl" />
        </div>
        
        <nav className="flex flex-col gap-3 p-5 overflow-y-auto custom-scrollbar max-h-[80vh]">
          {isSystemAdmin && (
            <>
              <NavLink to="/admin/dashboard" className={getNavLinkClass}><LayoutDashboard size={20} /> System Overview</NavLink>
              <NavLink to="/admin/staff" className={getNavLinkClass}><Users size={20} /> Staff Management</NavLink>
              <NavLink to="/admin/content-hub" className={getNavLinkClass}><MonitorPlay size={20} /> Content Hub</NavLink>
            </>
          )}

          {isManager && (
             <>
               <NavLink to="/manager/dashboard" className={getNavLinkClass}><PieChart size={20} /> My Overview</NavLink>
               <NavLink to="/manager/timetable" className={getNavLinkClass}><CalendarDays size={20} /> Master Timetable</NavLink>
               <NavLink to="/manager/staff" className={getNavLinkClass}><Users size={20} /> My Team (Staff)</NavLink>
               <NavLink to="/manager/tasks" className={getNavLinkClass}><ListTodo size={20} /> Workflow & Tasks</NavLink>
               <NavLink to="/manager/payments" className={getNavLinkClass}><CreditCard size={20} /> Finance & Payments</NavLink>
               <NavLink to="/manager/content-hub" className={getNavLinkClass}><MonitorPlay size={20} /> Content Hub</NavLink>
               <NavLink to="/manager/crm" className={getNavLinkClass}><MessageSquare size={20} /> WhatsApp CRM</NavLink>
             </>
          )}

          {(isFinance || isSystemAdmin) && (
             <>
               {isSystemAdmin && <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mt-4 mb-1 pl-2">Finance Department</div>}
               
               {/* 🔥 අලුත් Payment Hub එක මෙතනට දැම්මා 🔥 */}
               <NavLink to="/admin/payments" className={getNavLinkClass}><Banknote size={20} /> Payment Hub</NavLink>
               
               <NavLink to="/admin/finance" className={getNavLinkClass}><Bot size={20} /> AI Finance Hub</NavLink>
               <NavLink to="/admin/finance/verify" className={getNavLinkClass}><FileCheck2 size={20} /> Slip Verification</NavLink>
             </>
          )}

          {isCoordinator && (
             <>
               <NavLink to="/coordinator/dashboard" className={getNavLinkClass}><LayoutDashboard size={20} /> My Overview</NavLink>
               <NavLink to="/coordinator/my-tasks" className={getNavLinkClass}><ListTodo size={20} /> My Tasks</NavLink>
               <NavLink to="/coordinator/content-hub" className={getNavLinkClass}><MonitorPlay size={20} /> Manage Content</NavLink>
               <NavLink to="/staff/crm" className={getNavLinkClass}><PhoneCall size={20} /> Call Campaign (CRM)</NavLink>
             </>
          )}

          {isStudent && (
             <>
               <NavLink to="/student/dashboard" className={getNavLinkClass}><LayoutDashboard size={20} /> My Dashboard</NavLink>
               <NavLink to="/student/classroom" className={getNavLinkClass}><BookOpen size={20} /> My Classroom</NavLink>
             </>
          )}
        </nav>
      </div>
    </div>
  );
}