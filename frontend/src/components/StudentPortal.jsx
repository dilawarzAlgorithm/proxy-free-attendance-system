import React, { useState, useEffect, useRef } from 'react';
import { Camera, WifiOff, Wifi, CheckCircle2, AlertCircle, X, Smartphone, List, CheckSquare } from 'lucide-react';
import { api } from '../api';

// Inline DB helpers for offline queue
import { openDB } from 'idb';
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

async function generateSignature(studentId, token, timestamp) {
  const msgUint8 = new TextEncoder().encode(`${studentId}:${token}:${timestamp}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function StudentPortal({ user }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [activeTab, setActiveTab] = useState('scanner');
  const [attendanceHistory, setAttendanceHistory] = useState([]);

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
          setStatusMsg({ type: 'warning', text: `Syncing ${queue.length} offline records...` });
          let successCount = 0;
          for (const item of queue) {
            try {
              await api.post('/attendance/verify', {
                subject_code: item.subjectCode,
                student_id: item.studentId,
                token: item.token,
                timestamp: item.timestamp,
                signature: item.signature
              });
              successCount++;
            } catch (e) {
              console.error(e);
            }
          }
          await clearOfflineQueue();
          setQueueCount(0);
          setStatusMsg({ type: 'success', text: `Synced ${successCount} offline records to server!` });
          fetchHistory();
        }
      }
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    loadQueueCount();
    fetchHistory();

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const loadQueueCount = async () => {
    const queue = await getOfflineAttendance();
    setQueueCount(queue.length);
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/student/attendance/${user.id}`);
      setAttendanceHistory(res.data);
    } catch (e) {
      console.error("Failed to fetch history");
    }
  };

  const submitAttendance = async (subCode, token) => {
    if (!token || !subCode) {
      setStatusMsg({ type: 'error', text: 'Invalid QR Code format.' });
      return;
    }
    const scanTimestamp = Date.now() / 1000.0;
    const signature = await generateSignature(user.id, token, scanTimestamp);

    if (isOfflineRef.current) {
      await saveOfflineAttendance({ 
        subjectCode: subCode, studentId: user.id, token, timestamp: scanTimestamp, signature 
      });
      await loadQueueCount();
      setStatusMsg({ type: 'warning', text: `Saved offline. Will sync automatically when online.` });
    } else {
      try {
        await api.post('/attendance/verify', {
          subject_code: subCode, student_id: user.id, token, timestamp: scanTimestamp, signature
        });
        setStatusMsg({ type: 'success', text: `Attendance recorded for ${subCode}!` });
        fetchHistory();
      } catch (err) {
        setStatusMsg({ type: 'error', text: err.response?.data?.detail || 'Verification failed.' });
      }
    }
  };

  useEffect(() => {
    let scannerInstance = null;
    
    if (isScanning && activeTab === 'scanner') {
      const initScanner = () => {
        if (!window.Html5QrcodeScanner) return;
        scannerInstance = new window.Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scannerInstance.render(
          (decodedText) => {
            setIsScanning(false);
            if (scannerInstance) scannerInstance.clear().catch(err => {});
            let scannedSubject = '';
            let scannedToken = decodedText;
            if (decodedText.startsWith("TRUSTATTENDANCE:")) {
              const parts = decodedText.split(":");
              scannedSubject = parts[1];
              scannedToken = parts[2];
            }
            submitAttendance(scannedSubject, scannedToken);
          },
          (errorMessage) => {}
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
      if (scannerInstance) scannerInstance.clear().catch(e => {});
    };
  }, [isScanning, activeTab]);

  const deviceBound = !!user.hardware_id;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Student Portal</h1>
          <p className="text-slate-400 mt-1">Batch {user.batch_year || 'N/A'} • {user.department || 'General'}</p>
        </div>
        <div className="flex gap-2">
          <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            deviceBound ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <Smartphone className="w-4 h-4" />
            {deviceBound ? 'Device Bound' : 'Device Unbound'}
          </div>
          <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            isOffline ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {isOffline ? 'Offline' : 'Online'}
          </div>
        </div>
      </header>

      <div className="flex gap-2">
        <button 
          onClick={() => { setActiveTab('scanner'); setIsScanning(false); setStatusMsg(null); }}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
        >
          <Camera className="w-4 h-4" /> QR Scanner
        </button>
        <button 
          onClick={() => { setActiveTab('history'); setIsScanning(false); setStatusMsg(null); }}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
        >
          <List className="w-4 h-4" /> My Records
        </button>
      </div>

      {activeTab === 'scanner' && (
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-sm p-8">
          
          {queueCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-400 flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Offline Queue: {queueCount}</p>
                <p className="text-amber-400/80 text-xs mt-1">Pending sync to server. Leave app open when Wi-Fi connects.</p>
              </div>
            </div>
          )}

          {isScanning ? (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scan Session QR</span>
                <button onClick={() => setIsScanning(false)} className="p-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div id="reader" className="overflow-hidden rounded-xl bg-black"></div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Mark Attendance</h3>
              <p className="text-slate-400 text-sm mb-8">Scan the dynamic QR code projected by your professor to cryptographically sign your attendance.</p>
              <button 
                onClick={() => { setStatusMsg(null); setIsScanning(true); }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Launch Camera Scanner
              </button>
            </div>
          )}

          {statusMsg && (
            <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 border animate-in slide-in-from-bottom-2 ${
              statusMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              statusMsg.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
              'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="font-medium leading-tight mt-0.5">{statusMsg.text}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm p-6 max-w-4xl">
          <h3 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" /> Verified Attendance Log
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider rounded-tl-xl">Subject</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider rounded-tr-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendanceHistory.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-slate-500">No records found.</td>
                  </tr>
                )}
                {attendanceHistory.map((record, idx) => {
                  const date = new Date(record.timestamp);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{record.subject_code}</div>
                        <div className="text-xs text-slate-400">{record.subject_name}</div>
                      </td>
                      <td className="p-4 text-sm text-slate-300">
                        {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
