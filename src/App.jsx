import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

const SUBJECTS = [
  { id: "info",     name: "Informatique",    icon: "💻", color: "#3B82F6" },
  { id: "anglais",  name: "Anglais",         icon: "🇬🇧", color: "#EF4444" },
  { id: "si",       name: "SI",              icon: "⚙️",  color: "#F59E0B" },
  { id: "physchim", name: "Physique-Chimie", icon: "⚗️",  color: "#10B981" },
  { id: "maths",    name: "Mathématiques",   icon: "📐", color: "#8B5CF6" },
  { id: "francais", name: "Français",        icon: "📖", color: "#EC4899" },
];

const LOFI_STREAMS = [
  { name: "☕ Lo-Fi Chill",  url: "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&controls=0" },
  { name: "🌧️ Pluie & Jazz", url: "https://www.youtube.com/embed/lTRiuFIWV54?autoplay=1&controls=0" },
  { name: "🌲 Nature Study", url: "https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1&controls=0" },
];

const CONCOURS_DATE = new Date("2026-05-30T08:00:00");

const AVATAR_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#F97316"];
function avatarColor(name) {
  return AVATAR_COLORS[(name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_COLORS.length];
}

// ─── DARK MODE ────────────────────────────────────────────────────────────────
function useDarkMode() {
  function shouldBeDark() {
    const h = new Date().getHours();
    return (h >= 20 || h < 7) || window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem("darkMode");
    return s !== null ? s === "true" : shouldBeDark();
  });
  useEffect(() => {
    const id = setInterval(() => { if(!localStorage.getItem("darkMode")) setDark(shouldBeDark()); }, 60000);
    return () => clearInterval(id);
  }, []);
  const toggle = useCallback(() => setDark(d => { localStorage.setItem("darkMode", String(!d)); return !d; }), []);
  return [dark, toggle];
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const NOTIF_TYPES = [
  { key:"newHomework",   icon:"📚", label:"Nouveau devoir ajouté" },
  { key:"chatMessage",   icon:"💬", label:"Message dans l'espace partagé" },
  { key:"helpRequest",   icon:"🆘", label:"Quelqu'un demande de l'aide" },
  { key:"threadReply",   icon:"🗂️", label:"Réponse dans un fil de discussion" },
];

function useNotifications(myUser) {
  const [permission, setPermission] = useState(() => {
    try { return Notification.permission; } catch { return "denied"; }
  });
  const [swReg, setSwReg] = useState(null);
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("notifPrefs")) || { newHomework:true, chatMessage:true, helpRequest:true, threadReply:true }; }
    catch { return { newHomework:true, chatMessage:true, helpRequest:true, threadReply:true }; }
  });
  const [watchedThreads, setWatchedThreads] = useState(() => {
    try { return JSON.parse(localStorage.getItem("watchedThreads")) || []; } catch { return []; }
  });
  const [inbox, setInbox]   = useState([]);
  const [unread, setUnread] = useState(0);

  // Enregistre le Service Worker au démarrage
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => setSwReg(reg))
        .catch(() => {});
    }
  }, []);

  async function requestPermission() {
    try {
      const r = await Notification.requestPermission();
      setPermission(r);
      return r;
    } catch { return "denied"; }
  }

  // Envoie la notif au Service Worker (fonctionne onglet caché ET onglet fermé si SW actif)
  function pushViaServiceWorker(title, body) {
    if (!swReg) return;
    if (swReg.active) {
      swReg.active.postMessage({ type: "NOTIFY", title, body });
    }
  }

  const notify = useCallback((type, title, body) => {
    if (!prefs[type]) return;
    // Toast in-app
    const n = { id: Date.now() + Math.random(), type, title, body, time: new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}), read:false };
    setInbox(prev => [n,...prev].slice(0,60));
    setUnread(u => u+1);
    // Notification navigateur via Service Worker (marche même onglet en arrière-plan)
    if (permission === "granted") {
      if (document.hidden) {
        // Essaie d'abord via SW (plus fiable)
        if (swReg?.active) {
          swReg.active.postMessage({ type: "NOTIFY", title, body });
        } else {
          try { new Notification(title, { body, icon:"/favicon.svg" }); } catch {}
        }
      }
    }
  }, [prefs, permission, swReg]);

  function notifyThread(threadId, title, body) {
    if (!prefs.threadReply) return;
    if (!watchedThreads.includes(threadId)) return;
    notify("threadReply", title, body);
  }

  function watchThread(id) {
    const updated = watchedThreads.includes(id) ? watchedThreads.filter(x=>x!==id) : [...watchedThreads, id];
    setWatchedThreads(updated);
    localStorage.setItem("watchedThreads", JSON.stringify(updated));
  }

  function isWatching(id) { return watchedThreads.includes(id); }

  function markAllRead() { setUnread(0); setInbox(p=>p.map(n=>({...n,read:true}))); }
  function clearAll()    { setInbox([]); setUnread(0); }

  function updatePref(key, val) {
    const updated = {...prefs,[key]:val};
    setPrefs(updated);
    localStorage.setItem("notifPrefs", JSON.stringify(updated));
  }

  return { permission, requestPermission, prefs, updatePref, notify, notifyThread, watchThread, isWatching, inbox, unread, markAllRead, clearAll };
}

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{ position:"fixed", bottom:20, right:16, zIndex:9999, display:"flex", flexDirection:"column", gap:8, maxWidth:320, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, padding:"10px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.18)", display:"flex", gap:10, alignItems:"flex-start", animation:"slideInRight 0.3s ease", pointerEvents:"all" }}>
          <span style={{ fontSize:18, flexShrink:0 }}>{NOTIF_TYPES.find(n=>n.key===t.type)?.icon||"🔔"}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:2 }}>{t.title}</div>
            <div style={{ fontSize:12, color:"var(--text2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.body}</div>
          </div>
          <button onClick={()=>onDismiss(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:14, padding:0, flexShrink:0 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotificationBell({ unread, inbox, onMarkRead, onClear, prefs, updatePref, permission, onRequestPermission }) {
  const [open, setOpen]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    setOpen(o => !o);
    if (!open) onMarkRead();
  }

  const iconForType = key => NOTIF_TYPES.find(n=>n.key===key)?.icon||"🔔";

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={handleOpen} style={{ position:"relative", width:38, height:38, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--bbg)", cursor:"pointer", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>
        🔔
        {unread > 0 && (
          <span style={{ position:"absolute", top:2, right:2, width:16, height:16, borderRadius:"50%", background:"#ef4444", color:"#fff", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--bg)" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position:"absolute", right:0, top:46, width:320, background:"var(--card)", border:"1px solid var(--border)", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:1000, animation:"fadeUp 0.2s ease", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>🔔 Notifications</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setShowSettings(s=>!s)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--text3)" }} title="Paramètres">⚙️</button>
              {inbox.length > 0 && <button onClick={onClear} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--text3)" }}>Tout effacer</button>}
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", background:"var(--bg3)", animation:"fadeUp 0.15s ease" }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:10 }}>Recevoir des notifications pour :</div>
              {NOTIF_TYPES.map(t => (
                <label key={t.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, cursor:"pointer" }}>
                  <span style={{ fontSize:13, color:"var(--text)" }}>{t.icon} {t.label}</span>
                  <input type="checkbox" checked={prefs[t.key]} onChange={e=>updatePref(t.key,e.target.checked)} style={{ width:16, height:16, cursor:"pointer", accentColor:"#6366f1" }}/>
                </label>
              ))}
              {permission !== "granted" && (
                <button onClick={onRequestPermission} style={{ width:"100%", padding:"8px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", marginTop:4 }}>
                  Activer les notifications navigateur
                </button>
              )}
              {permission === "granted" && <div style={{ fontSize:11, color:"#22c55e", marginTop:4 }}>✅ Notifications navigateur activées</div>}
              {permission === "denied"  && <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>❌ Bloquées — autorise dans les paramètres du navigateur</div>}
            </div>
          )}

          {/* Inbox */}
          <div style={{ maxHeight:340, overflowY:"auto" }}>
            {inbox.length === 0 ? (
              <div style={{ padding:"2rem 1rem", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔕</div>
                Aucune notification
              </div>
            ) : inbox.map(n => (
              <div key={n.id} style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", background: n.read ? "transparent" : "var(--bg3)", display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{iconForType(n.type)}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{n.title}</div>
                  <div style={{ fontSize:12, color:"var(--text2)", marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{n.body}</div>
                  <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{n.time}</div>
                </div>
                {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:"#6366f1", flexShrink:0, marginTop:4 }}/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GHOST TYPING HOOK ────────────────────────────────────────────────────────
function useTypingPresence(channelName, myUser) {
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers]  = useState([]);
  const chRef  = useRef(null);
  const tmRef  = useRef(null);

  useEffect(() => {
    if (!channelName) return;
    const key = (myUser || "anon") + "-" + Math.random().toString(36).slice(2, 6);
    chRef.current = supabase.channel(channelName, { config: { presence: { key } } });

    chRef.current.on("presence", { event: "sync" }, () => {
      const state = chRef.current.presenceState();
      const all   = Object.values(state).flat();
      setOnlineUsers([...new Set(all.map(u => u.user).filter(Boolean))]);
      setTypingUsers(all.filter(u => u.typing && u.user !== (myUser || "Anonyme")).map(u => u.user));
    });

    chRef.current.subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await chRef.current.track({ user: myUser || "Anonyme", typing: false });
      }
    });

    return () => { supabase.removeChannel(chRef.current); };
  }, [channelName, myUser]);

  const setTyping = useCallback(async (isTyping) => {
    clearTimeout(tmRef.current);
    await chRef.current?.track({ user: myUser || "Anonyme", typing: isTyping });
    if (isTyping) {
      tmRef.current = setTimeout(() => {
        chRef.current?.track({ user: myUser || "Anonyme", typing: false });
      }, 3000);
    }
  }, [myUser]);

  return [typingUsers, onlineUsers, setTyping];
}

// ─── THEME STYLE ─────────────────────────────────────────────────────────────
function ThemeStyle({ dark }) {
  const v = dark ? `
    :root{--bg:#0d0d14;--bg2:#13131f;--bg3:#1a1a2e;--card:#1e1e30;--border:#252538;--border2:#35354f;--text:#e2e8f0;--text2:#8892a4;--text3:#4a5568;--ibg:#1a1a2e;--bbg:#1e1e30;--accent:#6366f1;}
    body{background:#0d0d14!important;}
  ` : `
    :root{--bg:#f0f2f5;--bg2:#ffffff;--bg3:#f7f8fa;--card:#ffffff;--border:#e4e6eb;--border2:#cdd1d5;--text:#050505;--text2:#65676b;--text3:#8a8d91;--ibg:#f0f2f5;--bbg:#ffffff;--accent:#1877f2;}
    body{background:#f0f2f5!important;}
  `;
  const a = `
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
    @keyframes msgIn{from{opacity:0;transform:translateY(6px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes fadeOutR{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(30px)}}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
    @keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
    @keyframes typingDot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    *{transition:background-color 0.25s,border-color 0.25s,color 0.2s;}
    input,select,textarea{background:var(--ibg)!important;color:var(--text)!important;border-color:var(--border)!important;}
    input:focus,select:focus,textarea:focus{outline:none!important;box-shadow:0 0 0 2px var(--accent)44!important;border-color:var(--accent)!important;}
    button{transition:opacity 0.12s,transform 0.1s,box-shadow 0.15s!important;}
    button:hover{opacity:0.85;}button:active{transform:scale(0.96);}
    .fade-up{animation:fadeUp 0.3s ease;}
    .hw-item{animation:slideIn 0.25s ease;}
    .hw-item.removing{animation:fadeOutR 0.35s ease forwards;}
    .msg-bubble{animation:msgIn 0.2s ease;}
    .card-lift{transition:transform 0.18s,box-shadow 0.18s!important;}
    .card-lift:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.1)!important;}
    ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
    @keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
  `;
  return <style>{v + a}</style>;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, online = false }) {
  const c = avatarColor(name);
  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:c+"25", color:c, border:`2px solid ${c}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.38, fontWeight:700, letterSpacing:"-0.5px" }}>
        {(name||"?")[0].toUpperCase()}
      </div>
      {online && <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:"#22c55e", border:"2px solid var(--card)" }}/>}
    </div>
  );
}

// ─── TYPING INDICATOR ────────────────────────────────────────────────────────
function TypingIndicator({ users }) {
  if (!users.length) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 12px", fontSize:12, color:"var(--text2)" }}>
      <div style={{ display:"flex", gap:3, alignItems:"center" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--text3)", animation:`typingDot 1.2s ease ${i*0.2}s infinite` }}/>
        ))}
      </div>
      <span><strong>{users.slice(0,2).join(", ")}</strong>{users.length > 2 ? ` +${users.length-2}` : ""} {users.length === 1 ? "écrit..." : "écrivent..."}</span>
    </div>
  );
}

// ─── FILES ────────────────────────────────────────────────────────────────────
const isImage = u => u && /\.(jpg|jpeg|png|gif|webp)$/i.test(u);
const isPdf   = u => u && /\.pdf$/i.test(u);
function FileAttachment({ url, name }) {
  if (!url) return null;
  if (isImage(url)) return (
    <img src={url} alt={name} onClick={() => window.open(url,"_blank")} style={{ maxWidth:240, maxHeight:180, borderRadius:12, cursor:"pointer", display:"block", marginTop:6, objectFit:"cover", border:"1px solid var(--border)" }}/>
  );
  if (isPdf(url)) return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 12px", background:"#fee2e2", color:"#dc2626", borderRadius:10, fontSize:13, textDecoration:"none", marginTop:6 }}>📄 {name||"PDF"}</a>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 12px", background:"var(--bg3)", color:"var(--text2)", borderRadius:10, fontSize:13, textDecoration:"none", marginTop:6 }}>📎 {name||"Fichier"}</a>
  );
}

// ─── SOCIAL MESSAGE BUBBLE ───────────────────────────────────────────────────
function MsgBubble({ msg, myUser, onLike }) {
  const isMine = msg.username === (myUser || "Anonyme");
  const c = avatarColor(msg.username);
  const likes = msg.likes || {};
  const likeCount = Object.keys(likes).length;
  const iLiked = likes[myUser || "Anonyme"];

  return (
    <div className="msg-bubble" style={{ display:"flex", flexDirection: isMine ? "row-reverse" : "row", alignItems:"flex-end", gap:8, marginBottom:2 }}>
      {!isMine && <Avatar name={msg.username} size={30} />}
      <div style={{ maxWidth:"72%", display:"flex", flexDirection:"column", alignItems: isMine ? "flex-end" : "flex-start" }}>
        {!isMine && <span style={{ fontSize:11, fontWeight:600, color:c, marginBottom:3, marginLeft:4 }}>{msg.username}</span>}
        <div style={{
          background: isMine ? `linear-gradient(135deg, #6366f1, #8b5cf6)` : "var(--card)",
          color: isMine ? "#fff" : "var(--text)",
          border: isMine ? "none" : "1px solid var(--border)",
          borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.45,
          boxShadow: isMine ? "0 2px 8px rgba(99,102,241,0.35)" : "0 1px 3px rgba(0,0,0,0.06)",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>
          {msg.text}
          <FileAttachment url={msg.file_url} name={msg.file_name} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4, flexDirection: isMine ? "row-reverse" : "row" }}>
          <span style={{ fontSize:10, color:"var(--text3)" }}>{msg.time}</span>
          <button onClick={() => onLike(msg)} style={{
            background: iLiked ? "#fee2e2" : "transparent",
            border: "none", borderRadius:10, padding:"2px 6px",
            fontSize:12, cursor:"pointer", color: iLiked ? "#ef4444" : "var(--text3)",
            display:"flex", alignItems:"center", gap:3,
          }}>
            {iLiked ? "❤️" : "🤍"} {likeCount > 0 && <span style={{ fontSize:11 }}>{likeCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN SHARE ─────────────────────────────────────────────────────────────
async function captureScreen() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor:"always" }, audio: false });
    const video = document.createElement("video");
    video.srcObject = stream;
    await new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
    await new Promise(res => setTimeout(res, 150));
    const canvas = document.createElement("canvas");
    const maxW = 1280;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width  = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach(t => t.stop());
    return new Promise(res => canvas.toBlob(blob => res(new File([blob], `screen-${Date.now()}.jpg`, { type:"image/jpeg" })), "image/jpeg", 0.82));
  } catch (e) {
    stream?.getTracks().forEach(t => t.stop());
    if (e.name !== "AbortError") alert("Impossible de capturer l'écran : " + e.message);
    return null;
  }
}

// ─── SOCIAL CHAT COMPONENT ───────────────────────────────────────────────────
function SocialChat({ messages, myUser, onSend, onLike, onFileUpload, typingUsers, onlineUsers, uploading }) {
  const [text, setText] = useState("");
  const endRef  = useRef(null);
  const fileRef = useRef(null);
  const [typing, , setTyping] = useTypingPresenceLocal();

  // Scroll to bottom on mount and on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim()) return;
    await onSend(text.trim(), null, null);
    setText("");
    setTyping(false);
  }

  async function handleScreen() {
    const file = await captureScreen();
    if (file) await onFileUpload(file);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 240px)", minHeight:400 }}>
      {/* Chat header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:"1px solid var(--border)", background:"var(--card)", borderRadius:"12px 12px 0 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:18 }}>💬</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>Espace partagé</div>
            <div style={{ fontSize:11, color:"#22c55e" }}>
              {onlineUsers.length > 0 ? `${onlineUsers.length} en ligne · ${onlineUsers.slice(0,3).join(", ")}${onlineUsers.length>3?" ...":""}` : "Personne en ligne"}
            </div>
          </div>
        </div>
        <div style={{ fontSize:11, color:"var(--text3)" }}>{messages.length} message{messages.length!==1?"s":""}</div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 12px", display:"flex", flexDirection:"column", gap:8, background:"var(--bg3)" }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", color:"var(--text3)", fontSize:14, margin:"auto" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>💬</div>
            Personne n'a encore écrit.<br/>Soyez le premier !
          </div>
        )}
        {/* Group messages by sender to collapse avatars */}
        {messages.map((msg, i) => {
          const prev = messages[i-1];
          const sameAsPrev = prev && prev.username === msg.username;
          return (
            <div key={msg.id} style={{ marginTop: sameAsPrev ? 1 : 8 }}>
              <MsgBubble msg={msg} myUser={myUser} onLike={onLike} />
            </div>
          );
        })}
        <TypingIndicator users={typingUsers} />
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding:"10px 12px", background:"var(--card)", borderTop:"1px solid var(--border)", borderRadius:"0 0 12px 12px" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Avatar name={myUser || "?"} size={32} />
          <input
            value={text}
            onChange={e => { setText(e.target.value); typing(e.target.value.length > 0); }}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Écris un message..."
            style={{ flex:1, padding:"10px 14px", border:"1px solid var(--border)", borderRadius:22, fontSize:14, background:"var(--ibg)", color:"var(--text)" }}
          />
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            title="Envoyer un fichier ou une photo"
            style={{ width:38, height:38, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--bbg)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {uploading ? "⏳" : "📎"}
          </button>
          <button onClick={handleScreen} title="Partager son écran (screenshot)"
            style={{ width:38, height:38, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--bbg)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
            📺
          </button>
          <button onClick={handleSend}
            style={{ width:38, height:38, borderRadius:"50%", border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
            ➤
          </button>
          <input type="file" ref={fileRef} style={{ display:"none" }} accept="image/*,.pdf,.doc,.docx" onChange={e => { if(e.target.files[0]) onFileUpload(e.target.files[0]); e.target.value=""; }}/>
        </div>
        <div style={{ fontSize:10, color:"var(--text3)", marginTop:4, paddingLeft:46 }}>
          📺 = partager une capture d'écran · Entrée pour envoyer
        </div>
      </div>
    </div>
  );
}

// Tiny wrapper so SocialChat can call typing setter
function useTypingPresenceLocal() {
  const fn = useRef(() => {});
  return [fn.current, null, (v) => fn.current(v)];
}

// ─── TASK ENTRAIDE (compact, par tâche) ──────────────────────────────────────
function TaskHelp({ hwId, myUser }) {
  const [helpers,   setHelpers]   = useState([]);
  const [needers,   setNeeders]   = useState([]);
  const [myStatus,  setMyStatus]  = useState(null);
  const [open,      setOpen]      = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [loaded,    setLoaded]    = useState(false);

  // Charge dès l'ouverture ET recharge si hwId change
  useEffect(() => {
    if (open) { setLoaded(false); load(); }
  }, [open, hwId]);

  async function load() {
    const { data, error } = await supabase
      .from("task_help")
      .select("*")
      .eq("hw_id", hwId);
    if (error) { console.error("task_help load:", error); return; }
    const rows = data || [];
    setHelpers(rows.filter(r => r.status === "gere"));
    setNeeders(rows.filter(r => r.status === "aide"));
    setMyStatus(rows.find(r => r.username === (myUser || "Anonyme"))?.status ?? null);
    setLoaded(true);
  }

  async function handleToggle(status) {
    if (busy) return;
    setBusy(true);
    const name = myUser || "Anonyme";

    // ✅ FIX : maybeSingle() au lieu de single().catch()
    const { data: existing, error: fetchErr } = await supabase
      .from("task_help")
      .select("*")
      .eq("hw_id", hwId)
      .eq("username", name)
      .maybeSingle();

    if (fetchErr) { console.error("task_help fetch:", fetchErr); setBusy(false); return; }

    if (existing) {
      if (existing.status === status) {
        // Désactive si on reclique le même bouton
        const { error } = await supabase.from("task_help").delete().eq("id", existing.id);
        if (error) console.error("task_help delete:", error);
      } else {
        // Change de statut
        const { error } = await supabase.from("task_help").update({ status }).eq("id", existing.id);
        if (error) console.error("task_help update:", error);
      }
    } else {
      // Nouvelle entrée
      const { error } = await supabase.from("task_help").insert({ hw_id: hwId, username: name, status });
      if (error) console.error("task_help insert:", error);
    }

    await load();
    setBusy(false);
  }

  const total = helpers.length + needers.length;

  return (
    <div style={{ marginTop:8 }}>
      {/* Bouton d'ouverture compact */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, color:"var(--text3)", padding:0, display:"flex", alignItems:"center", gap:5 }}
      >
        <span>🤝 Entraide</span>
        {total > 0 && (
          <span style={{ background:helpers.length>0?"#d1fae5":needers.length>0?"#fef3c7":"var(--border)", color:helpers.length>0?"#065f46":needers.length>0?"#92400e":"var(--text3)", borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:600 }}>
            {helpers.length > 0 && `✅${helpers.length}`}
            {helpers.length > 0 && needers.length > 0 && " · "}
            {needers.length > 0 && `🆘${needers.length}`}
          </span>
        )}
        <span style={{ fontSize:9, color:"var(--text3)" }}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop:8, padding:"12px", background:"var(--bg3)", borderRadius:10, border:"1px solid var(--border)", animation:"fadeUp 0.2s ease" }}>

          {/* Boutons d'action */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <button
              onClick={() => handleToggle("gere")}
              disabled={busy}
              style={{
                padding:"6px 14px", borderRadius:20, fontSize:12, cursor:busy?"wait":"pointer", fontWeight:600,
                border:`2px solid ${myStatus==="gere"?"#10B981":"var(--border)"}`,
                background: myStatus==="gere" ? "#d1fae5" : "var(--bbg)",
                color:       myStatus==="gere" ? "#065f46" : "var(--text2)",
                opacity:     busy ? 0.6 : 1,
                transition:  "all 0.15s",
              }}
            >
              {myStatus==="gere" ? "✅ Je gère (actif)" : "✅ Je gère cette tâche"}
            </button>

            <button
              onClick={() => handleToggle("aide")}
              disabled={busy}
              style={{
                padding:"6px 14px", borderRadius:20, fontSize:12, cursor:busy?"wait":"pointer", fontWeight:600,
                border:`2px solid ${myStatus==="aide"?"#F59E0B":"var(--border)"}`,
                background: myStatus==="aide" ? "#fef3c7" : "var(--bbg)",
                color:       myStatus==="aide" ? "#92400e" : "var(--text2)",
                opacity:     busy ? 0.6 : 1,
                transition:  "all 0.15s",
              }}
            >
              {myStatus==="aide" ? "🆘 J'ai besoin d'aide (actif)" : "🆘 J'ai besoin d'aide"}
            </button>
          </div>

          {/* Résultat */}
          {!loaded ? (
            <div style={{ fontSize:11, color:"var(--text3)" }}>Chargement...</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {helpers.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:"#059669", fontWeight:700, marginBottom:4 }}>✅ Peuvent aider :</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {helpers.map(r => (
                      <span key={r.id} style={{ fontSize:12, background:"#d1fae5", color:"#065f46", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>
                        ⭐ {r.username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {needers.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:"#d97706", fontWeight:700, marginBottom:4 }}>🆘 Ont besoin d'aide :</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {needers.map(r => (
                      <span key={r.id} style={{ fontSize:12, background:"#fef3c7", color:"#92400e", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>
                        {r.username}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {helpers.length === 0 && needers.length === 0 && (
                <div style={{ fontSize:11, color:"var(--text3)", fontStyle:"italic" }}>
                  Personne encore — sois le premier à indiquer ton statut !
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DEVOIR ITEM ─────────────────────────────────────────────────────────────
function HwItem({ item, subject, myUser, onToggle, onDelete }) {
  const [removing, setRemoving] = useState(false);

  function handleToggle() {
    if (!item.done) {
      setRemoving(true);
      setTimeout(() => { onToggle(item.id, item.done); setRemoving(false); }, 320);
    } else onToggle(item.id, item.done);
  }

  return (
    <div className={`hw-item${removing?" removing":""}`} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 14px", opacity:item.done ? 0.45 : 1 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <input type="checkbox" checked={item.done} onChange={handleToggle}
          style={{ width:16, height:16, cursor:"pointer", flexShrink:0, marginTop:2, accentColor:subject.color }}
        />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:"var(--text)", textDecoration:item.done?"line-through":"none", lineHeight:1.4 }}>{item.text}</div>
          <div style={{ display:"flex", gap:10, marginTop:3, flexWrap:"wrap", alignItems:"center" }}>
            {item.date && <span style={{ fontSize:11, color:subject.color, fontWeight:600 }}>📅 Pour le {new Date(item.date+"T12:00:00").toLocaleDateString("fr-FR")}</span>}
            {item.added_by && <span style={{ fontSize:11, color:"var(--text3)" }}>par {item.added_by}</span>}
          </div>
          {/* Entraide par tâche */}
          <TaskHelp hwId={item.id} myUser={myUser} />
        </div>
        <button onClick={() => onDelete(item.id)} style={{ padding:"3px 8px", border:"none", borderRadius:6, background:"#fee2e2", color:"#dc2626", fontSize:11, cursor:"pointer", flexShrink:0 }}>✕</button>
      </div>
    </div>
  );
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
function Countdown({ dark }) {
  const [tl, setTl] = useState(null);
  useEffect(() => {
    const fn = () => {
      const d = CONCOURS_DATE - new Date();
      if (d <= 0) { setTl(null); return; }
      setTl({ days:Math.floor(d/86400000), hours:Math.floor((d%86400000)/3600000), minutes:Math.floor((d%3600000)/60000), seconds:Math.floor((d%60000)/1000) });
    };
    fn(); const id = setInterval(fn, 1000); return () => clearInterval(id);
  }, []);
  if (!tl) return null;
  const col = tl.days<7?"#ef4444":tl.days<30?"#f59e0b":"#8b5cf6";
  const bg  = dark ? (tl.days<7?"#450a0a":tl.days<30?"#451a03":"#2e1065") : (tl.days<7?"#fff1f2":tl.days<30?"#fffbeb":"#f5f3ff");
  return (
    <div className="fade-up" style={{ background:bg, border:`1px solid ${col}44`, borderRadius:12, padding:"10px 14px", marginBottom:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:18, animation:"pulse 2s infinite" }}>🎯</span>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:col, textTransform:"uppercase", letterSpacing:"0.06em" }}>Concours Blanc — 30 mai 2026</div>
          <div style={{ fontSize:10, color:"var(--text3)" }}>Bonne révision !</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:6 }}>
        {[{v:tl.days,l:"j"},{v:tl.hours,l:"h"},{v:tl.minutes,l:"m"},{v:tl.seconds,l:"s"}].map(({v,l})=>(
          <div key={l} style={{ textAlign:"center", background:"var(--card)", border:`1px solid ${col}33`, borderRadius:8, padding:"5px 8px", minWidth:40 }}>
            <div style={{ fontSize:18, fontWeight:800, color:col, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{String(v).padStart(2,"0")}</div>
            <div style={{ fontSize:9, color:"var(--text3)" }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── POMODORO ────────────────────────────────────────────────────────────────
function Pomodoro() {
  const [phase,setPhase]=useState("work");const[seconds,setSeconds]=useState(25*60);const[running,setRunning]=useState(false);const[cycles,setCycles]=useState(0);const ref=useRef(null);
  useEffect(()=>{if(running){ref.current=setInterval(()=>{setSeconds(s=>{if(s<=1){clearInterval(ref.current);setRunning(false);if(phase==="work"){setPhase("break");setSeconds(5*60);setCycles(c=>c+1);}else{setPhase("work");setSeconds(25*60);}return 0;}return s-1;});},1000);}else clearInterval(ref.current);return()=>clearInterval(ref.current);},[running,phase]);
  const mm=String(Math.floor(seconds/60)).padStart(2,"0");const ss=String(seconds%60).padStart(2,"0");
  const pct=phase==="work"?1-seconds/(25*60):1-seconds/(5*60);const color=phase==="work"?"#8B5CF6":"#10B981";
  return(
    <div style={{textAlign:"center"}}>
      <div style={{position:"relative",width:130,height:130,margin:"0 auto 10px"}}>
        <svg width="130" height="130" style={{transform:"rotate(-90deg)"}}><circle cx="65" cy="65" r="55" fill="none" stroke="var(--border)" strokeWidth="7"/><circle cx="65" cy="65" r="55" fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${2*Math.PI*55}`} strokeDashoffset={`${2*Math.PI*55*(1-pct)}`} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/></svg>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:700,color:"var(--text)",fontVariantNumeric:"tabular-nums"}}>{mm}:{ss}</div>
          <div style={{fontSize:10,color,fontWeight:700}}>{phase==="work"?"FOCUS":"PAUSE"}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        <button onClick={()=>setRunning(r=>!r)} style={{padding:"7px 18px",borderRadius:8,border:"none",background:running?"#fee2e2":color,color:running?"#dc2626":"#fff",fontWeight:600,cursor:"pointer",fontSize:13}}>{running?"⏸":"▶"}</button>
        <button onClick={()=>{setRunning(false);setPhase("work");setSeconds(25*60);}} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bbg)",color:"var(--text2)",cursor:"pointer"}}>↺</button>
      </div>
      <div style={{fontSize:11,color:"var(--text3)",marginTop:8}}>🍅 {cycles} cycles</div>
    </div>
  );
}

// ─── FOCUS MODE ──────────────────────────────────────────────────────────────
function FocusMode({ homework, onExit }) {
  const pending=homework.filter(h=>!h.done);const[lofiIdx,setLofiIdx]=useState(0);const[lofiOn,setLofiOn]=useState(false);
  return(
    <div style={{position:"fixed",inset:0,background:"#0a0a14",zIndex:1000,display:"flex",flexDirection:"column",padding:"1.5rem",overflowY:"auto",animation:"fadeUp 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <div><h2 style={{margin:0,fontSize:18,fontWeight:700,color:"#e2e8f0"}}>🎯 Mode Focus</h2><p style={{margin:0,fontSize:12,color:"#64748b"}}>Concentre-toi. Tu peux le faire.</p></div>
        <button onClick={onExit} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer"}}>✕ Quitter</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",maxWidth:880,margin:"0 auto",width:"100%"}}>
        <div>
          <div style={{background:"#1e1e2e",borderRadius:14,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:10}}>📋 À faire ({pending.length})</div>
            {pending.length===0?<div style={{color:"#64748b",fontSize:13}}>🎉 Tout est fait !</div>:(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {pending.map(hw=>{const sub=SUBJECTS.find(s=>s.id===hw.subject_id);return(
                  <div key={hw.id} style={{display:"flex",gap:8,padding:"7px 10px",background:"#2d2d44",borderRadius:8,borderLeft:`3px solid ${sub?.color||"#6366f1"}`}}>
                    <span>{sub?.icon}</span><div style={{fontSize:13,color:"#e2e8f0"}}>{hw.text}</div>
                  </div>
                );})}
              </div>
            )}
          </div>
          <div style={{background:"#1e1e2e",borderRadius:14,padding:"1rem"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:8}}>🎧 Lo-Fi</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
              {LOFI_STREAMS.map((l,i)=><button key={i} onClick={()=>{setLofiIdx(i);setLofiOn(true);}} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${lofiIdx===i&&lofiOn?"#7c3aed":"#334155"}`,background:lofiIdx===i&&lofiOn?"#4c1d95":"transparent",color:lofiIdx===i&&lofiOn?"#e2e8f0":"#94a3b8",fontSize:11,cursor:"pointer"}}>{l.name}</button>)}
              <button onClick={()=>setLofiOn(false)} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#ef4444",fontSize:11,cursor:"pointer"}}>⏹</button>
            </div>
            {lofiOn?<iframe src={LOFI_STREAMS[lofiIdx].url} style={{width:"100%",height:70,border:"none",borderRadius:8}} allow="autoplay" title="lofi"/>:<div style={{fontSize:11,color:"#475569",textAlign:"center",padding:"10px 0"}}>Choisis un style 🎵</div>}
          </div>
        </div>
        <div style={{background:"#1e1e2e",borderRadius:14,padding:"1.5rem"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:"1rem"}}>🍅 Pomodoro</div>
          <Pomodoro/>
        </div>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, toggleDark] = useDarkMode();
  const [tab, setTab]               = useState("devoirs");
  const [selectedSubject, setSub]   = useState(null);
  const [homework, setHomework]     = useState([]);
  const [messages, setMessages]     = useState([]);
  const [newHW, setNewHW]           = useState({ text:"", date:"" });
  const [username, setUsername]     = useState(() => localStorage.getItem("username") || "");
  const [usernameSet, setUsernameSet] = useState(() => !!localStorage.getItem("username"));
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [focusMode, setFocusMode]   = useState(false);

  const [threads, setThreads]             = useState([]);
  const [selectedThread, setSelThread]    = useState(null);
  const [threadMessages, setThreadMsgs]   = useState([]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadMsg, setNewThreadMsg]   = useState("");
  const [threadSubject, setThreadSubject] = useState(null);

  const threadEndRef  = useRef(null);
  const threadFileRef = useRef(null);

  // ── Notifications ──
  const notif = useNotifications(username || "Anonyme");
  const [toasts, setToasts] = useState([]);

  function pushToast(type, title, body) {
    notif.notify(type, title, body);
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, type, title, body }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }
  function dismissToast(id) { setToasts(p => p.filter(t => t.id !== id)); }

  // Ghost typing for main chat
  const [chatTyping, chatOnline, setChatTyping] = useTypingPresence("presence-chat", usernameSet ? username : null);
  // Ghost typing for current thread
  const threadChName = selectedThread ? `presence-thread-${selectedThread.id}` : null;
  const [thTyping, thOnline, setThTyping] = useTypingPresence(threadChName, usernameSet ? username : null);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const ch = supabase.channel("rt-messages")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"}, p => {
        setMessages(prev=>[...prev,p.new]);
        if (p.new.username !== (username || "Anonyme")) {
          pushToast("chatMessage", `💬 ${p.new.username}`, p.new.text?.slice(0,60) || "a envoyé un fichier");
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"}, p => setMessages(prev=>prev.map(m=>m.id===p.new.id?p.new:m)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [username]);
  useEffect(() => {
    if (!selectedThread) return;
    const ch = supabase.channel("rt-thread-msgs")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"thread_messages"}, p => {
        if(p.new.thread_id===selectedThread.id) {
          setThreadMsgs(prev=>[...prev,p.new]);
          if (p.new.username !== (username || "Anonyme")) {
            notif.notifyThread(selectedThread.id, `🗂️ ${p.new.username}`, `dans "${selectedThread.title}" : ${p.new.text?.slice(0,50)||"fichier"}`);
          }
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"thread_messages"}, p => setThreadMsgs(prev=>prev.map(m=>m.id===p.new.id?p.new:m)))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [selectedThread, username]);
  useEffect(() => {
    const ch = supabase.channel("rt-devoirs")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"devoirs"}, p => {
        loadHomework();
        if (p.new.added_by !== (username || "Anonyme")) {
          const sub = SUBJECTS.find(s=>s.id===p.new.subject_id);
          pushToast("newHomework", `📚 Nouveau devoir — ${sub?.name||p.new.subject_id}`, p.new.text?.slice(0,70));
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"devoirs"},()=>loadHomework())
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"devoirs"},()=>loadHomework())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [username]);
  useEffect(() => {
    const ch = supabase.channel("rt-task-help")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"task_help"}, p => {
        if (p.new.status === "aide" && p.new.username !== (username || "Anonyme")) {
          pushToast("helpRequest", `🆘 ${p.new.username} a besoin d'aide`, "Cliquez pour voir quelle tâche");
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [username]);

  async function loadAll() { await Promise.all([loadHomework(), loadMessages(), loadThreads()]); setLoading(false); }
  async function loadHomework() { const{data}=await supabase.from("devoirs").select("*").order("created_at"); if(data)setHomework(data); }
  async function loadMessages() { const{data}=await supabase.from("messages").select("*").order("created_at"); if(data)setMessages(data); }
  async function loadThreads() { const{data}=await supabase.from("threads").select("*").order("created_at",{ascending:false}); if(data)setThreads(data); }
  async function loadThreadMessages(id) { const{data}=await supabase.from("thread_messages").select("*").eq("thread_id",id).order("created_at"); if(data)setThreadMsgs(data); }
  async function openThread(t) { setSelThread(t); await loadThreadMessages(t.id); }

  async function addHomework() {
    if(!newHW.text.trim()||!selectedSubject)return;
    await supabase.from("devoirs").insert({subject_id:selectedSubject,text:newHW.text.trim(),date:newHW.date||null,done:false,added_by:username.trim()||"Anonyme"});
    setNewHW({text:"",date:""});
  }
  async function toggleDone(id,done) { await supabase.from("devoirs").update({done:!done}).eq("id",id); setHomework(prev=>prev.map(h=>h.id===id?{...h,done:!done}:h)); }
  async function deleteHW(id) { await supabase.from("devoirs").delete().eq("id",id); setHomework(prev=>prev.filter(h=>h.id!==id)); }

  async function likeMessage(msg, table="messages") {
    const u = username || "Anonyme";
    const cur = msg.likes || {};
    const updated = { ...cur };
    if (updated[u]) delete updated[u]; else updated[u] = true;
    await supabase.from(table).update({ likes: updated }).eq("id", msg.id);
  }

  async function uploadFile(file, isThread=false) {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("corrections").upload(fileName, file, { cacheControl:"3600", upsert:false });
    if (error) { alert("Erreur upload : "+error.message); setUploading(false); return null; }
    const { data } = supabase.storage.from("corrections").getPublicUrl(fileName);
    setUploading(false);
    return { url: data.publicUrl, name: file.name };
  }

  async function sendMainMessage(text, fileUrl=null, fileName=null) {
    if (!text && !fileUrl) return;
    const now=new Date();const time=now.toLocaleString("fr-FR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
    await supabase.from("messages").insert({ username:username.trim()||"Anonyme", text:text||"", time, file_url:fileUrl||null, file_name:fileName||null });
    setChatTyping(false);
  }

  async function handleMainFile(file) {
    const res = await uploadFile(file, false);
    if (res) await sendMainMessage(null, res.url, res.name);
  }

  async function sendThreadMessage(text, fileUrl=null, fileName=null) {
    if (!text && !fileUrl) return;
    const now=new Date();const time=now.toLocaleString("fr-FR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
    await supabase.from("thread_messages").insert({ thread_id:selectedThread.id, username:username.trim()||"Anonyme", text:text||"", time, file_url:fileUrl||null, file_name:fileName||null });
    setNewThreadMsg("");
    setThTyping(false);
  }

  async function handleThreadFile(file) {
    const res = await uploadFile(file, true);
    if (res) await sendThreadMessage(null, res.url, res.name);
  }

  async function createThread() {
    if(!newThreadTitle.trim()||!threadSubject)return;
    const{data}=await supabase.from("threads").insert({subject_id:threadSubject,title:newThreadTitle.trim(),created_by:username.trim()||"Anonyme"}).select().single();
    if(data){setThreads(prev=>[data,...prev]);setNewThreadTitle("");setShowNewThread(false);openThread(data);}
  }

  const hwFor    = id => homework.filter(h=>h.subject_id===id);
  const pending  = id => hwFor(id).filter(h=>!h.done).length;
  const totalPending = SUBJECTS.reduce((a,s)=>a+pending(s.id),0);
  const subject  = SUBJECTS.find(s=>s.id===selectedSubject);
  const threadsFor = id => threads.filter(t=>t.subject_id===id);

  // Styles
  const st = {
    container: { fontFamily:"system-ui,sans-serif", padding:"1rem", maxWidth:800, margin:"0 auto", background:"var(--bg)", minHeight:"100vh" },
    tabs:  { display:"flex", gap:6, margin:"1rem 0", borderBottom:"1px solid var(--border)", paddingBottom:"0.75rem", flexWrap:"wrap" },
    tab: a => ({ padding:"6px 14px", border:`1px solid ${a?"var(--border2)":"var(--border)"}`, borderRadius:8, background:a?"var(--card)":"transparent", fontSize:13, fontWeight:a?600:400, color:a?"var(--text)":"var(--text3)", cursor:"pointer" }),
    grid:  { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(155px,1fr))", gap:10 },
    card:  (c,has) => ({ background:"var(--card)", border:has?`2px solid ${c}`:"1px solid var(--border)", borderRadius:14, padding:"1rem", cursor:"pointer" }),
    badge: (c,has) => ({ display:"inline-block", fontSize:11, padding:"2px 9px", borderRadius:20, marginTop:8, background:has?c+"20":"var(--bg3)", color:has?c:"var(--text3)", fontWeight:600 }),
    back:  { background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:13, padding:0, marginBottom:"1rem" },
    form:  { background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, padding:"1rem", marginBottom:"1.25rem" },
    inp:   { flex:"2 1 200px", padding:"9px 12px", border:"1px solid var(--border)", borderRadius:9, fontSize:14, background:"var(--ibg)", color:"var(--text)", outline:"none" },
    inpSm: { flex:"1 1 130px", padding:"9px 12px", border:"1px solid var(--border)", borderRadius:9, fontSize:14, background:"var(--ibg)", color:"var(--text)", outline:"none" },
    btn:   c => ({ padding:"9px 16px", border:"1px solid var(--border)", borderRadius:9, background:"var(--bbg)", color:c||"var(--text)", fontSize:14, cursor:"pointer", fontWeight:500 }),
    pill:  (c,a) => ({ padding:"5px 12px", borderRadius:20, border:a?`2px solid ${c}`:"1px solid var(--border)", background:a?c+"15":"var(--bbg)", color:a?c:"var(--text3)", fontSize:12, cursor:"pointer", fontWeight:a?600:400 }),
    threadCard: { background:"var(--card)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 14px", cursor:"pointer" },
  };

  const myUser = usernameSet ? (username || "Anonyme") : null;

  const UsernameBox = () => !usernameSet ? (
    <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:"var(--text)" }}>Ton prénom pour rejoindre 👋</div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{...st.inp, flex:1}} value={username} onChange={e=>setUsername(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&(localStorage.setItem("username",username.trim()||"Anonyme"),setUsernameSet(true))}
          placeholder="Ton prénom..."/>
        <button style={st.btn()} onClick={()=>{localStorage.setItem("username",username.trim()||"Anonyme");setUsernameSet(true);}}>
          {username.trim()?"Rejoindre":"Anonyme"}
        </button>
      </div>
    </div>
  ) : null;

  // Thread chat UI (forum style)
  const ThreadChatBox = () => {
    const endRef = useRef(null);
    const [thText, setThText] = useState("");
    useEffect(() => { endRef.current?.scrollIntoView(); }, [threadMessages.length]);

    async function send() {
      if (!thText.trim()) return;
      await sendThreadMessage(thText.trim());
      setThText("");
    }

    return (
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 280px)", minHeight:360 }}>
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, padding:"10px 0" }}>
          {threadMessages.map((msg,i) => {
            const prev = threadMessages[i-1];
            return (
              <div key={msg.id} style={{ marginTop: prev?.username===msg.username?1:8 }}>
                <MsgBubble msg={msg} myUser={myUser} onLike={m=>likeMessage(m,"thread_messages")} />
              </div>
            );
          })}
          <TypingIndicator users={thTyping} />
          <div ref={endRef}/>
        </div>
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:10 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={{...st.inp,flex:1}} value={thText} onChange={e=>{setThText(e.target.value);setThTyping(e.target.value.length>0);}}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ta réponse..."/>
            <button style={{ width:36, height:36, borderRadius:"50%", border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", cursor:"pointer", fontSize:15 }} onClick={send}>➤</button>
            <button style={st.btn()} onClick={()=>threadFileRef.current.click()} disabled={uploading}>{uploading?"⏳":"📎"}</button>
          </div>
          <input type="file" ref={threadFileRef} style={{display:"none"}} accept="image/*,.pdf,.doc,.docx" onChange={e=>{if(e.target.files[0])handleThreadFile(e.target.files[0]);e.target.value="";}}/>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--text3)",background:"var(--bg)"}}><ThemeStyle dark={dark}/>Chargement...</div>;
  if (focusMode) return <><ThemeStyle dark={dark}/><FocusMode homework={homework} onExit={()=>setFocusMode(false)}/></>;

  const hour = new Date().getHours();

  return (
    <div style={st.container}>
      <ThemeStyle dark={dark}/>

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
        <div>
          <h1 style={{ margin:"0 0 3px", fontSize:20, fontWeight:700, color:"var(--text)" }}>📚 Mon Cahier de Devoirs</h1>
          <p style={{ margin:0, fontSize:12, color:"var(--text3)" }}>{totalPending>0?`${totalPending} devoir${totalPending>1?"s":""} en attente`:"Tout est à jour ✓"}</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <NotificationBell
            unread={notif.unread}
            inbox={notif.inbox}
            onMarkRead={notif.markAllRead}
            onClear={notif.clearAll}
            prefs={notif.prefs}
            updatePref={notif.updatePref}
            permission={notif.permission}
            onRequestPermission={notif.requestPermission}
          />
          <button onClick={toggleDark} style={{ width:36, height:36, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--bbg)", cursor:"pointer", fontSize:16 }}>
            {dark?"☀️":"🌙"}
          </button>
          <button onClick={()=>setFocusMode(true)} style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#667eea,#764ba2)", color:"#fff", fontWeight:600, cursor:"pointer", fontSize:13 }}>
            🎯 Focus
          </button>
        </div>
      </div>
      <div style={{ fontSize:10, color:"var(--text3)", textAlign:"right", marginBottom:"0.6rem" }}>
        {dark?"🌙 nuit":"☀️ jour"} · <span style={{ cursor:"pointer", textDecoration:"underline" }} onClick={toggleDark}>forcer</span>
      </div>

      <Countdown dark={dark}/>

      {/* Tabs */}
      <div style={st.tabs}>
        <button style={st.tab(tab==="devoirs")} onClick={()=>{setTab("devoirs");setSub(null);}}>Devoirs {totalPending>0&&`· ${totalPending}`}</button>
        <button style={st.tab(tab==="partage")} onClick={()=>setTab("partage")}>
          💬 Espace partagé {chatOnline.length>0&&<span style={{marginLeft:4,fontSize:10,color:"#22c55e"}}>● {chatOnline.length}</span>}
        </button>
        <button style={st.tab(tab==="forums")} onClick={()=>{setTab("forums");setSelThread(null);setThreadSubject(null);}}>🗂️ Forums</button>
      </div>

      {/* ── DEVOIRS ── */}
      {tab==="devoirs"&&!selectedSubject&&(
        <div className="fade-up" style={st.grid}>
          {SUBJECTS.map(sub=>{
            const p=pending(sub.id);const first=hwFor(sub.id).filter(h=>!h.done)[0];
            return(
              <div key={sub.id} className="card-lift" style={st.card(sub.color,p>0)} onClick={()=>setSub(sub.id)}>
                <div style={{fontSize:26,marginBottom:8}}>{sub.icon}</div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{sub.name}</div>
                <div style={st.badge(sub.color,p>0)}>{p>0?`${p} à faire`:"Rien ✓"}</div>
                {first&&<div style={{marginTop:8,fontSize:11,color:"var(--text3)",borderLeft:`2px solid ${sub.color}`,paddingLeft:6,lineHeight:1.4}}>{first.text.slice(0,50)}{first.text.length>50?"…":""}</div>}
              </div>
            );
          })}
        </div>
      )}

      {tab==="devoirs"&&subject&&(
        <div className="fade-up">
          <button style={st.back} onClick={()=>setSub(null)}>← Toutes les matières</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem"}}>
            <span style={{fontSize:30}}>{subject.icon}</span>
            <div>
              <h2 style={{margin:0,fontSize:17,fontWeight:700,color:"var(--text)"}}>{subject.name}</h2>
              <span style={{fontSize:12,color:subject.color}}>{pending(subject.id)} devoir{pending(subject.id)!==1?"s":""} en attente</span>
            </div>
          </div>
          <div style={st.form}>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Ajouter un devoir partagé</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input style={st.inp} value={newHW.text} onChange={e=>setNewHW(p=>({...p,text:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addHomework()} placeholder="Ex : Ex 12 p.47, rédaction..."/>
              <input type="date" style={st.inpSm} value={newHW.date} onChange={e=>setNewHW(p=>({...p,date:e.target.value}))}/>
              <button style={st.btn(subject.color)} onClick={addHomework}>Ajouter</button>
            </div>
          </div>
          {hwFor(subject.id).length===0?(
            <div style={{textAlign:"center",color:"var(--text3)",fontSize:14,padding:"2rem 0"}}>Aucun devoir 🎉</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...hwFor(subject.id).filter(h=>!h.done),...hwFor(subject.id).filter(h=>h.done)].map(item=>(
                <HwItem key={item.id} item={item} subject={subject} myUser={myUser} onToggle={toggleDone} onDelete={deleteHW}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ESPACE PARTAGÉ (Social) ── */}
      {tab==="partage"&&(
        <div className="fade-up">
          <UsernameBox/>
          <SocialChat
            messages={messages}
            myUser={myUser}
            onSend={sendMainMessage}
            onLike={m=>likeMessage(m,"messages")}
            onFileUpload={handleMainFile}
            typingUsers={chatTyping}
            onlineUsers={chatOnline}
            uploading={uploading}
          />
          {usernameSet && (
            <div style={{textAlign:"right",marginTop:6}}>
              <button style={{fontSize:11,padding:"3px 8px",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",background:"var(--bbg)",color:"var(--text2)"}} onClick={()=>setUsernameSet(false)}>Changer de nom</button>
            </div>
          )}
        </div>
      )}

      {/* ── FORUMS ── */}
      {tab==="forums"&&!selectedThread&&(
        <div className="fade-up">
          <UsernameBox/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:"1rem"}}>
            <button style={st.pill("#6b7280",threadSubject===null)} onClick={()=>setThreadSubject(null)}>Toutes</button>
            {SUBJECTS.map(sub=><button key={sub.id} style={st.pill(sub.color,threadSubject===sub.id)} onClick={()=>setThreadSubject(sub.id)}>{sub.icon} {sub.name}</button>)}
          </div>
          <div style={{marginBottom:"1rem"}}>
            {!showNewThread
              ?<button style={{...st.btn("#6366f1"),width:"100%",textAlign:"center"}} onClick={()=>setShowNewThread(true)}>+ Créer un fil de discussion</button>
              :<div style={st.form}>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Nouveau fil</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <select style={{...st.inpSm,flex:"1 1 140px"}} value={threadSubject||""} onChange={e=>setThreadSubject(e.target.value||null)}>
                    <option value="">Choisir une matière...</option>
                    {SUBJECTS.map(sub=><option key={sub.id} value={sub.id}>{sub.icon} {sub.name}</option>)}
                  </select>
                  <input style={st.inp} value={newThreadTitle} onChange={e=>setNewThreadTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createThread()} placeholder="Titre du fil..."/>
                  <button style={st.btn("#6366f1")} onClick={createThread}>Créer</button>
                  <button style={st.btn()} onClick={()=>setShowNewThread(false)}>Annuler</button>
                </div>
              </div>}
          </div>
          {(threadSubject?threadsFor(threadSubject):threads).length===0?(
            <div style={{textAlign:"center",color:"var(--text3)",fontSize:14,padding:"2rem 0"}}>Aucun fil encore.</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(threadSubject?threadsFor(threadSubject):threads).map(thread=>{
                const sub=SUBJECTS.find(s=>s.id===thread.subject_id);
                return(
                  <div key={thread.id} className="card-lift" style={st.threadCard} onClick={()=>openThread(thread)}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:20}}>{sub?.icon||"💬"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{thread.title}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{sub?.name} · {thread.created_by} · {new Date(thread.created_at).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <span style={{color:"var(--text3)",fontSize:14}}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab==="forums"&&selectedThread&&(
        <div className="fade-up">
          <button style={st.back} onClick={()=>{setSelThread(null);setThreadMsgs([]);}}>← Retour aux fils</button>
          {(()=>{
            const sub=SUBJECTS.find(s=>s.id===selectedThread.subject_id);
            return(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"0.75rem",padding:"10px 14px",background:"var(--card)",borderRadius:12,border:"1px solid var(--border)"}}>
                <span style={{fontSize:24}}>{sub?.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:"var(--text)"}}>{selectedThread.title}</div>
                  <div style={{fontSize:11,color:"var(--text3)"}}>{sub?.name} · {selectedThread.created_by}
                    {thOnline.length>0&&<span style={{color:"#22c55e",marginLeft:8}}>● {thOnline.length} en ligne</span>}
                  </div>
                </div>
                <button onClick={()=>notif.watchThread(selectedThread.id)}
                  title={notif.isWatching(selectedThread.id)?"Ne plus suivre ce fil":"Suivre ce fil"}
                  style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${notif.isWatching(selectedThread.id)?"#6366f1":"var(--border)"}`, background:notif.isWatching(selectedThread.id)?"#6366f120":"var(--bbg)", color:notif.isWatching(selectedThread.id)?"#6366f1":"var(--text3)", fontSize:11, cursor:"pointer", fontWeight:600, flexShrink:0 }}>
                  {notif.isWatching(selectedThread.id)?"🔔 Suivi":"🔕 Suivre"}
                </button>
              </div>
            );
          })()}
          <ThreadChatBox/>
        </div>
      )}
    </div>
  );
}
