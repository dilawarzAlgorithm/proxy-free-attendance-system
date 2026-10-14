import React, { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import Login from './components/Login';
import PasswordReset from './components/PasswordReset';
import AdminPortal from './components/AdminPortal';
import ProfessorPortal from './components/ProfessorPortal';
import StudentPortal from './components/StudentPortal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  if (currentUser.requires_password_change) {
    return (
      <PasswordReset 
        user={currentUser} 
        onComplete={() => setCurrentUser({ ...currentUser, requires_password_change: false })} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block">TrustAttendance</span>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Portal</p>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 text-indigo-400 font-medium">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)} Dashboard
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-800">
          <div className="mb-4">
            <span className="block text-sm font-bold text-white truncate">{currentUser.name}</span>
            <span className="block text-xs text-slate-400 truncate">{currentUser.email}</span>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            <span className="font-bold text-white">TrustAttendance</span>
          </div>
          <button onClick={() => setCurrentUser(null)} className="p-2 text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            {currentUser.role === 'admin' && <AdminPortal user={currentUser} />}
            {currentUser.role === 'professor' && <ProfessorPortal user={currentUser} />}
            {currentUser.role === 'student' && <StudentPortal user={currentUser} />}
          </div>
        </div>
      </main>
    </div>
  );
}