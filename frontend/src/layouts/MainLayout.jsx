import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function MainLayout({ loggedInUser, handleLogout }) {
  const [bgImage, setBgImage] = useState(() => {
    return localStorage.getItem('adminTheme') || '/adminglass.jpg';
  });

  useEffect(() => {
    localStorage.setItem('adminTheme', bgImage);
  }, [bgImage]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 md:p-6 font-sans overflow-hidden">
      
      {/* 🚀 Dynamic Background Image 🚀 */}
      <div className="absolute inset-0 z-0 fixed transition-all duration-1000 ease-in-out">
          <img src={bgImage} alt="Background" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[8px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[100%] xl:max-w-[98%] h-[95vh] bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex overflow-hidden transition-all duration-500">
        
        {/* Sidebar එකට props විදිහට ඔක්කොම යවනවා */}
        <Sidebar 
            userRole={loggedInUser?.role} 
            loggedInUser={loggedInUser} 
            handleLogout={handleLogout}
            currentBg={bgImage}
            setBgImage={setBgImage}
        />
        
        {/* Main Content Area (Header එක අයින් කරලා Full Height දුන්නා) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
            <Outlet />
          </div>
        </div>

      </div>
    </div>
  );
}