import React, { useState } from 'react';
import { KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function PasswordReset({ user, onComplete }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await api.post('/auth/change-password', {
        user_id: user.id,
        new_password: newPassword
      });
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-2xl w-full max-w-md">
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <KeyRound className="w-8 h-8 text-amber-500" />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Action Required</h1>
          <p className="text-slate-400 text-sm mt-2">Please set a new secure password before accessing the portal.</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center flex flex-col items-center">
            <CheckCircle2 className="w-10 h-10 mb-3" />
            <span className="font-bold">Password Updated</span>
            <span className="text-sm mt-1 text-emerald-400/80">Redirecting to dashboard...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">New Password</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)}
                required
                className="w-full p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 mt-4"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
