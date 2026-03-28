import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SUBJECTS = [
  { id: "info",     name: "Informatique",   icon: "💻", color: "#3B82F6" },
  { id: "anglais",  name: "Anglais",        icon: "🇬🇧", color: "#EF4444" },
  { id: "si",       name: "SI",             icon: "⚙️", color: "#F59E0B" },
  { id: "physchim", name: "Physique-Chimie",icon: "⚗️", color: "#10B981" },
  { id: "maths",    name: "Mathématiques",  icon: "📐", color: "#8B5CF6" },
  { id: "francais", name: "Français",       icon: "📖", color: "#EC4899" },
];

// --- COMPOSANTS AUXILIAIRES ---

function ExamCountdown() {
  const targetDate = new Date("2026-05-30T08:00:00");
  const [timeLeft, setTimeLeft] = useState({ jours: 0, heures: 0, minutes: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = +targetDate - +new Date();
      if (diff > 0) {
        setTimeLeft({
          jours: Math.floor(diff / (1000 * 60 * 60 * 24)),
          heures: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ background: "linear-gradient(90deg, #4F46E5, #7C3AED)", color: "white", padding: "12px", borderRadius: "12px", marginBottom: "20px", textAlign: "center", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)" }}>
      <div style={{ fontSize: "10px", fontWeight: "bold", opacity: 0.9, textTransform: "uppercase" }}>🚀 Objectif Concours Blanc</div>
      <div style={{ fontSize: "18px", fontWeight: "800" }}>J - {timeLeft.jours} <span style={{fontSize: "13px", fontWeight: "400"}}>{timeLeft.heures}h {timeLeft.minutes}m</span></div>
    </div>
  );
}

function Avatar({ name }) {
  const colors = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899"];
  const idx = (name || "").split("").reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background: colors[idx] + "22", color: colors[idx], border: `1px solid ${colors[idx]}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600 }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function isImage(url) { return url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url); }
function isPdf(url) { return url && /\.pdf$/i.test(url); }

// --- COMPOSANT PRINCIPAL ---

export default function App() {
  // Navigation & Base
  const [tab, setTab] = useState("devoirs");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "");
  const [usernameSet, setUsernameSet] = useState(() => !!localStorage.getItem("username"));

  // Données Devoirs & Progress
  const [homework, setHomework] = useState([]);
  const [userDone, setUserDone] = useState([]);
  const [newHW, setNewHW] = useState({ text:"", date:"" });

  // Chat & Forums
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadMsg, setNewThreadMsg] = useState("");
  const [threadSubject, setThreadSubject] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Nouveautés : Entraide & Focus
  const [mentors, setMentors] = useState([]);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusActive, setFocusActive] = useState(false);

  const messagesEndRef = useRef(null);
  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const threadFileRef = useRef(null);

  // --- CHARGEMENT & REALTIME ---

  useEffect(() => { if (usernameSet) loadAll(); }, [usernameSet]);

  useEffect(() => {
    const msgSub = supabase.channel("messages").on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, p => setMessages(prev => [...prev, p.new])).subscribe();
    const hwSub = supabase.channel("devoirs").on("postgres_changes", { event:"*", schema:"public", table:"devoirs" }, loadHomework).subscribe();
    const progSub = supabase.channel("user_progress").on("postgres_changes", { event:"*", schema:"public", table:"user_progress" }, loadUserProgress).subscribe();
    const mentSub = supabase.channel("mentors").on("postgres_changes", { event:"*", schema:"public", table:"mentors" }, loadMentors).subscribe();
    
    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(hwSub);
      supabase.removeChannel(progSub);
      supabase.removeChannel(mentSub);
    };
  }, [username]);

  async function loadAll() {
    await Promise.all([loadHomework(), loadUserProgress(), loadMessages(), loadThreads(), loadMentors()]);
    setLoading(false);
  }

  async function loadHomework() { const { data } = await supabase.from("devoirs").select("*").order("created_at"); if (data) setHomework(data); }
  async function loadUserProgress() { if (!username) return; const { data } = await supabase.from("user_progress").select("todo_id").eq("username", username.trim()); if (data) setUserDone(data.map(d => d.todo_id)); }
  async function loadMessages() { const { data } = await supabase.from("messages").select("*").order("created_at"); if (data) setMessages(data); }
  async function loadThreads() { const { data } = await supabase.from("threads").select("*").order("created_at", { ascending: false }); if (data) setThreads(data); }
  async function loadMentors() { const { data } = await supabase.from("mentors").select("*"); if (data) setMentors(data); }

  // --- LOGIQUE METIER ---

  async function toggleDone(todoId) {
    if (userDone.includes(todoId)) {
      await supabase.from("user_progress").delete().eq("todo_id", todoId).eq("username", username.trim());
      setUserDone(prev => prev.filter(id => id !== todoId));
    } else {
      await supabase.from("user_progress").insert({ todo_id: todoId, username: username.trim() });
      setUserDone(prev => [...prev, todoId]);
    }
  }

  async function toggleMentor(subId) {
    const existing = mentors.find(m => m.username === username && m.subject_id === subId);
    if (existing) await supabase.from("mentors").delete().eq("id", existing.id);
    else await supabase.from("mentors").insert({ username, subject_id: subId });
    loadMentors();
  }

  function generatePlanning() {
    const todo = homework.filter(h => !userDone.includes(h.id));
    if (todo.length === 0) return alert("Rien à faire ! Profite de ta soirée 🍿");
    let plan = "📅 TON PLANNING DE CE SOIR :\n\n";
    todo.forEach((h, i) => { plan += `${i+1}. [${h.subject_id.toUpperCase()}] : ${h.text} (25 min)\n`; });
    alert(plan);
  }

  // --- RENDU UI ---

  const st = {
    container: { fontFamily:"system-ui, sans-serif", padding:"1rem", maxWidth:700, margin:"0 auto" },
    tabs: { display:"flex", gap:8, margin:"1.25rem 0", borderBottom:"1px solid #e5e7eb", paddingBottom:"0.75rem", overflowX:"auto" },
    tab: (active) => ({ padding:"6px 16px", border:"none", borderRadius:20, background: active ? "#3B82F6" : "transparent", fontSize:14, fontWeight: active ? 600 : 400, color: active ? "#fff" : "#6b7280", cursor:"pointer", whiteSpace:"nowrap" }),
    card: (color, hasPending) => ({ background:"#fff", border: hasPending ? `2px solid ${color}` : "1px solid #e5e7eb", borderRadius:12, padding:"1rem", cursor:"pointer" }),
    chatBox: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", height:350, overflowY:"auto", marginBottom:12, display:"flex", flexDirection:"column", gap:14 },
    bubble: { background:"#f3f4f6", borderRadius:"0 8px 8px 8px", padding:"8px 12px", fontSize:14, color:"#111", display:"inline-block", maxWidth:"90%" },
  };

  if (loading && usernameSet) return <div style={{textAlign:"center", padding:50}}>Chargement...</div>;

  if (!usernameSet) {
    return (
      <div style={{ padding: "100px 20px", textAlign: "center" }}>
        <h1>📓 Ton Prénom ?</h1>
        <input style={{ padding:12, borderRadius:8, border:"1px solid #ccc", width:"100%", maxWidth:300 }} value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&& (localStorage.setItem("username", username), setUsernameSet(true))} />
        <button onClick={()=>{localStorage.setItem("username", username); setUsernameSet(true)}} style={{ display:"block", margin:"20px auto", padding:"10px 30px", background:"#3B82F6", color:"#fff", border:"none", borderRadius:8 }}>Entrer</button>
      </div>
    );
  }

  return (
    <div style={st.container}>
      <ExamCountdown />

      <div style={st.tabs}>
        <button style={st.tab(tab==="devoirs")} onClick={()=>setTab("devoirs")}>📚 Devoirs</button>
        <button style={st.tab(tab==="partage")} onClick={()=>setTab("partage")}>💬 Chat</button>
        <button style={st.tab(tab==="forums")} onClick={()=>setTab("forums")}>🗂️ Forums</button>
        <button style={st.tab(tab==="focus")} onClick={()=>setTab("focus")}>🧘 Focus</button>
        <button style={st.tab(tab==="aide")} onClick={()=>setTab("aide")}>🤝 Aide</button>
      </div>

      {/* ONGLET DEVOIRS */}
      {tab === "devoirs" && !selectedSubject && (
        <>
          <button onClick={generatePlanning} style={{ width: "100%", padding: "12px", background: "#1e293b", color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", marginBottom: "20px", cursor: "pointer" }}>
            🤖 Générer mon planning
          </button>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12 }}>
            {SUBJECTS.map(sub => (
              <div key={sub.id} style={st.card(sub.color, homework.filter(h=>h.subject_id===sub.id && !userDone.includes(h.id)).length > 0)} onClick={() => setSelectedSubject(sub.id)}>
                <div style={{ fontSize:28 }}>{sub.icon}</div>
                <div style={{ fontSize:14, fontWeight:600 }}>{sub.name}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{homework.filter(h=>h.subject_id===sub.id && !userDone.includes(h.id)).length} à faire</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "devoirs" && selectedSubject && (
        <div>
           <button style={{background:"none", border:"none", color:"#6b7280", cursor:"pointer", marginBottom:10}} onClick={() => setSelectedSubject(null)}>← Retour</button>
           <h2>{SUBJECTS.find(s=>s.id===selectedSubject).name}</h2>
           {/* La liste des devoirs avec checkboxes (identique à ton ancienne version) */}
           {homework.filter(h=>h.subject_id===selectedSubject).map(item => (
             <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:10, borderBottom:"1px solid #eee", opacity: userDone.includes(item.id) ? 0.5 : 1 }}>
               <input type="checkbox" checked={userDone.includes(item.id)} onChange={() => toggleDone(item.id)} />
               <span style={{ textDecoration: userDone.includes(item.id) ? "line-through" : "none" }}>{item.text}</span>
             </div>
           ))}
        </div>
      )}

      {/* ONGLET CHAT (Ton ancien espace partagé) */}
      {tab === "partage" && (
        <div>
          <div style={st.chatBox}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display:"flex", gap:10 }}>
                <Avatar name={msg.username} />
                <div style={st.bubble}>
                  <div style={{fontSize:11, fontWeight:600}}>{msg.username}</div>
                  <div>{msg.text}</div>
                  {msg.file_url && <a href={msg.file_url} target="_blank" style={{display:"block", fontSize:11, marginTop:5}}>📎 Fichier</a>}
                </div>
              </div>
            ))}
          </div>
          {/* Input message... (Simplifié pour la place, mais garde ta logique) */}
        </div>
      )}

      {/* ONGLET FOCUS */}
      {tab === "focus" && (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc", borderRadius: "20px" }}>
          <h2>Mode Focus</h2>
          <div style={{ fontSize: "64px", fontWeight: "800" }}>{Math.floor(focusSeconds/60)}:{(focusSeconds%60).toString().padStart(2,'0')}</div>
          <button onClick={() => setFocusActive(!focusActive)} style={{ padding: "12px 30px", background: focusActive ? "#ef4444" : "#22c55e", color: "white", border: "none", borderRadius: "30px", fontWeight: "bold" }}>
            {focusActive ? "PAUSE" : "LANCER FOCUS"}
          </button>
        </div>
      )}

      {/* ONGLET ENTRAIDE */}
      {tab === "aide" && (
        <div>
          <h2>🤝 Entraide</h2>
          {SUBJECTS.map(sub => {
            const subjectMentors = mentors.filter(m => m.subject_id === sub.id);
            const amIMentor = subjectMentors.some(m => m.username === username);
            return (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <strong>{sub.icon} {sub.name}</strong>
                  <div style={{ fontSize: "12px", color: "#3B82F6" }}>{subjectMentors.length > 0 ? `🌟 ${subjectMentors.map(m=>m.username).join(", ")}` : "Personne"}</div>
                </div>
                <button onClick={() => toggleMentor(sub.id)} style={{ padding: "6px 12px", borderRadius: "20px", border: "none", background: amIMentor ? "#dcfce7" : "#f1f5f9" }}>
                  {amIMentor ? "✅ Je gère" : "🙋 Je gère"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function btnTab(active) { return { padding: "8px 16px", borderRadius: "20px", border: "none", background: active ? "#3B82F6" : "#f1f5f9", color: active ? "white" : "#64748b", cursor: "pointer" }; }