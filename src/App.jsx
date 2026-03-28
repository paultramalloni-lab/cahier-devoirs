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

function Avatar({ name }) {
  const colors = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899"];
  const idx = (name || "").split("").reduce((a,c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div style={{
      width:32, height:32, borderRadius:"50%", flexShrink:0,
      background: colors[idx] + "22", color: colors[idx],
      border: `1px solid ${colors[idx]}44`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:13, fontWeight:600
    }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function isImage(url) { return url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url); }
function isPdf(url) { return url && /\.pdf$/i.test(url); }

export default function App() {
  const [tab, setTab] = useState("devoirs");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [homework, setHomework] = useState([]);
  const [userDone, setUserDone] = useState([]); // Nouveau : stocke les IDs des devoirs faits par l'utilisateur
  const [messages, setMessages] = useState([]);
  const [newHW, setNewHW] = useState({ text:"", date:"" });
  const [newMsg, setNewMsg] = useState("");
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "");
  const [usernameSet, setUsernameSet] = useState(() => !!localStorage.getItem("username"));
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadMsg, setNewThreadMsg] = useState("");
  const [threadSubject, setThreadSubject] = useState(null);

  const messagesEndRef = useRef(null);
  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const threadFileRef = useRef(null);

  useEffect(() => { loadAll(); }, [usernameSet]); // Recharge si le nom change

  useEffect(() => {
    const channel = supabase.channel("messages")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, payload => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (!selectedThread) return;
    const channel = supabase.channel("thread_messages")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"thread_messages" }, payload => {
        if (payload.new.thread_id === selectedThread.id) {
          setThreadMessages(prev => [...prev, payload.new]);
          setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedThread]);

  useEffect(() => {
    const channel = supabase.channel("devoirs")
      .on("postgres_changes", { event:"*", schema:"public", table:"devoirs" }, () => loadHomework())
      .subscribe();
    const progressChannel = supabase.channel("user_progress")
      .on("postgres_changes", { event:"*", schema:"public", table:"user_progress" }, () => loadUserProgress())
      .subscribe();
    return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(progressChannel);
    };
  }, [username]);

  async function loadAll() {
    await Promise.all([loadHomework(), loadUserProgress(), loadMessages(), loadThreads()]);
    setLoading(false);
  }

  async function loadHomework() {
    const { data } = await supabase.from("devoirs").select("*").order("created_at");
    if (data) setHomework(data);
  }

  async function loadUserProgress() {
    if (!username) return;
    const { data } = await supabase.from("user_progress").select("todo_id").eq("username", username.trim());
    if (data) setUserDone(data.map(d => d.todo_id));
  }

  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*").order("created_at");
    if (data) setMessages(data);
  }

  async function loadThreads() {
    const { data } = await supabase.from("threads").select("*").order("created_at", { ascending: false });
    if (data) setThreads(data);
  }

  async function loadThreadMessages(threadId) {
    const { data } = await supabase.from("thread_messages").select("*").eq("thread_id", threadId).order("created_at");
    if (data) setThreadMessages(data);
  }

  async function openThread(thread) {
    setSelectedThread(thread);
    await loadThreadMessages(thread.id);
  }

  async function createThread() {
    if (!newThreadTitle.trim() || !threadSubject) return;
    const { data } = await supabase.from("threads").insert({
      subject_id: threadSubject,
      title: newThreadTitle.trim(),
      created_by: username.trim() || "Anonyme",
    }).select().single();
    if (data) {
      setThreads(prev => [data, ...prev]);
      setNewThreadTitle("");
      setShowNewThread(false);
      openThread(data);
    }
  }

  async function sendThreadMessage(fileUrl = null, fileName = null) {
    const text = newThreadMsg.trim();
    if (!text && !fileUrl) return;
    const now = new Date();
    const time = now.toLocaleString("fr-FR", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" });
    await supabase.from("thread_messages").insert({
      thread_id: selectedThread.id,
      username: username.trim() || "Anonyme",
      text: text || "",
      time,
      file_url: fileUrl || null,
      file_name: fileName || null,
    });
    setNewThreadMsg("");
  }

  async function addHomework() {
    if (!newHW.text.trim() || !selectedSubject) return;
    await supabase.from("devoirs").insert({
      subject_id: selectedSubject,
      text: newHW.text.trim(),
      date: newHW.date || null,
      done: false,
      added_by: username.trim() || "Anonyme",
    });
    setNewHW({ text:"", date:"" });
  }

  // MODIFIÉ : Gère la coche individuelle dans user_progress
  async function toggleDone(todoId) {
    if (userDone.includes(todoId)) {
      await supabase.from("user_progress").delete().eq("todo_id", todoId).eq("username", username.trim());
      setUserDone(prev => prev.filter(id => id !== todoId));
    } else {
      await supabase.from("user_progress").insert({ todo_id: todoId, username: username.trim() });
      setUserDone(prev => [...prev, todoId]);
    }
  }

  async function deleteHW(id) {
    await supabase.from("devoirs").delete().eq("id", id);
    // On nettoie aussi les coches liées pour éviter de polluer la base
    await supabase.from("user_progress").delete().eq("todo_id", id);
    setHomework(prev => prev.filter(h => h.id !== id));
  }

  async function sendMessage(fileUrl = null, fileName = null) {
    const text = newMsg.trim();
    if (!text && !fileUrl) return;
    const now = new Date();
    const time = now.toLocaleString("fr-FR", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" });
    await supabase.from("messages").insert({
      username: username.trim() || "Anonyme",
      text: text || "",
      time,
      file_url: fileUrl || null,
      file_name: fileName || null,
    });
    setNewMsg("");
  }

  async function handleFileUpload(e, isThread = false) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("corrections").upload(fileName, file, { cacheControl:"3600", upsert:false });
    if (error) { alert("Erreur upload : " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("corrections").getPublicUrl(fileName);
    if (isThread) await sendThreadMessage(urlData.publicUrl, file.name);
    else await sendMessage(urlData.publicUrl, file.name);
    setUploading(false);
    e.target.value = "";
  }

  function renderFile(url, name) {
    if (!url) return null;
    if (isImage(url)) return <img src={url} alt={name} style={{ maxWidth:260, maxHeight:200, borderRadius:8, border:"1px solid #e5e7eb", cursor:"pointer", marginTop:6, display:"block" }} onClick={() => window.open(url, "_blank")} />;
    if (isPdf(url)) return <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#fee2e2", color:"#dc2626", borderRadius:8, fontSize:13, textDecoration:"none", marginTop:6 }}>📄 {name || "Fichier PDF"}</a>;
    return <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", background:"#f3f4f6", color:"#374151", borderRadius:8, fontSize:13, textDecoration:"none", marginTop:6 }}>📎 {name || "Fichier"}</a>;
  }

  const hwForSubject = id => homework.filter(h => h.subject_id === id);
  // MODIFIÉ : Calcule les devoirs en attente en fonction des coches de l'utilisateur
  const pending = id => hwForSubject(id).filter(h => !userDone.includes(h.id)).length;
  const totalPending = SUBJECTS.reduce((a, s) => a + pending(s.id), 0);
  const subject = SUBJECTS.find(s => s.id === selectedSubject);
  const threadsForSubject = id => threads.filter(t => t.subject_id === id);

  const st = {
    container: { fontFamily:"system-ui, sans-serif", padding:"1rem", maxWidth:700, margin:"0 auto" },
    h1: { margin:"0 0 4px", fontSize:20, fontWeight:600 },
    subtitle: { margin:0, fontSize:13, color:"#888" },
    tabs: { display:"flex", gap:8, margin:"1.25rem 0", borderBottom:"1px solid #e5e7eb", paddingBottom:"0.75rem", flexWrap:"wrap" },
    tab: (active) => ({ padding:"6px 16px", border:"1px solid " + (active ? "#d1d5db" : "#e5e7eb"), borderRadius:8, background: active ? "#fff" : "transparent", fontSize:14, fontWeight: active ? 500 : 400, color: active ? "#111" : "#888", cursor:"pointer" }),
    grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12 },
    card: (color, hasPending) => ({ background:"#fff", border: hasPending ? `2px solid ${color}` : "1px solid #e5e7eb", borderRadius:12, padding:"1rem", cursor:"pointer", transition:"box-shadow 0.15s" }),
    badge: (color, hasPending) => ({ display:"inline-block", fontSize:11, padding:"2px 8px", borderRadius:6, marginTop:8, background: hasPending ? color + "18" : "#f3f4f6", color: hasPending ? color : "#9ca3af" }),
    backBtn: { background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:13, padding:0, marginBottom:"1rem" },
    formBox: { background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" },
    row: { display:"flex", gap:8, flexWrap:"wrap", marginTop:10 },
    input: { flex:"2 1 200px", padding:"8px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" },
    inputSm: { flex:"1 1 130px", padding:"8px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" },
    btn: (color="#111") => ({ padding:"8px 16px", border:"1px solid #d1d5db", borderRadius:8, background:"#fff", color, fontSize:14, cursor:"pointer", fontWeight:500 }),
    hwItem: (done) => ({ display:"flex", alignItems:"center", gap:12, background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 12px", opacity: done ? 0.5 : 1 }),
    delBtn: { padding:"4px 8px", border:"none", borderRadius:6, background:"#fee2e2", color:"#dc2626", fontSize:11, cursor:"pointer" },
    chatBox: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", minHeight:280, maxHeight:400, overflowY:"auto", marginBottom:12, display:"flex", flexDirection:"column", gap:14 },
    bubble: { background:"#f3f4f6", borderRadius:"0 8px 8px 8px", padding:"8px 12px", fontSize:14, color:"#111", display:"inline-block", maxWidth:"90%", lineHeight:1.5, whiteSpace:"pre-wrap", wordBreak:"break-word" },
    userBox: { background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", marginBottom:"1.25rem" },
    uploadBtn: { padding:"8px 12px", border:"1px solid #d1d5db", borderRadius:8, background:"#fff", fontSize:14, cursor:"pointer", color:"#6b7280" },
    threadCard: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"box-shadow 0.15s" },
    subjectPill: (color, active) => ({ padding:"5px 12px", borderRadius:20, border: active ? `2px solid ${color}` : "1px solid #e5e7eb", background: active ? color + "12" : "#fff", color: active ? color : "#6b7280", fontSize:12, cursor:"pointer", fontWeight: active ? 600 : 400 }),
  };

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"#888", fontSize:14 }}>Chargement...</div>;

  const UsernameBox = () => !usernameSet ? (
    <div style={st.userBox}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Ton prénom (obligatoire pour cocher les devoirs)</div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...st.input, flex:1 }} value={username} onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key==="Enter" && (localStorage.setItem("username", username.trim() || "Anonyme"), setUsernameSet(true))}
          placeholder="Ton prénom..." />
        <button style={st.btn()} onClick={() => { localStorage.setItem("username", username.trim() || "Anonyme"); setUsernameSet(true); }}>
          Valider
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div style={st.container}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <h1 style={st.h1}>📚 Mon Cahier de Devoirs</h1>
          <p style={st.subtitle}>{totalPending > 0 ? `${totalPending} devoir${totalPending>1?"s":""} en attente pour toi` : "Tout est à jour ✓"}</p>
        </div>
      </div>

      <div style={st.tabs}>
        <button style={st.tab(tab==="devoirs")} onClick={() => { setTab("devoirs"); setSelectedSubject(null); }}>Devoirs {totalPending > 0 && `· ${totalPending}`}</button>
        <button style={st.tab(tab==="partage")} onClick={() => { setTab("partage"); setSelectedThread(null); }}>💬 Espace partagé</button>
        <button style={st.tab(tab==="forums")} onClick={() => { setTab("forums"); setSelectedThread(null); setThreadSubject(null); }}>🗂️ Forums matières</button>
      </div>

      {/* DEVOIRS */}
      {tab === "devoirs" && !selectedSubject && (
        <div style={st.grid}>
          {SUBJECTS.map(sub => {
            const p = pending(sub.id);
            const first = hwForSubject(sub.id).filter(h=>!userDone.includes(h.id))[0];
            return (
              <div key={sub.id} style={st.card(sub.color, p > 0)} onClick={() => setSelectedSubject(sub.id)}
                onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                <div style={{ fontSize:28, marginBottom:8 }}>{sub.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{sub.name}</div>
                <div style={st.badge(sub.color, p > 0)}>{p > 0 ? `${p} à faire` : "Rien à faire ✓"}</div>
                {first && <div style={{ marginTop:8, fontSize:11, color:"#6b7280", borderLeft:`2px solid ${sub.color}`, paddingLeft:6, lineHeight:1.4 }}>{first.text.slice(0,55)}{first.text.length>55?"…":""}</div>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "devoirs" && subject && (
        <div>
          <button style={st.backBtn} onClick={() => setSelectedSubject(null)}>← Toutes les matières</button>
          <UsernameBox />
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1.5rem" }}>
            <span style={{ fontSize:32 }}>{subject.icon}</span>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:600 }}>{subject.name}</h2>
              <span style={{ fontSize:12, color: subject.color }}>{pending(subject.id)} devoir{pending(subject.id)!==1?"s":""} en attente</span>
            </div>
          </div>
          <div style={st.formBox}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Ajouter un devoir (visible par toute la classe)</div>
            <div style={st.row}>
              <input style={st.input} value={newHW.text} onChange={e => setNewHW(p => ({...p, text:e.target.value}))} onKeyDown={e => e.key==="Enter" && addHomework()} placeholder="Ex : Ex 12 p.47, rédaction, fiche..." />
              <input type="date" style={st.inputSm} value={newHW.date} onChange={e => setNewHW(p => ({...p, date:e.target.value}))} />
              <button style={st.btn(subject.color)} onClick={addHomework}>Ajouter</button>
            </div>
          </div>
          {hwForSubject(subject.id).length === 0 ? (
            <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, padding:"2rem 0" }}>Aucun devoir pour cette matière 🎉</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[...hwForSubject(subject.id).filter(h=>!userDone.includes(h.id)), ...hwForSubject(subject.id).filter(h=>userDone.includes(h.id))].map(item => (
                <div key={item.id} style={st.hwItem(userDone.includes(item.id))}>
                  <input type="checkbox" checked={userDone.includes(item.id)} onChange={() => toggleDone(item.id)} style={{ width:16, height:16, cursor:"pointer", flexShrink:0, accentColor:subject.color }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:"#111", textDecoration:userDone.includes(item.id)?"line-through":"none" }}>{item.text}</div>
                    <div style={{ display:"flex", gap:10, marginTop:2, flexWrap:"wrap" }}>
                      {item.date && <span style={{ fontSize:11, color:subject.color }}>Pour le {new Date(item.date+"T12:00:00").toLocaleDateString("fr-FR")}</span>}
                      {item.added_by && <span style={{ fontSize:11, color:"#9ca3af" }}>par {item.added_by}</span>}
                    </div>
                  </div>
                  <button style={st.delBtn} onClick={() => deleteHW(item.id)}>Suppr.</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESPACE PARTAGE */}
      {tab === "partage" && (
        <div>
          <UsernameBox />
          <div style={st.chatBox}>
            {messages.length === 0 ? (
              <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, margin:"auto" }}>Personne n'a encore écrit.<br/>Soyez le premier !</div>
            ) : messages.map(msg => (
              <div key={msg.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <Avatar name={msg.username} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"baseline", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{msg.username}</span>
                    <span style={{ fontSize:11, color:"#9ca3af" }}>{msg.time}</span>
                  </div>
                  {msg.text && <div style={st.bubble}>{msg.text}</div>}
                  {renderFile(msg.file_url, msg.file_name)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...st.input, flex:1 }} value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
              placeholder={usernameSet ? `Écris un message en tant que ${username||"Anonyme"}…` : "Écris ton message…"} />
            <button style={st.btn("#3B82F6")} onClick={() => sendMessage()}>Envoyer</button>
            <button style={st.uploadBtn} onClick={() => fileInputRef.current.click()} disabled={uploading}>{uploading ? "⏳" : "📎"}</button>
            <input type="file" ref={fileInputRef} style={{ display:"none" }} accept="image/*,.pdf,.doc,.docx" onChange={e => handleFileUpload(e, false)} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <div style={{ fontSize:11, color:"#9ca3af" }}>📎 pour envoyer une photo ou un fichier</div>
            {usernameSet && <button style={{ fontSize:11, padding:"3px 8px", border:"1px solid #e5e7eb", borderRadius:6, cursor:"pointer", background:"#fff" }} onClick={() => setUsernameSet(false)}>Changer de nom</button>}
          </div>
        </div>
      )}

      {/* FORUMS MATIERES - liste des fils */}
      {tab === "forums" && !selectedThread && (
        <div>
          <UsernameBox />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:"1rem" }}>
            <button style={st.subjectPill("#6b7280", threadSubject === null)} onClick={() => setThreadSubject(null)}>Toutes les matières</button>
            {SUBJECTS.map(sub => (
              <button key={sub.id} style={st.subjectPill(sub.color, threadSubject === sub.id)} onClick={() => setThreadSubject(sub.id)}>
                {sub.icon} {sub.name}
              </button>
            ))}
          </div>

          <div style={{ marginBottom:"1rem" }}>
            {!showNewThread ? (
              <button style={{ ...st.btn("#3B82F6"), width:"100%", textAlign:"center" }} onClick={() => setShowNewThread(true)}>
                + Créer un nouveau fil de discussion
              </button>
            ) : (
              <div style={st.formBox}>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>Nouveau fil de discussion</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <select style={{ ...st.inputSm, flex:"1 1 140px" }} value={threadSubject || ""} onChange={e => setThreadSubject(e.target.value || null)}>
                    <option value="">Choisir une matière...</option>
                    {SUBJECTS.map(sub => <option key={sub.id} value={sub.id}>{sub.icon} {sub.name}</option>)}
                  </select>
                  <input style={st.input} value={newThreadTitle} onChange={e => setNewThreadTitle(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && createThread()}
                    placeholder="Ex : DM7, Question cours chapitre 3..." />
                  <button style={st.btn("#3B82F6")} onClick={createThread}>Créer</button>
                  <button style={st.btn()} onClick={() => setShowNewThread(false)}>Annuler</button>
                </div>
              </div>
            )}
          </div>

          {(threadSubject ? threadsForSubject(threadSubject) : threads).length === 0 ? (
            <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, padding:"2rem 0" }}>Aucun fil de discussion pour le moment.<br/>Sois le premier à en créer un !</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {(threadSubject ? threadsForSubject(threadSubject) : threads).map(thread => {
                const sub = SUBJECTS.find(s => s.id === thread.subject_id);
                return (
                  <div key={thread.id} style={st.threadCard} onClick={() => openThread(thread)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22 }}>{sub?.icon || "💬"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{thread.title}</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                          {sub?.name} · par {thread.created_by} · {new Date(thread.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <span style={{ color:"#9ca3af" }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FORUM - fil ouvert */}
      {tab === "forums" && selectedThread && (
        <div>
          <button style={st.backBtn} onClick={() => { setSelectedThread(null); setThreadMessages([]); }}>← Retour aux fils</button>
          {(() => {
            const sub = SUBJECTS.find(s => s.id === selectedThread.subject_id);
            return (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1rem" }}>
                <span style={{ fontSize:28 }}>{sub?.icon}</span>
                <div>
                  <h2 style={{ margin:0, fontSize:17, fontWeight:600 }}>{selectedThread.title}</h2>
                  <span style={{ fontSize:12, color:"#9ca3af" }}>{sub?.name} · créé par {selectedThread.created_by}</span>
                </div>
              </div>
            );
          })()}

          <div style={st.chatBox}>
            {threadMessages.length === 0 ? (
              <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, margin:"auto" }}>Aucun message encore.<br/>Lance la discussion !</div>
            ) : threadMessages.map(msg => (
              <div key={msg.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <Avatar name={msg.username} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"baseline", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{msg.username}</span>
                    <span style={{ fontSize:11, color:"#9ca3af" }}>{msg.time}</span>
                  </div>
                  {msg.text && <div style={st.bubble}>{msg.text}</div>}
                  {renderFile(msg.file_url, msg.file_name)}
                </div>
              </div>
            ))}
            <div ref={threadEndRef}/>
          </div>

          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...st.input, flex:1 }} value={newThreadMsg} onChange={e => setNewThreadMsg(e.target.value)}
              onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendThreadMessage()}
              placeholder={usernameSet ? `Réponds en tant que ${username||"Anonyme"}…` : "Écris ta réponse…"} />
            <button style={st.btn("#3B82F6")} onClick={() => sendThreadMessage()}>Envoyer</button>
            <button style={st.uploadBtn} onClick={() => threadFileRef.current.click()} disabled={uploading}>{uploading ? "⏳" : "📎"}</button>
            <input type="file" ref={threadFileRef} style={{ display:"none" }} accept="image/*,.pdf,.doc,.docx" onChange={e => handleFileUpload(e, true)} />
          </div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:6 }}>📎 pour envoyer une photo ou un fichier</div>
        </div>
      )}
    </div>
  );
}