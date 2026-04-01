import React, { useState, useEffect } from 'react';
import { LogOut, Sun, Moon } from 'lucide-react';

export default function Header({ loggedInUser, handleLogout, isDarkMode, toggleTheme }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const displayName = loggedInUser?.fName || 'System Admin';

  return (
    <div className="flex justify-between items-center bg-white/60 dark:bg-slate-400/10 border border-white/60 dark:border-slate-400/20 px-6 py-4 rounded-3xl backdrop-blur-md shadow-lg w-full transition-colors duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2 transition-colors duration-500">
          Hello, {displayName} <span className="text-3xl animate-bounce">👋</span>
        </h1>
        <p className="text-blue-600 dark:text-blue-300 text-sm mt-1 font-medium tracking-wide transition-colors duration-500">
          {dateString} <span className="text-slate-400 dark:text-white mx-1">|</span> <span className="text-slate-600 dark:text-gray-200">{timeString}</span>
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Dark/Light Mode Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className="p-3 bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-yellow-400 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-all shadow-sm border border-slate-300/50 dark:border-slate-600/50"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button 
          onClick={handleLogout} 
          className="px-6 py-2.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white border border-red-200 dark:border-red-500/30 rounded-xl font-bold transition-all shadow-sm dark:shadow-lg flex items-center gap-2"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}