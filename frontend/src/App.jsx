import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { openDB } from 'idb';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  ShieldCheck, Users, QrCode, Camera, WifiOff, Wifi, 
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Settings, 
  Database, Smartphone, BookOpen, Clock, Plus, Sparkles, UserCheck, X, 
  FileSpreadsheet, UserPlus, Lock, FileText, Download, History, RotateCcw,
  AlertTriangle, Eye, ShieldAlert, Check, UserX
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
// 2. PROFESSOR APP (Session Mgmt, Multi-Format Exports & Proxy Audit)
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
  
  // Proxy Audit Modal State
  const [auditModalSessionId, setAuditModalSessionId] = useState(null);
  const [auditFaces, setAuditFaces] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [proxyActionLoading, setProxyActionLoading] = useState(null);

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

  const fetchSessionFaces = async (sessionId) => {
    setAuditLoading(true);
    try {
      const res = await axios.get(`${API_URL}/professor/session/${sessionId}/faces`);
      setAuditFaces(res.data);
    } catch (err) {
      console.error("Failed to load session faces", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const openAuditModal = (sessionId) => {
    setAuditModalSessionId(sessionId);
    fetchSessionFaces(sessionId);
  };

  const handleDismissProxy = async (sessionId, studentId) => {
    setProxyActionLoading(studentId);
    try {
      await axios.post(`${API_URL}/professor/dismiss-proxy/${sessionId}/${studentId}`);
      setAuditFaces(prev => prev.map(r => r.student_id === studentId ? { ...r, status: 'verified', is_flagged_proxy: false } : r));
      setLiveHeadcount(prev => prev.map(r => r.student_id === studentId ? { ...r, status: 'verified', is_flagged_proxy: false } : r));
      if (selectedSubject) fetchRecentSessions(selectedSubject);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setProxyActionLoading(null);
    }
  };

  const handleConfirmProxy = async (sessionId, studentId) => {
    setProxyActionLoading(studentId);
    try {
      await axios.post(`${API_URL}/professor/confirm-proxy/${sessionId}/${studentId}`);
      setAuditFaces(prev => prev.map(r => r.student_id === studentId ? { ...r, status: 'confirmed_proxy', is_flagged_proxy: true } : r));
      setLiveHeadcount(prev => prev.map(r => r.student_id === studentId ? { ...r, status: 'confirmed_proxy', is_flagged_proxy: true } : r));
      if (selectedSubject) fetchRecentSessions(selectedSubject);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setProxyActionLoading(null);
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
          setLiveHeadcount(prev => {
            const exists = prev.some(item => item.student_id === data.student_id);
            if (exists) {
              return prev.map(item => item.student_id === data.student_id ? { ...item, ...data } : item);
            }
            return [...prev, data];
          });
          if (auditModalSessionId && auditModalSessionId === activeSessionId) {
            fetchSessionFaces(activeSessionId);
          }
        } else if (data.type === 'PROXY_STATUS_UPDATED') {
          setLiveHeadcount(prev => prev.map(item => {
            if (item.student_id === data.student_id) {
              return { ...item, status: data.status, is_flagged_proxy: data.is_flagged_proxy };
            }
            return item;
          }));
          setAuditFaces(prev => prev.map(item => {
            if (item.student_id === data.student_id) {
              return { ...item, status: data.status, is_flagged_proxy: data.is_flagged_proxy };
            }
            return item;
          }));
          if (selectedSubject) fetchRecentSessions(selectedSubject);
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
      if (err.response?.status === 404) {
        setSessionActive(false);
        setCurrentToken('------');
      } else {
        console.error("Failed to fetch token", err);
      }
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

  const flaggedProxyCount = liveHeadcount.filter(i => i.is_flagged_proxy || i.status === 'flagged_proxy').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!sessionActive ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl">
            <Settings className="w-10 h-10 text-indigo-400 mb-4" />
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Start Lecture Session</h2>
            <p className="text-slate-400 text-sm mb-6">Select a subject to project dynamic offline TOTP QR code and track live attendance with AI Facial Verification.</p>
            
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
                  {recentSessions.map((sess) => (
                    <div key={sess.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          Session #{sess.id}
                          {sess.is_active === 1 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {sess.proxy_count > 0 && (
                            <span className="text-[10px] text-rose-300 font-bold bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" /> {sess.proxy_count} Proxy
                            </span>
                          )}
                          <span className="text-[10px] text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">
                            {sess.student_count} present
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {sess.start_time}
                      </p>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=csv`, `${selectedSubject}_session_${sess.id}.csv`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all"
                        >
                          CSV
                        </button>
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=excel`, `${selectedSubject}_session_${sess.id}.xlsx`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center justify-center gap-1 transition-all"
                        >
                          Excel
                        </button>
                        <button 
                          onClick={() => downloadFileFromEndpoint(`${API_URL}/professor/export/session/${sess.id}?format=pdf`, `${selectedSubject}_session_${sess.id}.pdf`)}
                          className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-lg text-[10px] font-bold text-rose-300 hover:text-rose-200 flex items-center justify-center gap-1 transition-all"
                        >
                          PDF
                        </button>
                      </div>

                      <button 
                        onClick={() => openAuditModal(sess.id)}
                        className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                          sess.proxy_count > 0 
                            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 animate-pulse' 
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20'
                        }`}
                      >
                        {sess.proxy_count > 0 ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-indigo-400" />}
                        <span>{sess.proxy_count > 0 ? `Review ${sess.proxy_count} Proxy Alert(s)` : 'View Captured Photos'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 mt-4 text-center">
              Per-subject historical audit exports with Face Verification audit.
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
                <div>
                  <h3 className="font-bold text-white text-sm">Live Verified Headcount</h3>
                  {flaggedProxyCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full mt-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" /> {flaggedProxyCount} Proxy Detected!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full">{liveHeadcount.length}</span>
                  {activeSessionId && (
                    <button 
                      onClick={() => openAuditModal(activeSessionId)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs flex items-center gap-1"
                      title="Audit Session Photos"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Banner to view photos */}
              {activeSessionId && (
                <button 
                  onClick={() => openAuditModal(activeSessionId)}
                  className={`w-full mb-3 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    flaggedProxyCount > 0 
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 shadow-lg shadow-rose-950/40' 
                      : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  {flaggedProxyCount > 0 ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : <Eye className="w-4 h-4 text-indigo-400" />}
                  <span>{flaggedProxyCount > 0 ? `⚠️ Review ${flaggedProxyCount} Proxy Alerts & Photos` : 'View Live Face Verification Photos'}</span>
                </button>
              )}

              <div className="overflow-y-auto max-h-56 space-y-2.5 pr-1">
                {liveHeadcount.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-8">Waiting for student scans...</p>
                ) : (
                  liveHeadcount.map((item, idx) => {
                    const isProxy = item.is_flagged_proxy || item.status === 'flagged_proxy';
                    const isConfirmed = item.status === 'confirmed_proxy';
                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-xl text-xs flex justify-between items-center border transition-all ${
                          isProxy ? 'bg-rose-950/40 border-rose-500/40' : 
                          isConfirmed ? 'bg-red-950/60 border-red-700/60' : 
                          'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.photo ? (
                            <img src={item.photo} alt="Student Face" className="w-9 h-9 rounded-lg object-cover border border-slate-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                              {(item.student_name || 'S').charAt(0)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-200 block truncate max-w-35">{item.student_name || `Student #${item.student_id}`}</span>
                            <span className="text-[10px] text-slate-400">ID: #{item.student_id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isProxy ? (
                            <button 
                              onClick={() => openAuditModal(activeSessionId || item.session_id)}
                              className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-md shadow-rose-900/40 animate-pulse"
                              title="Potential proxy facial duplicate detected"
                            >
                              <AlertTriangle className="w-3 h-3" /> PROXY
                            </button>
                          ) : isConfirmed ? (
                            <span className="px-2 py-1 bg-red-900/60 border border-red-700 text-red-200 rounded-lg text-[10px] font-bold">
                              VIOLATION
                            </span>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
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

      {/* ========================================== */}
      {/* PROFESSOR PROXY AUDIT & PHOTO VIEWER MODAL */}
      {/* ========================================== */}
      {auditModalSessionId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Face Verification & Proxy Audit</h3>
                  <p className="text-xs text-slate-400">Session #{auditModalSessionId} • Captured Frames & DeepFace Proxy Comparison</p>
                </div>
              </div>
              <button 
                onClick={() => setAuditModalSessionId(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {auditLoading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">Loading session facial records...</p>
                </div>
              ) : auditFaces.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Users className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No attendance entries recorded yet</p>
                  <p className="text-xs text-slate-500">Student facial captures will appear here once attendance is marked.</p>
                </div>
              ) : (
                auditFaces.map((rec) => {
                  const isProxy = rec.is_flagged_proxy || rec.status === 'flagged_proxy';
                  const isConfirmed = rec.status === 'confirmed_proxy';
                  const isLoadingAction = proxyActionLoading === rec.student_id;

                  return (
                    <div 
                      key={rec.student_id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        isProxy ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/30' : 
                        isConfirmed ? 'bg-red-950/40 border-red-700/60' : 
                        'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-slate-800/80 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-sm">{rec.student_name}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">ID: #{rec.student_id}</span>
                            <span className="text-[10px] text-slate-500">({rec.email})</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{rec.timestamp}</p>
                        </div>

                        <div>
                          {isProxy ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-full text-xs font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              Potential Proxy Flagged {rec.similarity ? `(${(rec.similarity * 100).toFixed(1)}% match)` : ''}
                            </span>
                          ) : isConfirmed ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/40 border border-red-700/60 text-red-300 rounded-full text-xs font-bold">
                              <UserX className="w-3.5 h-3.5 text-red-400" />
                              Confirmed Proxy Violation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Facial Verification Passed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Photo Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div>
                          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Captured Camera Frame</span>
                          {rec.photo ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-4/3 flex items-center justify-center">
                              <img src={rec.photo} alt={rec.student_name} className="w-full h-full object-cover" />
                              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" /> Face Detected
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 aspect-4/3 flex items-center justify-center text-xs text-slate-500">
                              No camera photo logged
                            </div>
                          )}
                        </div>

                        {/* If Proxy Detected, Show side-by-side match details and actions */}
                        <div className="space-y-3">
                          {isProxy && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-rose-200">
                                  <strong className="block text-rose-300 font-bold">Facial Vector Discrepancy</strong>
                                  This face matched with <strong>{rec.matched_with_name || `Student #${rec.matched_with_id}`}</strong> (ID: #{rec.matched_with_id}) with high cosine similarity {rec.similarity ? `(${(rec.similarity * 100).toFixed(1)}%)` : ''}.
                                </div>
                              </div>
                            </div>
                          )}

                          {isConfirmed && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                              Attendance marked as confirmed proxy infraction by professor.
                            </div>
                          )}

                          {/* Professor Decision Buttons */}
                          <div className="flex items-center gap-2 pt-2">
                            {isProxy ? (
                              <>
                                <button
                                  onClick={() => handleDismissProxy(auditModalSessionId, rec.student_id)}
                                  disabled={isLoadingAction}
                                  className="flex-1 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                  {isLoadingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Dismiss Flag (Mark Legitimate)
                                </button>
                                <button
                                  onClick={() => handleConfirmProxy(auditModalSessionId, rec.student_id)}
                                  disabled={isLoadingAction}
                                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-900/40"
                                >
                                  {isLoadingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                                  Confirm Proxy
                                </button>
                              </>
                            ) : isConfirmed ? (
                              <button
                                onClick={() => handleDismissProxy(auditModalSessionId, rec.student_id)}
                                disabled={isLoadingAction}
                                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                Revert to Verified
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConfirmProxy(auditModalSessionId, rec.student_id)}
                                disabled={isLoadingAction}
                                className="py-2 px-3 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                Manual Flag as Proxy
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center text-xs text-slate-400">
              <span>DeepFace & SFace Neural Verification Engine</span>
              <button 
                onClick={() => setAuditModalSessionId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ERROR BOUNDARY (Prevents White Screen)
// ==========================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Camera Error caught by boundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-900 border border-indigo-500/30 rounded-3xl text-center space-y-4 max-w-md mx-auto my-8 text-white">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold">Camera View Reset</h3>
          <p className="text-xs text-slate-400">The camera interface encountered an error. Click below to reset.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg"
          >
            Reset Scanner
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 3. STUDENT APP (2-Step QR Scan & Front Face Verification)
// ==========================================
function StudentApp({ student, onUserUpdate }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);
  
  // 4 Steps: 'idle' | 'scanning_qr' | 'selfie_capture' | 'submitting'
  const [flowStep, setFlowStep] = useState('idle');
  const [scannedSession, setScannedSession] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [lastCapturedSelfie, setLastCapturedSelfie] = useState(null);

  const [isBound, setIsBound] = useState(Boolean(student.hardware_id));
  const [hardwareId, setHardwareId] = useState(student.hardware_id || localStorage.getItem(`bound_device_${student.id}`) || null);
  const [isBindingLoading, setIsBindingLoading] = useState(false);

  const qrScannerRef = useRef(null);
  const selfieVideoRef = useRef(null);
  const selfieStreamRef = useRef(null);

  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  useEffect(() => {
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
                hardware_id: item.hardware_id,
                image_b64: item.image_b64
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
              authenticatorAttachment: "platform",
              userVerification: "preferred"
            },
            timeout: 60000,
            attestation: "none"
          }
        });
        credId = credential.id;
      } else {
        credId = 'hw-' + crypto.randomUUID();
      }

      await axios.post(`${API_URL}/auth/bind-device`, {
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

  // ========================================================
  // STEP 1: START QR SCANNER (Uses Back Camera for Board/Screen)
  // ========================================================
  const startScanningFlow = () => {
    setStatusMsg(null);
    setLastCapturedSelfie(null);
    setFlowStep('scanning_qr');
  };

  useEffect(() => {
    let scanner = null;
    let stopped = false;

    if (flowStep === 'scanning_qr') {
      const init = async () => {
        try {
          scanner = new Html5Qrcode("qr-reader");
          qrScannerRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
              if (stopped) return;
              stopped = true;

              let subCode = '';
              let scannedToken = decodedText;
              if (decodedText.startsWith("TRUSTATTENDANCE:")) {
                const parts = decodedText.split(":");
                subCode = parts[1] || '';
                scannedToken = parts[2] || decodedText;
              }

              // Stop scanner immediately and release rear camera
              try {
                if (scanner && scanner.isScanning) {
                  await scanner.stop();
                }
              } catch (e) {}

              // Automatically transition to Step 2: Front Selfie Verification!
              setScannedSession({
                subjectCode: subCode,
                token: scannedToken,
                timestamp: Date.now() / 1000.0
              });
              setFlowStep('selfie_capture');
            },
            () => {}
          );
        } catch (err) {
          console.warn("Back camera failed, trying fallback camera:", err);
          if (stopped) return;
          try {
            await scanner.start(
              { facingMode: "user" },
              { fps: 15, qrbox: { width: 250, height: 250 } },
              async (decodedText) => {
                if (stopped) return;
                stopped = true;

                let subCode = '';
                let scannedToken = decodedText;
                if (decodedText.startsWith("TRUSTATTENDANCE:")) {
                  const parts = decodedText.split(":");
                  subCode = parts[1] || '';
                  scannedToken = parts[2] || decodedText;
                }

                try {
                  if (scanner && scanner.isScanning) {
                    await scanner.stop();
                  }
                } catch (e) {}

                setScannedSession({
                  subjectCode: subCode,
                  token: scannedToken,
                  timestamp: Date.now() / 1000.0
                });
                setFlowStep('selfie_capture');
              },
              () => {}
            );
          } catch (e2) {
            console.error("Camera failed entirely:", e2);
            setStatusMsg({ type: 'error', text: 'Camera access denied or unavailable: ' + (e2.message || e2) });
            setFlowStep('idle');
          }
        }
      };

      init();
    }

    return () => {
      stopped = true;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            scanner.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, [flowStep]);

  // ========================================================
  // STEP 2: FRONT SELFIE CAMERA CAPTURE (Auto & 1-Tap)
  // ========================================================
  useEffect(() => {
    let stream = null;
    let timer = null;

    if (flowStep === 'selfie_capture') {
      setCountdown(3);

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      }).then(s => {
        stream = s;
        selfieStreamRef.current = s;
        if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = s;
          selfieVideoRef.current.play().catch(() => {});
        }

        // 3-second automatic selfie countdown
        let count = 3;
        timer = setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(timer);
            snapSelfieAndSubmit(stream);
          }
        }, 1000);
      }).catch(err => {
        console.error("Selfie stream error:", err);
        setStatusMsg({ type: 'error', text: 'Front camera error: ' + (err.message || err) });
        setFlowStep('idle');
      });
    }

    return () => {
      if (timer) clearInterval(timer);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [flowStep]);

  const snapSelfieAndSubmit = async (activeStream) => {
    const video = selfieVideoRef.current;
    let selfieB64 = null;

    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        selfieB64 = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.error("Canvas snap error:", e);
      }
    }

    // Stop selfie video stream tracks
    const s = activeStream || selfieStreamRef.current;
    if (s) {
      s.getTracks().forEach(t => t.stop());
    }

    if (!selfieB64) {
      setStatusMsg({ type: 'error', text: 'Could not capture face selfie. Please retry.' });
      setFlowStep('idle');
      return;
    }

    setLastCapturedSelfie(selfieB64);
    setFlowStep('submitting');
    await submitAttendancePayload(scannedSession, selfieB64);
  };

  // ========================================================
  // STEP 3: SUBMIT ATTENDANCE PAYLOAD TO SERVER
  // ========================================================
  const submitAttendancePayload = async (sessionData, imageB64) => {
    const currentHwId = hardwareId || localStorage.getItem(`bound_device_${student.id}`) || student.hardware_id;
    const scanTimestamp = sessionData?.timestamp || (Date.now() / 1000.0);
    const signature = await generateSignature(student.id, sessionData.token, scanTimestamp);

    if (isOfflineRef.current) {
      await saveOfflineAttendance({
        subjectCode: sessionData.subjectCode,
        studentId: student.id,
        token: sessionData.token,
        timestamp: scanTimestamp,
        signature: signature,
        hardware_id: currentHwId,
        image_b64: imageB64
      });
      await loadQueueCount();
      setFlowStep('idle');
      setStatusMsg({
        type: 'warning',
        text: `Offline Mode: QR scanned & face verified locally. Will auto-sync when classroom Wi-Fi returns.`
      });
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/attendance/verify`, {
        subject_code: sessionData.subjectCode,
        student_id: student.id,
        token: sessionData.token,
        timestamp: scanTimestamp,
        signature: signature,
        hardware_id: currentHwId,
        image_b64: imageB64
      });

      setFlowStep('idle');
      if (res.data?.is_flagged_proxy) {
        setStatusMsg({
          type: 'warning',
          text: `⚠️ Notice: Attendance recorded for ${sessionData.subjectCode}, but flagged for review due to facial proxy similarity.`
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: `Attendance recorded successfully for ${sessionData.subjectCode}! Face verified.`
        });
      }
    } catch (err) {
      setFlowStep('idle');
      const detail = err.response?.data?.detail || 'Verification failed.';
      if (detail.includes("already recorded") || detail.includes("Duplicate")) {
        setStatusMsg({
          type: 'info',
          text: `Attendance is already recorded for this lecture session. You are marked present!`
        });
      } else if (detail.includes("No face detected")) {
        setStatusMsg({
          type: 'error',
          text: `No face detected in selfie. Please ensure your face is well-lit and directly facing the camera.`
        });
      } else {
        setStatusMsg({ type: 'error', text: detail });
      }
    }
  };

  return (
    <ErrorBoundary>
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
              <p className="text-amber-300/80 mt-0.5">Scans are cryptographically signed & facial embedded. Will auto-sync when classroom Wi-Fi returns.</p>
            </div>
          </div>
        )}

        {/* STEP 1: QR SCANNER (REAR CAMERA) */}
        {flowStep === 'scanning_qr' && (
          <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 relative space-y-3 animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-400" />
                Step 1: Scan Attendance QR
              </span>
              <button 
                onClick={() => setFlowStep('idle')} 
                className="text-slate-400 hover:text-white p-1"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black border border-slate-800">
              <div id="qr-reader" className="w-full"></div>
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
                <span className="text-[10px] font-bold text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md">
                  Point at Classroom QR Code
                </span>
                <div className="w-44 h-44 border-2 border-dashed border-indigo-400/70 rounded-3xl animate-pulse"></div>
                <span className="text-[10px] text-indigo-300 font-mono bg-black/60 px-2.5 py-0.5 rounded">
                  TOTP Dynamic Scan Active
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Front selfie face verification will automatically start right after scanning.
            </p>
          </div>
        )}

        {/* STEP 2: FRONT SELFIE FACE CAPTURE */}
        {flowStep === 'selfie_capture' && (
          <div className="bg-slate-950 p-5 rounded-3xl border border-indigo-500/40 space-y-4 animate-in zoom-in-95 duration-200 shadow-xl shadow-indigo-950/40">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
                <div>
                  <h3 className="font-bold text-white text-sm">Step 2: Face Verification</h3>
                  <p className="text-[11px] text-emerald-400 font-medium">✅ QR Scanned for {scannedSession?.subjectCode}</p>
                </div>
              </div>
              <button onClick={() => setFlowStep('idle')} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Smile at the camera! Center your face inside the circle for instant anti-proxy verification.
            </p>

            <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 border-2 border-indigo-500/30 flex items-center justify-center">
              {/* Mirrored video feed */}
              <video 
                ref={selfieVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover" 
                style={{ transform: 'scaleX(-1)' }} 
              />
              {/* High-contrast face oval guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-indigo-400 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] animate-pulse"></div>
              </div>
              {/* Countdown pill */}
              <div className="absolute top-3 right-3 bg-indigo-600/90 text-white font-mono text-xs font-black px-3 py-1 rounded-full shadow-lg">
                📸 Snapping in {countdown}s...
              </div>
            </div>

            <button 
              onClick={() => snapSelfieAndSubmit()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Camera className="w-4 h-4" /> Snap & Submit Attendance Now
            </button>
          </div>
        )}

        {/* STEP 3: SUBMITTING STATE */}
        {flowStep === 'submitting' && (
          <div className="p-8 bg-slate-950 rounded-3xl border border-indigo-500/30 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-white">Verifying Face & Device Signature...</h4>
            <p className="text-xs text-slate-400">Comparing neural embeddings against session records to prevent proxies.</p>
          </div>
        )}

        {/* DEFAULT IDLE STATE BUTTON */}
        {flowStep === 'idle' && (
          <div className="space-y-4">
            <button 
              onClick={startScanningFlow}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Camera className="w-5 h-5" /> Scan Attendance & Verify Face
            </button>
          </div>
        )}

        {/* STATUS AND VERIFIED PHOTO DISPLAY */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border animate-in zoom-in duration-300 ${
            statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
            statusMsg.type === 'info' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
            statusMsg.type === 'warning' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 
            'bg-rose-500/10 text-rose-300 border-rose-500/20'
          }`}>
            {statusMsg.type === 'success' || statusMsg.type === 'info' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <span className="leading-relaxed text-sm font-medium block">{statusMsg.text}</span>
              {lastCapturedSelfie && (statusMsg.type === 'success' || statusMsg.type === 'warning') && (
                <div className="flex items-center gap-2 pt-1">
                  <img src={lastCapturedSelfie} alt="Verified Selfie" className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                  <span className="text-[11px] text-slate-400">Verified front face selfie logged for audit.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
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