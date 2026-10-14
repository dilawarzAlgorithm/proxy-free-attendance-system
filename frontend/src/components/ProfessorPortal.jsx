import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Settings, RefreshCw, CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react';
import { api, getWsUrl } from '../api';

export default function ProfessorPortal({ user }) {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [currentToken, setCurrentToken] = useState('------');
  const [timer, setTimer] = useState(5);
  const [liveHeadcount, setLiveHeadcount] = useState([]);
  
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Fetch subjects assigned to this professor
    api.get('/admin/subjects').then(res => {
      const mySubs = res.data.filter(s => s.professor_id === user.id);
      setSubjects(mySubs);
      if (mySubs.length > 0) setSelectedSubject(mySubs[0].code);
    }).catch(err => console.error(err));
  }, [user.id]);

  const startSession = async () => {
    if (!selectedSubject) return alert("Please select a subject.");
    try {
      await api.post('/session/start', {
        subject_code: selectedSubject,
        professor_id: user.id
      });
      setSessionActive(true);
      connectWebSocket(selectedSubject);
    } catch (err) {
      alert("Failed to start session");
    }
  };

  const connectWebSocket = (code) => {
    wsRef.current = new WebSocket(getWsUrl(code));
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_ATTENDANCE') {
        setLiveHeadcount(prev => [...prev, data]);
      }
    };
  };

  const fetchLiveToken = async () => {
    try {
      const res = await api.get(`/session/token/${selectedSubject}`);
      setCurrentToken(res.data.token);
    } catch (err) {
      console.error(err);
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

  const downloadExport = async () => {
    try {
      const response = await api.get(`/professor/export/${selectedSubject}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedSubject}_attendance.csv`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      alert("Failed to download export spreadsheet");
    }
  };

  const qrData = `TRUSTATTENDANCE:${selectedSubject}:${currentToken}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Lecturer Portal</h1>
          <p className="text-slate-400 mt-1">Manage active sessions and real-time attendance.</p>
        </div>
        {!sessionActive && subjects.length > 0 && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <select 
              value={selectedSubject} 
              onChange={e => setSelectedSubject(e.target.value)}
              className="bg-transparent text-white font-semibold text-sm pl-2 pr-8 outline-none border-r border-slate-800"
            >
              {subjects.map(s => <option key={s.id} value={s.code} className="bg-slate-900">{s.code} - {s.name}</option>)}
            </select>
            <button onClick={startSession} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors">
              Launch Session
            </button>
          </div>
        )}
      </header>

      {!sessionActive ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl shadow-sm text-center max-w-2xl mx-auto flex flex-col items-center">
          <Settings className="w-16 h-16 text-indigo-500/50 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">No Active Session</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {subjects.length > 0 
              ? "Select a subject from the top right and launch a session to project the dynamic QR code to your students."
              : "You have no subjects assigned. Contact the administrator to allocate subjects to your account."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-8 md:p-12 rounded-3xl shadow-sm flex flex-col items-center justify-center relative min-h-[500px]">
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {selectedSubject} LIVE
            </div>
            
            <button 
              onClick={() => setSessionActive(false)}
              className="absolute top-6 right-6 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> End Session
            </button>

            <div className="bg-white p-6 rounded-3xl mb-8 shadow-2xl">
              <QRCodeSVG 
                value={qrData} 
                size={300} 
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Dynamic Token</p>
              <div className="text-6xl font-mono font-black text-white tracking-widest tabular-nums">{currentToken}</div>
            </div>

            <div className="mt-8 flex items-center gap-2 bg-slate-950 border border-slate-800 px-5 py-2.5 rounded-full text-sm font-medium text-slate-300">
              <RefreshCw className={`w-4 h-4 text-indigo-400 ${timer === 1 ? 'animate-spin' : ''}`} /> 
              <span>Regenerating in <strong className="text-white font-mono tabular-nums">{timer}s</strong></span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm p-6 flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-white">Live Roster</h3>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full">{liveHeadcount.length} Verified</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px]">
              {liveHeadcount.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  Waiting for student scans...
                </div>
              ) : (
                liveHeadcount.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex justify-between items-center animate-in slide-in-from-right-4">
                    <div>
                      <div className="font-semibold text-white text-sm">{item.student_name}</div>
                      <div className="text-xs text-slate-500">ID: {item.student_id}</div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              <button 
                onClick={downloadExport}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-xl font-bold text-sm transition-colors border border-slate-700 flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export CSV Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
