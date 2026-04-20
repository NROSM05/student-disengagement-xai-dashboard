import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Activity, BrainCircuit, Sparkles, MessageSquareQuote, Loader2, RefreshCw, SlidersHorizontal, LogIn, UserPlus, ArrowRight, LogOut, Save, History, ClipboardList, Users, UserCircle, Search, Filter, User, Download, Fingerprint, ArrowUpDown, ChevronUp, ChevronDown, Mail, AlertTriangle, ExternalLink, Copy, AlertCircle } from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "final-year-project-b2b91.firebaseapp.com",
  projectId: "final-year-project-b2b91",
  storageBucket: "final-year-project-b2b91.firebasestorage.app",
  messagingSenderId: "415638311385",
  appId: "1:415638311385:web:c984b6861e1b00becf89c8",
  measurementId: "G-K8QXK5SZTC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const projectAppId = 'final-year-project-b2b91';

const App = () => {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // Data State
  const [cohort, setCohort] = useState([]);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'id_student', direction: 'asc' });
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);
  
  const [studentA, setStudentA] = useState({
    gender: 'M', region: 'London Region', highest_education: 'A Level', age_band: '0-35', total_clicks: 100, avg_score: 60.0
  });
  
  const [resultA, setResultA] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [intervention, setIntervention] = useState(null);
  const [error, setError] = useState(null);

  const [interventions, setInterventions] = useState([]);
  const [saving, setSaving] = useState(false);

  const cohortAverages = useMemo(() => {
    if (cohort.length === 0) return { clicks: 0, score: 0 };
    const clicks = cohort.reduce((acc, s) => acc + (s.total_clicks || 0), 0) / cohort.length;
    const score = cohort.reduce((acc, s) => acc + (s.avg_score || 0), 0) / cohort.length;
    return { clicks, score };
  }, [cohort]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (view === 'home' || view === 'auth') setView('cohort');
      } else {
        if (view !== 'home' && view !== 'auth') setView('home');
      }
    });
    return () => unsubscribe();
  }, [view]);

  useEffect(() => {
    if (user && (view === 'cohort' || view === 'dashboard')) {
      const fetchCohort = async () => {
        setCohortLoading(true);
        setError(null); // Clear previous errors
        try {
          const res = await axios.get('https://student-disengagement-xai-dashboard.onrender.com/students');
          setCohort(res.data);
        } catch (err) {
          setError("Connectivity Error: Backend server unreachable. Check if FastAPI is running on port 8000.");
          console.error("Backend offline.");
        } finally {
          setCohortLoading(false);
        }
      };
      fetchCohort();
    }
  }, [user, view]);

  const processedCohort = useMemo(() => {
    let items = [...cohort];
    if (filterRiskOnly) {
      items = items.filter(s => (s.avg_score < 45) || (s.total_clicks < 200));
    }
    if (sortConfig !== null) {
      items.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [cohort, sortConfig, filterRiskOnly]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', projectAppId, 'users', user.uid, 'interventions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInterventions(docs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
    }, (err) => console.error("Firestore Error:", err));
    return () => unsubscribe();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'staff_profiles', userCredential.user.uid), {
          email, role: 'University Staff', lastLogin: new Date().toISOString()
        });
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase:', '').trim());
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('https://student-disengagement-xai-dashboard.onrender.com/predict', studentA);
      setResultA(response.data);
    } catch (err) {
      setError("AI Model Server Offline. Please restart the Python backend.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIAssistance = async () => {
    if (!resultA) return;
    setGeminiLoading(true);
    setIntervention(null);
    const geminiKey = process.env.REACT_APP_GEMINI_API_KEY; 
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
      const listResponse = await fetch(listUrl);
      const listData = await listResponse.json();
      const supportedModel = listData.models?.find(m => m.supportedGenerationMethods.includes('generateContent'));
      const url = `https://generativelanguage.googleapis.com/v1beta/${supportedModel.name}:generateContent?key=${geminiKey}`;
      const prompt = `Act as a Senior Advisor at Kingston University. Brief a Professor on Student ${selectedId}: Prediction ${resultA.success_prediction}, Clicks ${studentA.total_clicks}, Score ${studentA.avg_score}%. Use third person. Focus on internal academic strategy.`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      setIntervention(data.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err) {
      setIntervention(`AI Issue: ${err.message}`);
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleEmailStudent = async () => {
  if (!resultA) return; // Guard clause
  setGeminiLoading(true);
  const geminiKey = process.env.REACT_APP_GEMINI_API_KEY; 

  try {
    // Dynamic Model Discovery (Matching the working 'Evaluate' logic)
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    // Find the first model that supports content generation
    const supportedModel = listData.models?.find(m => 
      m.supportedGenerationMethods.includes('generateContent')
    );

    if (!supportedModel) throw new Error("No compatible AI models found.");

    const url = `https://generativelanguage.googleapis.com/v1beta/${supportedModel.name}:generateContent?key=${geminiKey}`;
    
    const studentIdentifier = selectedId || "Simulator Case";
    const prompt = `Act as a Senior Academic Advisor at Kingston University. Draft a professional, supportive, and formal email template addressed TO the student (ID: ${studentIdentifier}). 
    Context: Prediction ${resultA.success_prediction}, Activity ${studentA.total_clicks} clicks, Performance ${studentA.avg_score}%. 
    Task: Write a clear email inviting them to a support tutorial. Output ONLY the email content.`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Generation Failed");
    
    setIntervention(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    setIntervention(`AI Email Draft Issue: ${err.message}`);
  } finally {
    setGeminiLoading(false);
  }
};

  const downloadReport = (data) => {
    const reportData = data?.studentMetrics ? data : { studentMetrics: studentA, strategy: intervention, prediction: resultA?.success_prediction };
    const content = `
KINGSTON UNIVERSITY - ACADEMIC INTERVENTION REPORT
--------------------------------------------------
Student ID: ${reportData.studentMetrics?.student_id || selectedId || 'N/A'}
Generated: ${new Date().toLocaleString()}
Staff: ${user?.email}

METRICS:
- AI Prediction: ${reportData.prediction}
- Engagement: ${reportData.studentMetrics?.total_clicks} clicks
- Avg Score: ${reportData.studentMetrics?.avg_score}%
- Region: ${reportData.studentMetrics?.region}

CONTENT:
${reportData.strategy}

--------------------------------------------------
CONFIDENTIAL
    `;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${reportData.studentMetrics?.student_id || 'Student'}.txt`;
    link.click();
  };

  const commitIntervention = async () => {
    if (!user || !intervention || !resultA) return;
    setSaving(true);
    try {
      const colRef = collection(db, 'artifacts', projectAppId, 'users', user.uid, 'interventions');
      await addDoc(colRef, {
        studentMetrics: { ...studentA, student_id: selectedId },
        prediction: resultA.success_prediction,
        probability: resultA.probability,
        strategy: intervention,
        timestamp: serverTimestamp(),
        status: 'Committed'
      });
      setView('history');
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setSaving(false);
    }
  };

  const reloadFromLog = (log) => {
    setSelectedId(log.studentMetrics?.student_id || 'Historical Case');
    setStudentA(log.studentMetrics);
    setResultA(null);
    setIntervention(log.strategy);
    setView('dashboard');
  };

  const loadStudentFromCohort = (s) => {
    setSelectedId(s.id_student);
    setStudentA({ 
      gender: s.gender || 'M',
      region: s.region || 'London Region',
      highest_education: s.highest_education || 'A Level',
      age_band: s.age_band || '0-35',
      total_clicks: s.total_clicks || 0,
      avg_score: s.avg_score || 0
    });
    setResultA(null);
    setIntervention(null);
    setView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (view === 'home') return <HomeView setView={setView} />;
  if (view === 'auth') return <AuthView handleAuth={handleAuth} isLogin={isLogin} setIsLogin={setIsLogin} authLoading={authLoading} authError={authError} setView={setView} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b px-8 py-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg"><BrainCircuit size={24} /></div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Staff Terminal <span className="text-blue-600 text-xs ml-1">v2.8</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setView('cohort')} className={`px-4 py-2 text-xs font-black transition rounded-xl flex items-center gap-2 ${view === 'cohort' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}><Users size={16}/> Classroom</button>
            <button onClick={() => setView('dashboard')} className={`px-4 py-2 text-xs font-black transition rounded-xl flex items-center gap-2 ${view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}><UserCircle size={16}/> Analysis</button>
            <button onClick={() => setView('history')} className={`px-4 py-2 text-xs font-black transition rounded-xl flex items-center gap-2 ${view === 'history' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}><History size={16}/> Logs</button>
            <button onClick={handleLogout} className="bg-slate-50 hover:bg-red-50 hover:text-red-500 p-2.5 rounded-xl text-slate-400 transition border border-slate-100 ml-4"><LogOut size={18} /></button>
        </div>
      </header>

      {/* TC03 Error Banner */}
      {error && (
        <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="bg-rose-500 p-2 rounded-xl text-white">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">System Warning</p>
            <p className="text-xs font-bold text-rose-800">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <main className="h-full overflow-y-auto p-8 lg:p-12 animate-in fade-in duration-500">
          <div className="max-w-6xl mx-auto">
            {view === 'cohort' && (
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none mb-2">OULAD Records</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Trends • Avg Score: {Math.round(cohortAverages.score)}%</p>
                  </div>
                  <button onClick={() => setFilterRiskOnly(!filterRiskOnly)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition shadow-sm border ${filterRiskOnly ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-slate-400 border-slate-200'}`}><AlertTriangle size={14}/> {filterRiskOnly ? 'Show All' : 'High Risk'}</button>
                </div>
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden">
                  {cohortLoading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30"><Loader2 className="animate-spin" size={40}/><p className="text-[10px] font-black uppercase tracking-widest">Syncing Records...</p></div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="px-8 py-5 cursor-pointer" onClick={() => requestSort('id_student')}>ID {getSortIcon('id_student')}</th>
                          <th className="px-8 py-5 cursor-pointer" onClick={() => requestSort('total_clicks')}>Activity {getSortIcon('total_clicks')}</th>
                          <th className="px-8 py-5 cursor-pointer" onClick={() => requestSort('avg_score')}>Grade {getSortIcon('avg_score')}</th>
                          <th className="px-8 py-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {processedCohort.map((s) => (
                          <tr key={s.id_student} className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => loadStudentFromCohort(s)}>
                            <td className="px-8 py-6 font-black text-sm">{s.id_student}</td>
                            <td className="px-8 py-6 font-black text-xs text-blue-600">{s.total_clicks} Clicks</td>
                            <td className="px-8 py-6 font-black text-xs">{Math.round(s.avg_score)}%</td>
                            <td className="px-8 py-6 text-right"><button className="text-blue-600 font-black text-[10px] uppercase hover:underline">Select</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {view === 'dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 relative">
                    {selectedId && (
                        <div className="absolute top-8 right-8 flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            <Fingerprint size={12}/><span className="text-[10px] font-black">{selectedId}</span>
                        </div>
                    )}
                    <h2 className="text-sm font-black mb-8 uppercase tracking-widest flex items-center gap-3 text-slate-400"><SlidersHorizontal size={16} /> Parameters</h2>
                    <StudentForm data={studentA} setData={setStudentA} />
                    <button onClick={handleAnalyze} className="w-full mt-10 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-3" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin" /> : <Activity size={20} />} RUN AI MODEL
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-8">
                  {resultA ? (
                    <>
                      <ResultCard result={resultA} />
                      <XAIChart result={resultA} />
                      <div className="bg-slate-900 rounded-[40px] p-10 shadow-2xl relative overflow-hidden text-white">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h4 className="font-black uppercase text-xs tracking-[0.3em] text-blue-400 flex items-center gap-3"><Sparkles size={18} /> Advisor Protocol</h4>
                            <div className="flex gap-2">
                                {intervention && (
                                    <>
                                        <button onClick={handleEmailStudent} className="bg-blue-500/20 hover:bg-blue-500/40 p-2 rounded-full transition text-blue-400 group relative" title="Generate Email Draft"><Mail size={16} /></button>
                                        <button onClick={() => downloadReport({})} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white" title="Download Report"><Download size={16} /></button>
                                    </>
                                )}
                                {!geminiLoading && <button onClick={generateAIAssistance} className="bg-white/10 hover:bg-white/20 px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition">RE-EVALUATE</button>}
                            </div>
                        </div>
                        {geminiLoading ? (
                            <div className="py-20 flex flex-col items-center gap-6 text-blue-400 font-bold"><Loader2 className="animate-spin" size={40}/><p className="text-[10px] uppercase tracking-widest">Synthesizing Advice...</p></div>
                        ) : intervention ? (
                            <div className="animate-in fade-in duration-700">
                                <div className="bg-white/5 p-8 rounded-3xl text-sm italic border border-white/10 mb-8 whitespace-pre-line leading-relaxed">{intervention}</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={commitIntervention} disabled={saving} className="py-4 rounded-2xl font-black text-xs tracking-widest bg-blue-600 hover:bg-blue-500 shadow-xl flex items-center justify-center gap-3 transition active:scale-95">
                                        {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} LOG CASE
                                    </button>
                                    <button onClick={handleEmailStudent} className="py-4 rounded-2xl font-black text-xs tracking-widest bg-white/10 hover:bg-white/20 flex items-center justify-center gap-3 transition active:scale-95"><Mail size={16}/> DRAFT EMAIL</button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30 text-[10px] uppercase font-black tracking-[0.4em]">Consult AI Advisor</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-20">
                        <BrainCircuit size={64} className="mb-6 opacity-20" />
                        <p className="text-xs font-black uppercase tracking-widest">Student {selectedId} Loaded - Run Model</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'history' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-black tracking-tighter text-slate-900">Institutional Caseload</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {interventions.map((item) => (
                        <div key={item.id} className="bg-white p-8 rounded-3xl border border-slate-100 hover:shadow-lg transition group cursor-pointer relative overflow-hidden" onClick={() => reloadFromLog(item)}>
                            <div className="absolute top-0 right-0 p-4 flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); downloadReport(item); }} className="opacity-0 group-hover:opacity-100 transition p-2 bg-slate-100 rounded-lg hover:bg-blue-50 hover:text-blue-600"><Download size={14}/></button>
                                <div className="p-2 opacity-0 group-hover:opacity-100 transition"><ExternalLink size={16} className="text-blue-500" /></div>
                            </div>
                            <div className="flex justify-between items-start mb-6">
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full text-white ${item.prediction === 'Pass' ? 'bg-emerald-500' : 'bg-rose-500'}`}>{item.prediction} Outcome</span>
                                <span className="text-[9px] font-bold text-slate-300 uppercase">{item.timestamp?.toDate().toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs italic leading-relaxed text-slate-600 border-l-4 border-blue-100 pl-4 mb-6 line-clamp-4">{item.strategy}</p>
                            <div className="flex items-center justify-between border-t pt-6 text-[10px] font-black text-slate-400">
                                <div className="flex items-center gap-2"><Fingerprint size={14}/> ID: {item.studentMetrics?.student_id || 'Unknown'}</div>
                                <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition font-black uppercase text-[8px]">Reload Case</span>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const HomeView = ({ setView }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
    <div className="bg-blue-600 p-5 rounded-[2.5rem] text-white shadow-2xl mb-10 transform -rotate-6"><BrainCircuit size={60} /></div>
    <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 text-slate-900 leading-tight">Intelligence-Led <br/><span className="text-blue-600 underline decoration-blue-200 underline-offset-8 uppercase">Early Warning.</span></h1>
    <button onClick={() => setView('auth')} className="bg-slate-900 hover:bg-slate-800 text-white px-12 py-6 rounded-3xl font-black text-xl shadow-2xl transition flex items-center gap-4">Access Faculty Portal <ArrowRight /></button>
  </div>
);

const AuthView = ({ handleAuth, isLogin, setIsLogin, authLoading, authError, setView }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
    <button onClick={() => setView('home')} className="mb-10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition">← Back Home</button>
    <form onSubmit={handleAuth} className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-100">
      <h2 className="text-3xl font-black mb-8 tracking-tighter text-slate-900 text-left">{isLogin ? "Staff Credentials" : "Initialize Account"}</h2>
      <div className="space-y-6 text-left">
        <input name="email" type="email" placeholder="staff@kingston.ac.uk" className="w-full p-5 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none font-bold shadow-inner transition" required />
        <input name="password" type="password" placeholder="••••••••" className="w-full p-5 bg-slate-50 rounded-2xl ring-1 ring-slate-200 outline-none font-bold shadow-inner transition" required />
        {authError && <p className="text-center text-xs font-black text-rose-500 uppercase leading-relaxed">{authError}</p>}
        <button className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 flex items-center justify-center gap-3">
          {authLoading ? <Loader2 className="animate-spin" /> : (isLogin ? <LogIn /> : <UserPlus />)} {isLogin ? "SIGN IN" : "REGISTER"}
        </button>
      </div>
      <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full mt-10 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition">{isLogin ? "New Faculty Member? Create Account" : "Log In"}</button>
    </form>
  </div>
);

const StudentForm = ({ data, setData }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 text-left">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">VLE Clicks</label>
        <input type="number" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 font-bold shadow-inner transition" value={data.total_clicks} onChange={(e) => setData({ ...data, total_clicks: parseInt(e.target.value) || 0 })} />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Exam Avg (%)</label>
        <input type="number" className="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 font-bold shadow-inner transition" value={data.avg_score} onChange={(e) => setData({ ...data, avg_score: parseFloat(e.target.value) || 0 })} />
      </div>
    </div>
    <div className="space-y-2 text-left">
      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Geography</label>
      <select className="w-full p-5 bg-slate-50 rounded-2xl ring-1 ring-slate-200 font-bold text-xs shadow-inner" value={data.region} onChange={(e) => setData({ ...data, region: e.target.value })}><option>London Region</option><option>Scotland</option><option>Wales</option><option>Ireland</option><option>North Western Region</option></select>
    </div>
  </div>
);

const ResultCard = ({ result }) => {
  const isPass = result.success_prediction === 'Pass';
  return (
    <div className={`p-10 rounded-[3rem] border shadow-2xl transition-all duration-700 ${isPass ? 'bg-emerald-50 border-emerald-200 shadow-emerald-100/20' : 'bg-rose-50 border-rose-200 shadow-rose-100/20'}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Algorithmic Output</h3>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase text-white ${isPass ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-rose-500 shadow-lg shadow-rose-200'}`}>{isPass ? 'Success Predicted' : 'At Risk'}</div>
      </div>
      <div className="flex justify-between items-end">
        <div><p className={`text-8xl font-black tracking-tighter leading-none ${isPass ? 'text-emerald-800' : 'text-rose-800'}`}>{result.success_prediction}</p></div>
        <div className="text-right">
          <p className="text-5xl font-black text-slate-900 leading-none">{Math.round(result.probability * 100)}%</p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Confidence Level</p>
        </div>
      </div>
    </div>
  );
};

const XAIChart = ({ result }) => {
  const labelMap = { 'total_clicks': 'Activity', 'avg_score': 'Performance' };
  const data = Object.entries(result.feature_importance).map(([name, value]) => ({
    name: labelMap[name] || name.replace('highest_education_', '').replace('region_', '').replace('_', ' ').replace('age band', 'Age'),
    value
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5);

  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl h-80 overflow-hidden relative">
      <div className="flex justify-between items-center mb-10">
        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3"><Activity size={18} className="text-blue-500" /> Decision Drivers</h4>
        <span className="text-[9px] font-bold text-slate-300 uppercase underline decoration-blue-100 decoration-4 italic">Benchmarking Enabled</span>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
              {data.map((entry, index) => <Cell key={index} fill={entry.value > 0 ? '#10b981' : '#f43f5e'} />)}
            </Bar>
            <ReferenceLine x={0} stroke="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default App;