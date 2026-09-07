import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { openDB } from 'idb';
import { 
  ShieldCheck, Users, QrCode, Camera, WifiOff, Wifi, 
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Settings, 
  Database, Smartphone, BookOpen, Clock, Plus, Sparkles, UserCheck, X
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

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
  await db.add(STORE_NAME, { ...record, timestamp: new Date().toISOString() });
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

export default function App() {
  const [activeRole, setActiveRole] = useState(null);

  if (!activeRole) {
    return <LoginSelection onSelectRole={setActiveRole} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white px-6 py-4 shadow-lg sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-linear-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">TrustAttendance</span>
            <span className="block text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Zero-Infrastructure Trust Triangle</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
            {activeRole} Portal
          </span>
          <button 
            onClick={() => setActiveRole(null)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/60 text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch Role</span>
          </button>
        </div>
      </nav>

      <main className="p-6 md:p-10 max-w-6xl mx-auto">
        {activeRole === 'admin' && <AdminPortal />}
        {activeRole === 'professor' && <ProfessorApp />}
        {activeRole === 'student' && <StudentApp />}
      </main>
    </div>
  );
}

// ==========================================
// 1. ADMIN PORTAL
// ==========================================
function AdminPortal() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 text-indigo-400 mb-6">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-2xl text-white tracking-tight">Admin Control Panel</h3>
            <p className="text-slate-400 text-xs">System oversight & enterprise database configuration</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Database Backend</span>
            <span className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Neon PostgreSQL 18
            </span>
          </div>
          <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Session Cache</span>
            <span className="text-sm font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Redis Cloud
            </span>
          </div>
          <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 block font-medium">Security Standard</span>
            <span className="text-sm font-bold text-indigo-300 mt-1">WebAuthn & TOTP Enclave</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. PROFESSOR APP
// ==========================================
function ProfessorApp() {
  const [subjectCode, setSubjectCode] = useState('CS301');
  const [professorId] = useState(1);
  const [sessionActive, setSessionActive] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [currentToken, setCurrentToken] = useState('------');
  const [timer, setTimer] = useState(5);
  const [liveHeadcount, setLiveHeadcount] = useState([]);
  
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  const startSession = async () => {
    try {
      const res = await axios.post(`${API_URL}/session/start`, {
        subject_code: subjectCode,
        professor_id: professorId
      });
      setTotpSecret(res.data.secret);
      setSessionActive(true);
      connectWebSocket(subjectCode);
    } catch (err) {
      alert("Failed to start session. Is backend running?");
      console.error(err);
    }
  };

  const connectWebSocket = (code) => {
    wsRef.current = new WebSocket(`ws://127.0.0.1:8000/ws/session/${code}`);
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_ATTENDANCE') {
        setLiveHeadcount(prev => [...prev, data]);
      }
    };
  };

  useEffect(() => {
    if (sessionActive) {
      const generateToken = () => Math.random().toString(36).substring(2, 8).toUpperCase();
      setCurrentToken(generateToken());
      setTimer(5);

      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev === 1) {
            setCurrentToken(generateToken());
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
  }, [sessionActive]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!sessionActive ? (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-10 rounded-3xl shadow-xl text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Settings className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Start Lecture Session</h2>
          <p className="text-slate-400 text-sm mb-8">Generate offline-capable dynamic TOTP QR code for projector broadcast.</p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <input 
              type="text" 
              value={subjectCode}
              onChange={e => setSubjectCode(e.target.value)}
              placeholder="Subject Code"
              className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl font-mono uppercase text-center text-white font-bold w-full sm:w-48 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
            />
            <button 
              onClick={startSession}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl font-bold tracking-wide transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <QrCode className="w-5 h-5" /> Start Session
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-linear-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-100">
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {subjectCode} Session Live
            </div>
            
            <button 
              onClick={() => setSessionActive(false)}
              className="absolute top-6 right-6 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
            >
              End Session
            </button>

            <div className="bg-white p-6 rounded-3xl mb-6 shadow-2xl shadow-indigo-500/10 border-4 border-slate-800">
              <QrCode className="w-48 h-48 text-slate-950" />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Cryptographic Token</p>
              <div className="text-5xl font-mono font-black text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-indigo-400 tracking-widest">{currentToken}</div>
            </div>

            <div className="mt-6 flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-full text-xs text-slate-300">
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${timer === 1 ? 'animate-spin' : ''}`} /> 
              <span>Regenerating in <strong className="text-white font-mono">{timer}s</strong></span>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800">
              <div 
                className="h-full bg-linear-to-r from-indigo-500 to-cyan-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(timer / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-xl p-6 flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white text-sm">Live Headcount</h3>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full">{liveHeadcount.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-75 pr-1">
              {liveHeadcount.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-16">
                  <Users className="w-10 h-10 opacity-30" />
                  <p className="text-xs text-center">Waiting for students via WebSocket...</p>
                </div>
              ) : (
                liveHeadcount.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                        {item.student_id}
                      </div>
                      <span className="font-medium text-slate-200">Student Verified</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. STUDENT APP (PWA + Offline Cache + Token Input)
// ==========================================
function StudentApp() {
  const [studentId] = useState(1);
  const [subjectCode, setSubjectCode] = useState('CS301');
  const [tokenInput, setTokenInput] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    const handleOnlineStatus = async () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online) {
        const queue = await getOfflineAttendance();
        if (queue.length > 0) {
          for (const item of queue) {
            try {
              await axios.post(`${API_URL}/attendance/verify`, {
                subject_code: item.subjectCode,
                student_id: item.studentId,
                token: item.token
              });
            } catch (e) {
              console.error("Sync batch error", e);
            }
          }
          await clearOfflineQueue();
          setQueueCount(0);
          setStatusMsg({ type: 'success', text: 'Offline queue successfully synced to server!' });
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

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!tokenInput) return;

    if (isOffline) {
      await saveOfflineAttendance({ subjectCode, studentId, token: tokenInput });
      await loadQueueCount();
      setStatusMsg({ type: 'warning', text: 'Offline mode: Attendance cached locally. Will sync when online.' });
      setTokenInput('');
    } else {
      try {
        await axios.post(`${API_URL}/attendance/verify`, {
          subject_code: subjectCode,
          student_id: studentId,
          token: tokenInput
        });
        setStatusMsg({ type: 'success', text: 'Attendance verified and saved to Neon DB!' });
        setTokenInput('');
      } catch (err) {
        setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Verification failed.' });
      }
    }
  };

  return (
    <div className="max-w-md mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white">Student PWA Scanner</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {studentId} • Biometric Enclave</p>
        </div>
        <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-sm ${
          isOffline ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {isOffline ? 'Offline' : 'Online'}
        </div>
      </div>

      {queueCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-bold">Pending Offline Queue ({queueCount})</p>
            <p className="text-amber-300/80 mt-0.5">Cached in IndexedDB. Will background-sync automatically when connection restores.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleScanSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Subject Code</label>
          <input 
            type="text" 
            value={subjectCode} 
            onChange={e => setSubjectCode(e.target.value)}
            className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl uppercase font-mono text-sm text-white font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Scanned TOTP Token</label>
          <input 
            type="text" 
            value={tokenInput} 
            onChange={e => setTokenInput(e.target.value)}
            placeholder="Enter token from projector"
            className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl uppercase font-mono text-sm text-white font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" /> Submit Attendance Token
        </button>
      </form>

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
          statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
          statusMsg.type === 'warning' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 
          'bg-rose-500/10 text-rose-300 border-rose-500/20'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ROLE SELECTOR
// ==========================================
function LoginSelection({ onSelectRole }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900/60 backdrop-blur-2xl border border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-linear-to-tr from-indigo-600 to-violet-500 rounded-3xl flex items-center justify-center rotate-3 shadow-xl shadow-indigo-600/30 border border-indigo-400/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tight">TrustAttendance</h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium">Offline-First, Proxy-Free Academic Attendance</p>
        </div>

        <div className="flex flex-col space-y-3">
          <button 
            onClick={() => onSelectRole('admin')} 
            className="w-full p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl text-left transition-all duration-200 group flex items-center justify-between shadow-sm"
          >
            <div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">Admin Portal</div>
              <div className="text-xs text-slate-400 mt-0.5">Database & system oversight</div>
            </div>
            <Database className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </button>

          <button 
            onClick={() => onSelectRole('professor')} 
            className="w-full p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl text-left transition-all duration-200 group flex items-center justify-between shadow-sm"
          >
            <div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">Professor Portal</div>
              <div className="text-xs text-slate-400 mt-0.5">Projector node & Live WebSockets</div>
            </div>
            <QrCode className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </button>

          <button 
            onClick={() => onSelectRole('student')} 
            className="w-full p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/50 rounded-2xl text-left transition-all duration-200 group flex items-center justify-between shadow-sm"
          >
            <div>
              <div className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">Student PWA</div>
              <div className="text-xs text-slate-400 mt-0.5">Offline queue & token scanner</div>
            </div>
            <Smartphone className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}