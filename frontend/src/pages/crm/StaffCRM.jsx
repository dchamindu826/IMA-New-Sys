import React from 'react';
// 🔥 Path එක ආයෙත් මේ විදිහට වෙනස් කරන්න 🔥
import UserInbox from '../../components/crm/UserInbox'; 

export default function StaffCRM({ loggedInUser }) {
    return (
        <div className="w-full text-slate-200 animate-in fade-in duration-500 h-full flex flex-col font-sans pb-4">
            <UserInbox isEmbedded={true} />
        </div>
    );
}