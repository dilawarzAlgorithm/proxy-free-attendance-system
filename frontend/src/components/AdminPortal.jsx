import React, { useState, useEffect } from 'react';
import { UserPlus, BookOpen, AlertTriangle, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);

  // User form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('');
  const [batchYear, setBatchYear] = useState('');

  // Subject form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subDept, setSubDept] = useState('');
  const [profId, setProfId] = useState('');

  const [message, setMessage] = useState('');
  const [showDanger, setShowDanger] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const uRes = await api.get('/admin/users');
      setUsers(uRes.data);
      const sRes = await api.get('/admin/subjects');
      setSubjects(sRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/admin/users', { 
        name, email, password, role, 
        department: department || null, 
        batch_year: batchYear ? parseInt(batchYear) : null 
      });
      setName(''); setEmail(''); setPassword('');
      fetchData();
      notify('User created successfully');
    } catch (err) {
      alert(err.response?.data?.detail || "Error creating user");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/admin/subjects', { 
        name: subName, 
        code: subCode.toUpperCase(), 
        department: subDept,
        professor_id: profId ? parseInt(profId) : null
      });
      setSubName(''); setSubCode(''); setSubDept(''); setProfId('');
      fetchData();
      notify('Subject created successfully');
    } catch (err) {
      alert(err.response?.data?.detail || "Error creating subject");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId) => {
    const newPwd = prompt("Enter temporary password (min 6 chars):");
    if (!newPwd || newPwd.length < 6) return;
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { new_password: newPwd });
      notify("Password reset successfully. User must change it on next login.");
    } catch (err) {
      alert("Error resetting password");
    }
  };

  const handleResetDB = async () => {
    if (confirm("Are you absolutely sure? This will wipe all users, subjects, and attendance records.")) {
      if (confirm("Double checking: Type 'YES' to confirm reset.") === "YES") {
        try {
          await api.post('/admin/reset_db');
          alert("Database reset. You have been logged out.");
          window.location.reload();
        } catch (err) {
          alert("Error resetting database.");
        }
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Admin Portal</h1>
        <p className="text-slate-400 mt-1">Manage system users, subjects, and global configurations.</p>
      </header>

      {message && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {message}
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-800 pb-4 overflow-x-auto hide-scrollbar">
        {['users', 'subjects', 'danger'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === tab 
                ? tab === 'danger' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                : 'bg-slate-900 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {tab === 'users' && 'User Management'}
            {tab === 'subjects' && 'Subject Allocation'}
            {tab === 'danger' && 'Danger Zone'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" /> Provision User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500">
                    <option value="student">Student</option>
                    <option value="professor">Professor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Temp Password</label>
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Department (Optional)</label>
                  <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                </div>
                {role === 'student' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Batch Year</label>
                    <input type="number" value={batchYear} onChange={e => setBatchYear(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm transition-all mt-2">
                Provision User
              </button>
            </form>
          </div>

          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col">
            <h3 className="font-bold text-lg text-white mb-5">Directory Overview</h3>
            <div className="flex-1 overflow-auto bg-slate-950 border border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</th>
                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-white text-sm">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          u.role === 'admin' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' :
                          u.role === 'professor' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-400">{u.department || '-'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleResetPassword(u.id)}
                          title="Reset Password"
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
            <h3 className="font-bold text-lg text-white mb-5 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> New Subject
            </h3>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Subject Code</label>
                <input type="text" placeholder="CS101" value={subCode} onChange={e => setSubCode(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white uppercase outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Subject Name</label>
                <input type="text" value={subName} onChange={e => setSubName(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Department</label>
                <input type="text" value={subDept} onChange={e => setSubDept(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assign Professor</label>
                <select value={profId} onChange={e => setProfId(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500">
                  <option value="">-- Unassigned --</option>
                  {users.filter(u => u.role === 'professor').map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.department || 'N/A'})</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm transition-all mt-2">
                Allocate Subject
              </button>
            </form>
          </div>

          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col">
            <h3 className="font-bold text-lg text-white mb-5">Curriculum & Allocation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map(s => (
                <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {s.code}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{s.department}</span>
                    </div>
                    <h4 className="font-bold text-white mb-1 leading-tight">{s.name}</h4>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
                    <span>Assigned To:</span>
                    <span className="font-medium text-slate-200">{s.professor_name}</span>
                  </div>
                </div>
              ))}
              {subjects.length === 0 && (
                <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  No subjects created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="bg-rose-950/20 border border-rose-900/50 p-8 rounded-3xl max-w-2xl">
          <div className="flex items-center gap-3 text-rose-500 mb-4">
            <ShieldAlert className="w-8 h-8" />
            <h3 className="text-2xl font-bold">Danger Zone</h3>
          </div>
          <p className="text-slate-300 mb-6 text-sm leading-relaxed">
            This action will permanently delete all users, subjects, and attendance records from the database. 
            The admin account will be retained via environment variables, but all operational data will be lost.
          </p>
          <button 
            onClick={handleResetDB}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-rose-600/20"
          >
            Reset Entire Database
          </button>
        </div>
      )}
    </div>
  );
}
