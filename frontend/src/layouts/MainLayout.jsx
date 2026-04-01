import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ loggedInUser, handleLogout }) {
  // Theme එක LocalStorage එකෙන් ගන්නවා, නැත්නම් System theme එක බලනවා
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Theme එක මාරු වෙනකොට HTML tag එකට 'dark' class එක දානවා/අයින් කරනවා
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    // Background gradient changes smoothly based on theme
    <div className="min-h-screen transition-colors duration-500 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-blue-900 dark:via-slate-800 dark:to-red-900 flex items-center justify-center p-6 font-sans">
      
      {/* Glassmorphism Main Container */}
      <div className="w-full max-w-[100%] xl:max-w-[98%] h-[95vh] bg-white/40 dark:bg-slate-400/10 backdrop-blur-xl border border-white/60 dark:border-slate-400/20 rounded-3xl shadow-2xl flex overflow-hidden transition-colors duration-500">
        
        {/* Sidebar */}
        <Sidebar userRole={loggedInUser?.role} />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="p-6 pb-2 border-b border-slate-200/50 dark:border-white/5 transition-colors duration-500">
            <Header 
              loggedInUser={loggedInUser} 
              handleLogout={handleLogout} 
              isDarkMode={isDarkMode} 
              toggleTheme={toggleTheme} 
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <Outlet />
          </div>
        </div>

      </div>
    </div>
  );
}