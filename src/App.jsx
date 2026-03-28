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
      background: colors[idx] + "22",
      color: colors[idx],
      border: `1px solid ${colors[idx]}44`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:13, fontWeight:600
    }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("devoirs");
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [homework, setHomework] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newHW, setNewHW] = useState({ text:"", date:"" });
  const [newMsg, setNewMsg] = useState("");
  const [username, setUsername] = useState("");
  const [usernameSet, setUsernameSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("messages")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" }, payload => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("devoirs")
      .on("postgres_changes", { event:"*", schema:"public", table:"devoirs" }, () => {
        loadHomework();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadAll() {
    await Promise.all([loadHomework(), loadMessages()]);
    setLoading(false);
  }

  async function loadHomework() {
    const { data } = await supabase.from("devoirs").select("*").order("created_at");
    if (data) setHomework(data);
  }

  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*").order("created_at");
    if (data) setMessages(data);
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

  async function toggleDone(id, done) {
    await supabase.from("devoirs").update({ done: !done }).eq("id", id);
    setHomework(prev => prev.map(h => h.id === id ? {...h, done:!done} : h));
  }

  async function deleteHW(id) {
    await supabase.from("devoirs").delete().eq("id", id);
    setHomework(prev => prev.filter(h => h.id !== id));
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;
    const now = new Date();
    const time = now.toLocaleString("fr-FR", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" });
    await supabase.from("messages").insert({
      username: username.trim() || "Anonyme",
      text: newMsg.trim(),
      time,
    });
    setNewMsg("");
  }

  const hwForSubject = id => homework.filter(h => h.subject_id === id);
  const pending = id => hwForSubject(id).filter(h => !h.done).length;
  const totalPending = SUBJECTS.reduce((a, s) => a + pending(s.id), 0);
  const subject = SUBJECTS.find(s => s.id === selectedSubject);

  const styles = {
    container: { fontFamily:"system-ui, sans-serif", padding:"1rem", maxWidth:700, margin:"0 auto" },
    h1: { margin:"0 0 4px", fontSize:20, fontWeight:600 },
    subtitle: { margin:0, fontSize:13, color:"#888" },
    tabs: { display:"flex", gap:8, margin:"1.25rem 0", borderBottom:"1px solid #e5e7eb", paddingBottom:"0.75rem" },
    tab: (active) => ({
      padding:"6px 16px", border:"1px solid " + (active ? "#d1d5db" : "#e5e7eb"),
      borderRadius:8, background: active ? "#fff" : "transparent",
      fontSize:14, fontWeight: active ? 500 : 400,
      color: active ? "#111" : "#888", cursor:"pointer",
    }),
    grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12 },
    card: (color, hasPending) => ({
      background:"#fff", border: hasPending ? `2px solid ${color}` : "1px solid #e5e7eb",
      borderRadius:12, padding:"1rem", cursor:"pointer", transition:"box-shadow 0.15s",
    }),
    badge: (color, hasPending) => ({
      display:"inline-block", fontSize:11, padding:"2px 8px",
      borderRadius:6, marginTop:8,
      background: hasPending ? color + "18" : "#f3f4f6",
      color: hasPending ? color : "#9ca3af",
    }),
    backBtn: { background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:13, padding:0, marginBottom:"1rem" },
    formBox: { background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", marginBottom:"1.5rem" },
    row: { display:"flex", gap:8, flexWrap:"wrap", marginTop:10 },
    input: { flex:"2 1 200px", padding:"8px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" },
    inputSm: { flex:"1 1 130px", padding:"8px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" },
    btn: (color="#111") => ({
      padding:"8px 16px", border:"1px solid #d1d5db", borderRadius:8,
      background:"#fff", color, fontSize:14, cursor:"pointer", fontWeight:500,
    }),
    hwItem: (done) => ({
      display:"flex", alignItems:"center", gap:12,
      background:"#fff", border:"1px solid #e5e7eb",
      borderRadius:8, padding:"10px 12px",
      opacity: done ? 0.5 : 1,
    }),
    delBtn: { padding:"4px 8px", border:"none", borderRadius:6, background:"#fee2e2", color:"#dc2626", fontSize:11, cursor:"pointer" },
    chatBox: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", minHeight:280, maxHeight:400, overflowY:"auto", marginBottom:12, display:"flex", flexDirection:"column", gap:14 },
    bubble: { background:"#f3f4f6", borderRadius:"0 8px 8px 8px", padding:"8px 12px", fontSize:14, color:"#111", display:"inline-block", maxWidth:"90%", lineHeight:1.5, whiteSpace:"pre-wrap", wordBreak:"break-word" },
    userBox: { background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", marginBottom:"1.25rem" },
    infoBanner: { marginTop:"1rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#1d4ed8", lineHeight:1.6 },
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"#888", fontSize:14 }}>
      Chargement...
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <h1 style={styles.h1}>📚 Mon Cahier de Devoirs</h1>
          <p style={styles.subtitle}>{totalPending > 0 ? `${totalPending} devoir${totalPending>1?"s":""} en attente` : "Tout est à jour ✓"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(tab==="devoirs")} onClick={() => { setTab("devoirs"); setSelectedSubject(null); }}>
          Devoirs {totalPending > 0 && `· ${totalPending}`}
        </button>
        <button style={styles.tab(tab==="partage")} onClick={() => setTab("partage")}>
          Espace partagé {messages.length > 0 && `· ${messages.length}`}
        </button>
      </div>

      {/* ── DEVOIRS ── */}
      {tab === "devoirs" && !selectedSubject && (
        <div style={styles.grid}>
          {SUBJECTS.map(s => {
            const p = pending(s.id);
            const first = hwForSubject(s.id).filter(h=>!h.done)[0];
            return (
              <div key={s.id} style={styles.card(s.color, p > 0)} onClick={() => setSelectedSubject(s.id)}
                onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow="none"}>
                <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{s.name}</div>
                <div style={styles.badge(s.color, p > 0)}>{p > 0 ? `${p} à faire` : "Rien à faire ✓"}</div>
                {first && (
                  <div style={{ marginTop:8, fontSize:11, color:"#6b7280", borderLeft:`2px solid ${s.color}`, paddingLeft:6, lineHeight:1.4 }}>
                    {first.text.slice(0,55)}{first.text.length>55?"…":""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "devoirs" && subject && (
        <div>
          <button style={styles.backBtn} onClick={() => setSelectedSubject(null)}>← Toutes les matières</button>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:"1.5rem" }}>
            <span style={{ fontSize:32 }}>{subject.icon}</span>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:600 }}>{subject.name}</h2>
              <span style={{ fontSize:12, color: subject.color }}>{pending(subject.id)} devoir{pending(subject.id)!==1?"s":""} en attente</span>
            </div>
          </div>

          {/* Formulaire ajout */}
          <div style={styles.formBox}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Ajouter un devoir (visible par toute la classe)</div>
            <div style={styles.row}>
              <input style={styles.input} value={newHW.text}
                onChange={e => setNewHW(p => ({...p, text:e.target.value}))}
                onKeyDown={e => e.key==="Enter" && addHomework()}
                placeholder="Ex : Ex 12 p.47, rédaction, fiche..."
              />
              <input type="date" style={styles.inputSm} value={newHW.date}
                onChange={e => setNewHW(p => ({...p, date:e.target.value}))}
              />
              <button style={styles.btn(subject.color)} onClick={addHomework}>Ajouter</button>
            </div>
          </div>

          {/* Liste devoirs */}
          {hwForSubject(subject.id).length === 0 ? (
            <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, padding:"2rem 0" }}>Aucun devoir pour cette matière 🎉</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                ...hwForSubject(subject.id).filter(h=>!h.done),
                ...hwForSubject(subject.id).filter(h=>h.done),
              ].map(item => (
                <div key={item.id} style={styles.hwItem(item.done)}>
                  <input type="checkbox" checked={item.done} onChange={() => toggleDone(item.id, item.done)}
                    style={{ width:16, height:16, cursor:"pointer", flexShrink:0, accentColor:subject.color }}
                  />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:"#111", textDecoration:item.done?"line-through":"none" }}>{item.text}</div>
                    <div style={{ display:"flex", gap:10, marginTop:2, flexWrap:"wrap" }}>
                      {item.date && <span style={{ fontSize:11, color:subject.color }}>Pour le {new Date(item.date+"T12:00:00").toLocaleDateString("fr-FR")}</span>}
                      {item.added_by && <span style={{ fontSize:11, color:"#9ca3af" }}>par {item.added_by}</span>}
                    </div>
                  </div>
                  <button style={styles.delBtn} onClick={() => deleteHW(item.id)}>Suppr.</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ESPACE PARTAGE ── */}
      {tab === "partage" && (
        <div>
          {!usernameSet && (
            <div style={styles.userBox}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Ton prénom (optionnel)</div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:10 }}>Pour que tes camarades sachent qui parle</div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...styles.input, flex:1 }} value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && setUsernameSet(true)}
                  placeholder="Ton prénom..."
                />
                <button style={styles.btn()} onClick={() => setUsernameSet(true)}>
                  {username.trim() ? "Confirmer" : "Anonyme"}
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={styles.chatBox}>
            {messages.length === 0 ? (
              <div style={{ textAlign:"center", color:"#9ca3af", fontSize:14, margin:"auto" }}>
                Personne n'a encore écrit de message.<br/>Soyez le premier !
              </div>
            ) : messages.map(msg => (
              <div key={msg.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <Avatar name={msg.username} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"baseline", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{msg.username}</span>
                    <span style={{ fontSize:11, color:"#9ca3af" }}>{msg.time}</span>
                  </div>
                  <div style={styles.bubble}>{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {/* Envoyer message */}
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...styles.input, flex:1 }} value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
              placeholder={usernameSet ? `Écris un message en tant que ${username||"Anonyme"}…` : "Écris ton message…"}
            />
            <button style={styles.btn("#3B82F6")} onClick={sendMessage}>Envoyer</button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <div style={{ fontSize:11, color:"#9ca3af" }}>
              {usernameSet ? `Connecté en tant que ${username||"Anonyme"} · Messages partagés en temps réel` : "Messages visibles par tous"}
            </div>
            {usernameSet && (
              <button style={{ fontSize:11, padding:"3px 8px", border:"1px solid #e5e7eb", borderRadius:6, cursor:"pointer", background:"#fff" }}
                onClick={() => setUsernameSet(false)}>Changer de nom</button>
            )}
          </div>

          <div style={styles.infoBanner}>
            <strong>Partager des fichiers :</strong> Colle directement un lien Google Drive, WeTransfer ou Dropbox dans le chat pour partager des corrections ou des exercices.
          </div>
        </div>
      )}
    </div>
  );
}
