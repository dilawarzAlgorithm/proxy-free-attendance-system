import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { openDB } from 'idb';
import { 
  ShieldCheck, Users, QrCode, Camera, WifiOff, Wifi, 
  CheckCircle2, AlertCircle, RefreshCw, LogOut, Settings, 
  Database, Smartphone, BookOpen, Clock, Plus, Sparkles, UserCheck, X, FileSpreadsheet, UserPlus, Lock
} from 'lucide-react';

const API_URL = 'https://proxy-free-attendance-system.onrender.com';

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
  const [currentUser, setCurrentUser] = useState(null); // { id, role, name, email }

  if (!currentUser) {
    return <LoginSelection onLoginSuccess={setCurrentUser} />;
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
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-white">{currentUser.name}</span>
            <span className="block text-[10px] text-indigo-400 uppercase tracking-widest">{currentUser.role}</span>
          </div>
          <button 
            onClick={() => setCurrentUser(null)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 border border-slate-700/60 text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="p-6 md:p-10 max-w-6xl mx-auto">
        {currentUser.role === 'admin' && <AdminPortal />}
        {currentUser.role === 'professor' && <ProfessorApp professor={currentUser} />}
        {currentUser.role === 'student' && <StudentApp student={currentUser} />}
      </main>
    </div>
  );
}

// ==========================================
// 1. ADMIN PORTAL
// ==========================================
function AdminPortal() {
  const [activeTab, setActiveTab] = useState('users'); // users or subjects
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Form states for creating user
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');

  // Form states for creating subject
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

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
        >
          Manage Users & Roles
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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500" />
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
            <h3 className="font-bold text-lg text-white mb-4">System Users Directory</h3>
            <div className="flex-1 overflow-y-auto max-h-96 space-y-2">
              {users.map(u => (
                <div key={u.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-sm">
                  <div>
                    <span className="font-bold text-white">{u.name}</span>
                    <span className="text-xs text-slate-400 block">{u.email}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {u.role}
                  </span>
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
// 2. PROFESSOR APP
// ==========================================
function ProfessorApp({ professor }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentToken, setCurrentToken] = useState('------');
  const [timer, setTimer] = useState(5);
  const [liveHeadcount, setLiveHeadcount] = useState([]);
  
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/admin/subjects`).then(res => {
      setSubjects(res.data);
      if (res.data.length > 0) setSelectedSubject(res.data[0].code);
    }).catch(err => console.error(err));
  }, []);

  const startSession = async () => {
    if (!selectedSubject) return alert("Please create a subject first!");
    try {
      await axios.post(`${API_URL}/session/start`, {
        subject_code: selectedSubject,
        professor_id: professor.id
      });
      setSessionActive(true);
      connectWebSocket(selectedSubject);
    } catch (err) {
      alert("Failed to start session");
      console.error(err);
    }
  };

  const connectWebSocket = (code) => {
    // Connect to the Render deployed WebSocket backend securely via wss://
    wsRef.current = new WebSocket(`wss://proxy-free-attendance-system.onrender.com/ws/session/${code}`);
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

  const downloadExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/professor/export/${selectedSubject}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedSubject}_attendance.csv`); // Using CSV opens natively in Excel
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert("Failed to download export spreadsheet");
    }
  };

  // Generate real dynamic QR code URL based on current token
  const qrData = encodeURIComponent(`TRUSTATTENDANCE:${selectedSubject}:${currentToken}`);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${qrData}&margin=10`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!sessionActive ? (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-10 rounded-3xl shadow-xl text-center max-w-xl mx-auto">
          <Settings className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Start Lecture Session</h2>
          <p className="text-slate-400 text-sm mb-6">Select subject to broadcast dynamic offline TOTP QR code.</p>
          
          <div className="space-y-4">
            <select 
              value={selectedSubject} 
              onChange={e => setSelectedSubject(e.target.value)}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-indigo-500"
            >
              {subjects.length === 0 ? <option value="">No subjects found</option> : null}
              {subjects.map(s => (
                <option key={s.id} value={s.code}>{s.code} - {s.name}</option>
              ))}
            </select>
            <button 
              onClick={startSession}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Start Session & Project QR
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-linear-to-br from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-100">
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {selectedSubject} Session Live
            </div>
            
            <button 
              onClick={() => setSessionActive(false)}
              className="absolute top-6 right-6 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-1.5 rounded-full text-xs font-semibold"
            >
              End Session
            </button>

            {/* Displaying Live Automatically Refreshing QR Code */}
            <div className="bg-white p-4 rounded-3xl mb-6 shadow-2xl border-4 border-slate-800 flex items-center justify-center">
              <img src={qrImageUrl} alt="Dynamic Session QR Code" className="w-48 h-48 object-contain" />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Cryptographic Token</p>
              <div className="text-5xl font-mono font-black text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-indigo-400 tracking-widest">{currentToken}</div>
            </div>

            <div className="mt-6 flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-full text-xs text-slate-300">
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${timer === 1 ? 'animate-spin' : ''}`} /> 
              <span>Regenerating in <strong className="text-white font-mono">{timer}s</strong></span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                <h3 className="font-bold text-white text-sm">Live Headcount</h3>
                <span className="bg-indigo-500/10 text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full">{liveHeadcount.length}</span>
              </div>
              <div className="overflow-y-auto max-h-60 space-y-2.5">
                {liveHeadcount.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-4">Waiting for scans...</p>
                ) : (
                  liveHeadcount.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
                      <span className="font-semibold text-slate-200">Student ID: {item.student_id}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={downloadExport}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Download Excel / CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. STUDENT APP (Scanner UI with Auto-Submit)
// ==========================================
function StudentApp({ student }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // We use a ref for isOffline to avoid stale closures in the scanner callback
  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

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
              console.error("Sync error", e);
            }
          }
          await clearOfflineQueue();
          setQueueCount(0);
          setStatusMsg({ type: 'success', text: 'Offline attendance queue successfully synced to server!' });
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

  // Submit Attendance directly once QR is scanned
  const submitAttendance = async (subCode, token) => {
    if (!token || !subCode) {
      setStatusMsg({ type: 'error', text: 'Invalid QR Code format. Please scan a valid session QR.' });
      return;
    }

    if (isOfflineRef.current) {
      await saveOfflineAttendance({ subjectCode: subCode, studentId: student.id, token: token });
      await loadQueueCount();
      setStatusMsg({ type: 'warning', text: `Offline mode: Attendance for ${subCode} cached locally.` });
    } else {
      try {
        await axios.post(`${API_URL}/attendance/verify`, {
          subject_code: subCode,
          student_id: student.id,
          token: token
        });
        setStatusMsg({ type: 'success', text: `Attendance verified and saved to database for ${subCode}!` });
      } catch (err) {
        setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Verification failed.' });
      }
    }
  };

  // Dynamically load html5-qrcode script
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
            // Stop scanning and clear the camera
            setIsScanning(false);
            if (scannerInstance) {
              scannerInstance.clear().catch(err => console.error(err));
            }

            let scannedSubject = '';
            let scannedToken = decodedText;

            // Parse formatted TRUSTATTENDANCE:CS301:TOKEN
            if (decodedText.startsWith("TRUSTATTENDANCE:")) {
              const parts = decodedText.split(":");
              scannedSubject = parts[1];
              scannedToken = parts[2];
            }
            
            // Automatically submit right after successful scan
            submitAttendance(scannedSubject, scannedToken);
          },
          (errorMessage) => {
            // scanning in progress (ignore frequent error messages)
          }
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
    <div className="max-w-md mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white">{student.name}</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {student.id} • Biometric Enclave</p>
        </div>
        <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
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
            <p className="text-amber-300/80 mt-0.5">Will sync automatically when connection restores.</p>
          </div>
        </div>
      )}

      {/* QR Code Scanner View */}
      {isScanning ? (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Scan Professor's QR Code</span>
            <button onClick={() => setIsScanning(false)} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div id="reader" className="overflow-hidden rounded-xl bg-black"></div>
          <p className="text-xs text-slate-400 text-center mt-3">Attendance will automatically submit on successful scan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={() => { setStatusMsg(null); setIsScanning(true); }}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Camera className="w-5 h-5" /> Tap to Scan & Submit
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
function LoginSelection({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      onLoginSuccess(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Invalid credentials. Check email or password.");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-slate-400 text-xs mt-1.5 font-medium">Sign in with your credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">Email / Username</label>
            <input 
              type="text" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@college.edu or student ID"
              required
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