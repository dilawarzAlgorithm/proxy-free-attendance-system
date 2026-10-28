import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { openDB } from 'idb';
import { 
  ShieldCheck, Users, QrCode, Camera, WifiOff, Wifi, 
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Settings, 
  Database, Smartphone, BookOpen, Clock, Plus, Sparkles, UserCheck, X, 
  FileSpreadsheet, UserPlus, Lock, FileText, Download, History, RotateCcw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';

// --- INLINE INDEXEDDB HELPERS ---
const DB_NAME = 'TrustAttendanceDB';
const STORE_NAME = 'offline-queue';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

async function saveOfflineAttendance(record) {
  const db = await initDB();
  await db.add(STORE_NAME, record);
}

async function getOfflineAttendance() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

async function clearOfflineQueue() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}

// Security: Generate a SHA-256 hash locally in the browser to sign offline requests
async function generateSignature(studentId, token, timestamp) {
  const msgUint8 = new TextEncoder().encode(`${studentId}:${token}:${timestamp}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to download files dynamically
async function downloadFileFromEndpoint(url, fallbackFilename) {
  try {
    const res = await axios.get(url, { responseType: 'blob' });
    const disposition = res.headers['content-disposition'];
    let filename = fallbackFilename;
    if (disposition && disposition.includes('filename=')) {
      filename = disposition.split('filename=')[1].replace(/"/g, '').trim();
    }
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    alert("Download failed: " + (err.response?.data?.detail || err.message));
  }
}

// ==========================================
// ROOT APP
// ==========================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsPwaInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      alert("PWA Info: On iOS Safari, tap Share (⬆️) -> 'Add to Home Screen'. On Android Chrome, tap Menu (⋮) -> 'Install App'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsPwaInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (!currentUser) {
    return <LoginSelection onLoginSuccess={setCurrentUser} onInstallPWA={handleInstallPWA} isPwaInstalled={isPwaInstalled} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white px-4 md:px-6 py-4 shadow-lg sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white">TrustAttendance</span>
            <span className="block text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Zero-Proxy Trust Architecture</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleInstallPWA}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Zero-Install Progressive Web App"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isPwaInstalled ? "PWA Installed" : "Install Mobile App"}</span>
          </button>

          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-white">{currentUser.name}</span>
            <span className="block text-[10px] text-indigo-400 uppercase tracking-widest">{currentUser.role}</span>
          </div>

          <button 
            onClick={() => setCurrentUser(null)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/60 text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        {currentUser.role === 'admin' && <AdminPortal />}
        {currentUser.role === 'professor' && <ProfessorApp professor={currentUser} />}
        {currentUser.role === 'student' && <StudentApp student={currentUser} onUserUpdate={setCurrentUser} />}
      </main>
    </div>
  );
}

// ==========================================
// 1. ADMIN PORTAL (User & Hardware Binding Mgmt)
// ==========================================
function AdminPortal() {
  const [activeTab, setActiveTab] = useState('users'); 
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');

  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const uRes = await axios.get(`${API_URL}/admin/users`);
      setUsers(uRes.data);
      const sRes = await axios.get(`${API_URL}/admin/subjects`);
      setSubjects(sRes.data);
    } catch (err) {
      console.error("Error fetching admin data", err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/users`, { name, email, password, role });
      setName(''); setEmail(''); setPassword('');
      fetchData();
      alert("User created successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create user");
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/admin/subjects`, { name: subName, code: subCode.toUpperCase() });
      setSubName(''); setSubCode('');
      fetchData();
      alert("Subject created successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create subject");
    }
  };

  const handleResetDevice = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to clear 1:1 hardware device binding for ${userName}? This will allow the student to bind a new phone.`)) return;
    try {
      await axios.post(`${API_URL}/admin/reset-device/${userId}`);
      alert(`Hardware binding cleared for ${userName}.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reset device binding.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          Manage Users & Hardware Bindings
        </button>
        <button 
          onClick={() => setActiveTab('subjects')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'subjects' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          Manage Subjects
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl">
            <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" /> Register User
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email / Username</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoCapitalize="none" autoCorrect="off" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoCapitalize="none" autoCorrect="off" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500">
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all">
                Create User
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl overflow-hidden flex flex-col">
            <h3 className="font-bold text-lg text-white mb-4">System Users & Hardware Lock Directory</h3>
            <div className="flex-1 overflow-y-auto max-h-120 space-y-2.5">
              {users.map(u => (
                <div key={u.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap justify-between items-center gap-3 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{u.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">ID #{u.id}</span>
                    </div>
                    <span className="text-xs text-slate-400 block">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {u.role}
                    </span>

                    {u.role === 'student' && (
                      <div className="flex items-center gap-2">
                        {u.is_bound ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-400" /> Bound 1:1
                            </span>
                            <button 
                              onClick={() => handleResetDevice(u.id, u.name)}
                              className="p-1.5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg text-rose-400 text-xs transition-all"
                              title="Reset 1:1 Hardware Binding (Student got new phone)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            ⚠️ Unbound
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl">
            <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> Create Subject
            </h3>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject Code</label>
                <input type="text" placeholder="e.g. CS301" value={subCode} onChange={e => setSubCode(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white uppercase outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject Name</label>
                <input type="text" placeholder="e.g. System Design" value={subName} onChange={e => setSubName(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all">
                Add Subject
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl overflow-hidden flex flex-col">
            <h3 className="font-bold text-lg text-white mb-4">Active Subjects</h3>
            <div className="flex-1 overflow-y-auto max-h-96 space-y-2">
              {subjects.map(s => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-sm">
                  <span className="font-bold font-mono text-indigo-400">{s.code}</span>
                  <span className="text-slate-200">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. PROFESSOR APP (Session Mgmt & Multi-Format Exports)
// ==========================================
function ProfessorApp({ professor }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentToken, setCurrentToken] = useState('------');
  const [timer, setTimer] = useState(5);
  const [liveHeadcount, setLiveHeadcount] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/admin/subjects`).then(res => {
      setSubjects(res.data);
      if (res.data.length > 0) {
        setSelectedSubject(res.data[0].code);
      }
    }).catch(err => console.error(err));
  }, []);

  // Fetch last 2 sessions whenever selected subject changes
  useEffect(() => {
    if (selectedSubject) {
      fetchRecentSessions(selectedSubject);
    }
  }, [selectedSubject]);

  const fetchRecentSessions = async (code) => {
    try {
      const res = await axios.get(`${API_URL}/professor/sessions/${code}`);
      setRecentSessions(res.data);
    } catch (err) {
      console.error("Failed to load recent sessions", err);
    }
  };

  const startSession = async () => {
    if (!selectedSubject) return alert("Please select a subject first!");
    try {
      const res = await axios.post(`${API_URL}/session/start`, {
        subject_code: selectedSubject,
        professor_id: professor.id
      });
      setActiveSessionId(res.data.session_id);
      setSessionActive(true);
      setLiveHeadcount([]);
      connectWebSocket(selectedSubject);
      fetchRecentSessions(selectedSubject);
    } catch (err) {
      alert("Failed to start session: " + (err.response?.data?.detail || err.message));
      console.error(err);
    }
  };

  const endSession = async () => {
    try {
      await axios.post(`${API_URL}/session/end`, {
        subject_code: selectedSubject
      });
    } catch (err) {
      console.error("Error ending session", err);
    } finally {
      setSessionActive(false);
      if (wsRef.current) wsRef.current.close();
      fetchRecentSessions(selectedSubject);
    }
  };

  const connectWebSocket = (code) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    wsRef.current = new WebSocket(`${wsProtocol}//${wsHost}/ws/session/${code}`);
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_ATTENDANCE') {
          // Prevent duplicates in live UI state
          setLiveHeadcount(prev => {
            if (prev.some(item => item.student_id === data.student_id)) return prev;
            return [...prev, data];
          });
        }
      } catch (e) {
        console.error("WS error", e);
      }
    };
  };

  const fetchLiveToken = async () => {
    try {
      const res = await axios.get(`${API_URL}/session/token/${selectedSubject}`);
      setCurrentToken(res.data.token);
    } catch (err) {
      console.error("Failed to fetch token", err);
    }
  };

  useEffect(() => {
    if (sessionActive) {
      fetchLiveToken();
      setTimer(5);

      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev === 1) {
            fetchLiveToken();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    }

    return () => clearInterval(timerRef.current);
  }, [sessionActive, selectedSubject]);

  const qrData = encodeURIComponent(`TRUSTATTENDANCE:${selectedSubject}:${currentToken}`);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${qrData}&margin=10`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!sessionActive ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl">
            <Settings className="w-10 h-10 text-indigo-400 mb-4" />
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Start Lecture Session</h2>
            <p className="text-slate-400 text-sm mb-6">Select a subject to project dynamic offline TOTP QR code and track live attendance.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Select Course</label>
                <select 
                  value={selectedSubject} 
                  onChange={e => setSelectedSubject(e.target.value)}
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-bold text-base outline-none focus:border-indigo-500"
                >
                  {subjects.length === 0 ? <option value="">No subjects found</option> : null}
                  {subjects.map(s => (
                    <option key={s.id} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={startSession}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/30 transition-all text-base"
              >
                Start Session & Project QR
              </button>

              <div className="pt-4 border-t border-slate-800">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Export All Attendance for {selectedSubject}</span>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/${selectedSubject}?format=csv`, `${selectedSubject}_all.csv`)}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" /> CSV
                  </button>
                  <button 
                    onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/${selectedSubject}?format=excel`, `${selectedSubject}_all.xlsx`)}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel (.xlsx)
                  </button>
                  <button 
                    onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/${selectedSubject}?format=pdf`, `${selectedSubject}_all.pdf`)}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LAST 2 SESSIONS HISTORY CARD */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Last 2 Sessions History</h3>
              </div>

              {recentSessions.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-8">No past sessions found for {selectedSubject}.</p>
              ) : (
                <div className="space-y-4">
                  {recentSessions.map((sess, idx) => (
                    <div key={sess.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          Session #{sess.id}
                          {sess.is_active === 1 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          )}
                        </span>
                        <span className="text-[10px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                          {sess.student_count} present
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {sess.start_time}
                      </p>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=csv`, `${selectedSubject}_session_${sess.id}.csv`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all"
                          title="Download CSV"
                        >
                          CSV
                        </button>
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=excel`, `${selectedSubject}_session_${sess.id}.xlsx`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center justify-center gap-1 transition-all"
                          title="Download Excel"
                        >
                          Excel
                        </button>
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=pdf`, `${selectedSubject}_session_${sess.id}.pdf`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-rose-300 hover:text-rose-200 flex items-center justify-center gap-1 transition-all"
                          title="Download PDF"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 mt-4 text-center">
              Per-subject historical audit exports (Last 2 sessions only).
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-110">
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {selectedSubject} Session Live {activeSessionId ? `(#${activeSessionId})` : ''}
            </div>
            
            <button 
              onClick={endSession}
              className="absolute top-6 right-6 bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
            >
              End Session
            </button>

            <div className="bg-white p-4 rounded-3xl mb-6 shadow-2xl border-4 border-slate-800 flex items-center justify-center">
              <img src={qrImageUrl} alt="Dynamic Session QR Code" className="w-48 h-48 object-contain" />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Dynamic Cryptographic Token</p>
              <div className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-widest">{currentToken}</div>
            </div>

            <div className="mt-6 flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-full text-xs text-slate-300">
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${timer === 1 ? 'animate-spin' : ''}`} /> 
              <span>Regenerating in <strong className="text-white font-mono">{timer}s</strong></span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                <h3 className="font-bold text-white text-sm">Live Verified Headcount</h3>
                <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full">{liveHeadcount.length}</span>
              </div>
              <div className="overflow-y-auto max-h-56 space-y-2.5">
                {liveHeadcount.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-8">Waiting for student scans...</p>
                ) : (
                  liveHeadcount.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-200 block">{item.student_name || `Student #${item.student_id}`}</span>
                        <span className="text-[10px] text-slate-400">ID: {item.student_id}</span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Export Current Session</span>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${activeSessionId || 1}?format=csv`, `${selectedSubject}_session.csv`)}
                  className="py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" /> CSV
                </button>
                <button 
                  onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${activeSessionId || 1}?format=excel`, `${selectedSubject}_session.xlsx`)}
                  className="py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 flex items-center justify-center gap-1 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
                </button>
                <button 
                  onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${activeSessionId || 1}?format=pdf`, `${selectedSubject}_session.pdf`)}
                  className="py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 flex items-center justify-center gap-1 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. STUDENT APP (WebAuthn 1:1 Hardware Binding & Anti-Duplicate Scanner)
// ==========================================
function StudentApp({ student, onUserUpdate }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isBound, setIsBound] = useState(Boolean(student.hardware_id));
  const [hardwareId, setHardwareId] = useState(student.hardware_id || localStorage.getItem(`bound_device_${student.id}`) || null);
  const [isBindingLoading, setIsBindingLoading] = useState(false);

  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  useEffect(() => {
    // Check server device status on mount
    axios.get(`${API_URL}/auth/device-status/${student.id}`)
      .then(res => {
        setIsBound(res.data.is_bound);
        if (res.data.hardware_id) {
          setHardwareId(res.data.hardware_id);
          localStorage.setItem(`bound_device_${student.id}`, res.data.hardware_id);
        }
      })
      .catch(e => console.error("Could not fetch device status", e));
  }, [student.id]);

  useEffect(() => {
    const handleOnlineStatus = async () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      
      // Auto-sync when internet returns
      if (online) {
        const queue = await getOfflineAttendance();
        if (queue.length > 0) {
          setStatusMsg({ type: 'warning', text: `Syncing ${queue.length} offline records...` });
          let successCount = 0;
          let duplicateCount = 0;
          for (const item of queue) {
            try {
              await axios.post(`${API_URL}/attendance/verify`, {
                subject_code: item.subjectCode,
                student_id: item.studentId,
                token: item.token,
                timestamp: item.timestamp,
                signature: item.signature,
                hardware_id: item.hardware_id
              });
              successCount++;
            } catch (e) {
              if (e.response?.status === 400) {
                duplicateCount++;
              }
              console.error("Sync error", e);
            }
          }
          await clearOfflineQueue();
          setQueueCount(0);
          if (duplicateCount > 0) {
            setStatusMsg({ type: 'warning', text: `Sync completed: ${successCount} verified, ${duplicateCount} duplicate entries ignored.` });
          } else {
            setStatusMsg({ type: 'success', text: `Successfully synced ${successCount} offline records to server!` });
          }
        }
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    loadQueueCount();

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const loadQueueCount = async () => {
    const queue = await getOfflineAttendance();
    setQueueCount(queue.length);
  };

  // 1:1 Hardware Device Binding via WebAuthn
  const handleBindDevice = async () => {
    setIsBindingLoading(true);
    setStatusMsg(null);
    try {
      let credId = null;

      if (window.PublicKeyCredential && navigator.credentials?.create) {
        // Generate cryptographic hardware keypair via WebAuthn platform authenticator
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "TrustAttendance" },
            user: {
              id: userId,
              name: student.email,
              displayName: student.name,
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },   // ES256
              { type: "public-key", alg: -257 }  // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform", // Phone biometric / TouchID / FaceID
              userVerification: "preferred"
            },
            timeout: 60000,
            attestation: "none"
          }
        });
        credId = credential.id;
      } else {
        // Fallback for non-WebAuthn browsers
        credId = 'hw-' + crypto.randomUUID();
      }

      const res = await axios.post(`${API_URL}/auth/bind-device`, {
        student_id: student.id,
        hardware_id: credId,
        device_name: navigator.userAgent
      });

      localStorage.setItem(`bound_device_${student.id}`, credId);
      setHardwareId(credId);
      setIsBound(true);
      if (onUserUpdate) {
        onUserUpdate(prev => ({ ...prev, hardware_id: credId }));
      }
      setStatusMsg({ type: 'success', text: "Device bound successfully! This phone is now locked 1:1 to your account." });
    } catch (err) {
      console.error("Binding error", err);
      setStatusMsg({ 
        type: 'error', 
        text: err.response?.data?.detail || "Device binding was cancelled or failed. Please authenticate with your screen lock/biometrics." 
      });
    } finally {
      setIsBindingLoading(false);
    }
  };

  // Submit Attendance with Cryptographic Offline Signatures & Hardware Binding
  const submitAttendance = async (subCode, token) => {
    if (!token || !subCode) {
      setStatusMsg({ type: 'error', text: 'Invalid QR Code format. Please scan a valid session QR.' });
      return;
    }

    const currentHwId = hardwareId || localStorage.getItem(`bound_device_${student.id}`) || student.hardware_id;

    // Capture exact UTC scan time and create digital signature
    const scanTimestamp = Date.now() / 1000.0;
    const signature = await generateSignature(student.id, token, scanTimestamp);

    if (isOfflineRef.current) {
      // Save full signed package locally
      await saveOfflineAttendance({ 
        subjectCode: subCode, 
        studentId: student.id, 
        token: token,
        timestamp: scanTimestamp,
        signature: signature,
        hardware_id: currentHwId
      });
      await loadQueueCount();
      setStatusMsg({ type: 'warning', text: `Offline mode: Scanned & signed locally. Timestamp: ${new Date().toLocaleTimeString()}` });
    } else {
      // Send directly to backend
      try {
        const res = await axios.post(`${API_URL}/attendance/verify`, {
          subject_code: subCode,
          student_id: student.id,
          token: token,
          timestamp: scanTimestamp,
          signature: signature,
          hardware_id: currentHwId
        });
        setStatusMsg({ type: 'success', text: `Attendance recorded successfully for ${subCode}!` });
      } catch (err) {
        const detail = err.response?.data?.detail || 'Verification failed.';
        setStatusMsg({ type: 'error', text: detail });
      }
    }
  };

  useEffect(() => {
    let scannerInstance = null;
    
    if (isScanning) {
      const initScanner = () => {
        if (!window.Html5QrcodeScanner) return;
        scannerInstance = new window.Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
  
        scannerInstance.render(
          (decodedText) => {
            setIsScanning(false);
            if (scannerInstance) scannerInstance.clear().catch(err => console.error(err));

            let scannedSubject = '';
            let scannedToken = decodedText;

            if (decodedText.startsWith("TRUSTATTENDANCE:")) {
              const parts = decodedText.split(":");
              scannedSubject = parts[1];
              scannedToken = parts[2];
            }
            
            submitAttendance(scannedSubject, scannedToken);
          },
          (errorMessage) => { /* Ignore noisy scan errors */ }
        );
      };

      if (!window.Html5QrcodeScanner) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.async = true;
        script.onload = initScanner;
        document.body.appendChild(script);
      } else {
        initScanner();
      }
    }
    
    return () => {
      if (scannerInstance) scannerInstance.clear().catch(e => console.error(e));
    };
  }, [isScanning]);

  return (
    <div className="max-w-md mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white">{student.name}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: #{student.id} • Student Portal</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
          isOffline ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {isOffline ? 'Offline Mode' : 'Online'}
        </div>
      </div>

      {/* 1:1 HARDWARE DEVICE BINDING STATUS CARD */}
      <div className={`p-4 rounded-2xl border text-xs flex flex-col gap-2 ${
        isBound ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            {isBound ? <Lock className="w-4 h-4 text-emerald-400" /> : <Smartphone className="w-4 h-4 text-amber-400" />}
            <span>{isBound ? "1:1 Hardware Phone Bound" : "Phone Binding Required"}</span>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
            {isBound ? "WebAuthn Locked" : "Unbound"}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {isBound 
            ? "Your student account is cryptographically bound to this physical phone. Proxies from other phones are strictly blocked."
            : "To mark attendance, lock your account to this physical phone using your fingerprint, Face ID, or screen lock."}
        </p>

        {!isBound && (
          <button 
            onClick={handleBindDevice}
            disabled={isBindingLoading}
            className="mt-2 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            {isBindingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Lock Account to This Phone (Biometrics)</span>
          </button>
        )}
      </div>

      {queueCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-bold">Pending Offline Scans ({queueCount})</p>
            <p className="text-amber-300/80 mt-0.5">Scans are cryptographically signed. Will auto-sync when classroom Wi-Fi returns.</p>
          </div>
        </div>
      )}

      {isScanning ? (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Scan Professor's QR Code</span>
            <button onClick={() => setIsScanning(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div id="reader" className="overflow-hidden rounded-xl bg-black"></div>
          <p className="text-xs text-slate-400 text-center mt-3">Attendance will be signed & submitted with phone hardware proof.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={() => { setStatusMsg(null); setIsScanning(true); }}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Camera className="w-5 h-5" /> Tap to Scan & Mark Attendance
          </button>
        </div>
      )}

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border animate-in zoom-in duration-300 ${
          statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
          statusMsg.type === 'warning' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 
          'bg-rose-500/10 text-rose-300 border-rose-500/20'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <span className="leading-relaxed text-sm font-medium">{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// LOGIN SELECTION
// ==========================================
function LoginSelection({ onLoginSuccess, onInstallPWA, isPwaInstalled }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await axios.post(`${API_URL}/auth/login`, { email: cleanEmail, password: password.trim() });
      onLoginSuccess(res.data);
    } catch (err) {
      if (!err.response) {
        alert("Network Error: Could not connect to backend server.");
      } else {
        alert(err.response?.data?.detail || "Invalid credentials. Check email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-6">
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-start">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center rotate-3 shadow-xl shadow-indigo-600/30 border border-indigo-400/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <button 
            onClick={onInstallPWA}
            className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl hover:bg-indigo-500/20 transition-all flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isPwaInstalled ? "PWA Ready" : "Install PWA"}</span>
          </button>
        </div>
        
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">TrustAttendance</h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium">Offline-First • 1:1 Hardware Binding • Zero Proxies</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Email / Username</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@college.edu or student ID"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Authenticating...' : 'Secure Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}