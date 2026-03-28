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

// ─── DARK MODE HOOK ──────────────────────────────────────────────────────────
function useDarkMode() {
  function shouldBeDark() {
    const h = new Date().getHours();
    const nightTime = h >= 20 || h < 7;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return nightTime || systemDark;
  }
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    return shouldBeDark();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const saved = localStorage.getItem("darkMode");
      if (saved === null) setDark(shouldBeDark());
    }, 60000);
    return () => clearInterval(id);
  }, []);
  const toggle = useCallback(() => {
    setDark(d => { localStorage.setItem("darkMode", String(!d)); return !d; });
  }, []);
  return [dark, toggle];
}

// ─── CSS VARIABLES + ANIMATIONS ──────────────────────────────────────────────
function ThemeStyle({ dark }) {
  const vars = dark ? `
    :root{--bg:#0f0f1a;--bg2:#1a1a2e;--bg3:#16213e;--card:#1e1e30;--border:#2a2a45;--border2:#3a3a5a;--text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;--input-bg:#1a1a2e;--btn-bg:#1e1e30;}
    body{background:#0f0f1a!important;}
  ` : `
    :root{--bg:#f8fafc;--bg2:#ffffff;--bg3:#f1f5f9;--card:#ffffff;--border:#e2e8f0;--border2:#cbd5e1;--text:#0f172a;--text2:#64748b;--text3:#94a3b8;--input-bg:#ffffff;--btn-bg:#ffffff;}
    body{background:#f8fafc!important;}
  `;
  const anim = `
    @keyframes fadeInDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes fadeOutRight{from{opacity:1;transform:translateX(0) scale(1)}to{opacity:0;transform:translateX(40px) scale(0.95)}}
    @keyframes checkPop{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
    @keyframes pulseBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
    *{transition:background-color 0.3s ease,border-color 0.3s ease,color 0.2s ease;}
    input,select,textarea{background:var(--input-bg)!important;color:var(--text)!important;border-color:var(--border)!important;transition:background-color 0.3s,border-color 0.3s,box-shadow 0.2s!important;}
    input:focus,select:focus,textarea:focus{outline:none!important;box-shadow:0 0 0 3px rgba(99,102,241,0.3)!important;border-color:#6366f1!important;}
    button{transition:opacity 0.15s,transform 0.1s!important;}
    button:hover{opacity:0.82;}
    button:active{transform:scale(0.97);}
    .hw-item{animation:slideIn 0.3s ease;}
    .hw-item.checking{animation:fadeOutRight 0.38s ease forwards;}
    .card-hover{transition:transform 0.2s ease,box-shadow 0.2s ease!important;}
    .card-hover:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.13)!important;}
    .fade-in{animation:fadeInDown 0.35s ease;}
    ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:var(--bg3);} ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
  `;
  return <style>{vars + anim}</style>;
}

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────
function Countdown({ dark }) {
  const [tl, setTl] = useState(null);
  useEffect(() => {
    const fn = () => {
      const diff = CONCOURS_DATE - new Date();
      if (diff <= 0) { setTl(null); return; }
      setTl({ days:Math.floor(diff/86400000), hours:Math.floor((diff%86400000)/3600000), minutes:Math.floor((diff%3600000)/60000), seconds:Math.floor((diff%60000)/1000) });
    };
    fn(); const id=setInterval(fn,1000); return()=>clearInterval(id);
  },[]);
  if(!tl)return null;
  const urgency = tl.days<7?"#ef4444":tl.days<30?"#f59e0b":"#8b5cf6";
  const bg = dark
    ? (tl.days<7?"#450a0a":tl.days<30?"#451a03":"#2e1065")
    : (tl.days<7?"#fff1f2":tl.days<30?"#fffbeb":"#f5f3ff");
  return (
    <div className="fade-in" style={{background:bg,border:`1px solid ${urgency}44`,borderRadius:12,padding:"12px 16px",marginBottom:"1rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:20,display:"inline-block",animation:"pulseBeat 2s ease infinite"}}>🎯</span>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:urgency,textTransform:"uppercase",letterSpacing:"0.05em"}}>Concours Blanc — 30 mai 2026</div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Chaque minute compte. Bonne révision !</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        {[{val:tl.days,label:"jours"},{val:tl.hours,label:"heures"},{val:tl.minutes,label:"min"},{val:tl.seconds,label:"sec"}].map(({val,label})=>(
          <div key={label} style={{textAlign:"center",background:"var(--card)",border:`1px solid ${urgency}44`,borderRadius:8,padding:"6px 10px",minWidth:48}}>
            <div style={{fontSize:20,fontWeight:800,color:urgency,fontVariantNumeric:"tabular-nums",lineHeight:1}}>{String(val).padStart(2,"0")}</div>
            <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function Avatar({ name }) {
  const colors=["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899"];
  const idx=(name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)%colors.length;
  return <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,background:colors[idx]+"22",color:colors[idx],border:`1px solid ${colors[idx]}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600}}>{(name||"?")[0].toUpperCase()}</div>;
}

// ─── FILES ───────────────────────────────────────────────────────────────────
const isImage=u=>u&&/\.(jpg|jpeg|png|gif|webp)$/i.test(u);
const isPdf=u=>u&&/\.pdf$/i.test(u);
function renderFile(url,name){
  if(!url)return null;
  if(isImage(url))return<img src={url} alt={name} style={{maxWidth:260,maxHeight:200,borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",marginTop:6,display:"block"}} onClick={()=>window.open(url,"_blank")}/>;
  if(isPdf(url))return<a href={url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",background:"#fee2e2",color:"#dc2626",borderRadius:8,fontSize:13,textDecoration:"none",marginTop:6}}>📄 {name||"PDF"}</a>;
  return<a href={url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",background:"var(--bg3)",color:"var(--text2)",borderRadius:8,fontSize:13,textDecoration:"none",marginTop:6}}>📎 {name||"Fichier"}</a>;
}

// ─── POMODORO ────────────────────────────────────────────────────────────────
function Pomodoro(){
  const[phase,setPhase]=useState("work");const[seconds,setSeconds]=useState(25*60);const[running,setRunning]=useState(false);const[cycles,setCycles]=useState(0);const ref=useRef(null);
  useEffect(()=>{
    if(running){ref.current=setInterval(()=>{setSeconds(s=>{if(s<=1){clearInterval(ref.current);setRunning(false);if(phase==="work"){setPhase("break");setSeconds(5*60);setCycles(c=>c+1);}else{setPhase("work");setSeconds(25*60);}return 0;}return s-1;});},1000);}else clearInterval(ref.current);return()=>clearInterval(ref.current);
  },[running,phase]);
  const mm=String(Math.floor(seconds/60)).padStart(2,"0");const ss=String(seconds%60).padStart(2,"0");
  const pct=phase==="work"?1-seconds/(25*60):1-seconds/(5*60);const color=phase==="work"?"#8B5CF6":"#10B981";
  return(
    <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
      <div style={{position:"relative",width:140,height:140,margin:"0 auto 12px"}}>
        <svg width="140" height="140" style={{transform:"rotate(-90deg)"}}>
          <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border)" strokeWidth="8"/>
          <circle cx="70" cy="70" r="60" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${2*Math.PI*60}`} strokeDashoffset={`${2*Math.PI*60*(1-pct)}`} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
        </svg>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
          <div style={{fontSize:26,fontWeight:700,color:"var(--text)",fontVariantNumeric:"tabular-nums"}}>{mm}:{ss}</div>
          <div style={{fontSize:11,color,fontWeight:600}}>{phase==="work"?"FOCUS":"PAUSE"}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:8}}>
        <button onClick={()=>setRunning(r=>!r)} style={{padding:"8px 20px",borderRadius:8,border:"none",background:running?"#fee2e2":color,color:running?"#dc2626":"#fff",fontWeight:600,cursor:"pointer",fontSize:14}}>{running?"⏸ Pause":"▶ Démarrer"}</button>
        <button onClick={()=>{setRunning(false);setPhase("work");setSeconds(25*60);}} style={{padding:"8px 14px",borderRadius:8,border:"1px solid var(--border)",background:"var(--btn-bg)",color:"var(--text2)",cursor:"pointer",fontSize:14}}>↺</button>
      </div>
      <div style={{fontSize:12,color:"var(--text3)"}}>🍅 {cycles} cycles · 25min travail / 5min pause</div>
    </div>
  );
}

// ─── FOCUS MODE ──────────────────────────────────────────────────────────────
function FocusMode({homework,onExit}){
  const pending=homework.filter(h=>!h.done);const[lofiIdx,setLofiIdx]=useState(0);const[lofiOn,setLofiOn]=useState(false);
  return(
    <div style={{position:"fixed",inset:0,background:"#0f0f1a",zIndex:1000,display:"flex",flexDirection:"column",padding:"1.5rem",overflowY:"auto",animation:"fadeInDown 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <div><h2 style={{margin:0,fontSize:18,fontWeight:700,color:"#e2e8f0"}}>🎯 Mode Focus</h2><p style={{margin:0,fontSize:12,color:"#64748b"}}>Concentre-toi. Tu peux le faire.</p></div>
        <button onClick={onExit} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:13}}>✕ Quitter</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem",maxWidth:900,margin:"0 auto",width:"100%"}}>
        <div>
          <div style={{background:"#1e1e2e",borderRadius:14,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:12}}>📋 Devoirs à faire ({pending.length})</div>
            {pending.length===0?<div style={{color:"#64748b",fontSize:13}}>🎉 Tout est fait !</div>:(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {pending.map(hw=>{const sub=SUBJECTS.find(s=>s.id===hw.subject_id);return(
                  <div key={hw.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:"#2d2d44",borderRadius:8,borderLeft:`3px solid ${sub?.color||"#6366f1"}`,animation:"slideIn 0.3s ease"}}>
                    <span style={{fontSize:16}}>{sub?.icon}</span>
                    <div><div style={{fontSize:13,color:"#e2e8f0"}}>{hw.text}</div>{hw.date&&<div style={{fontSize:11,color:sub?.color||"#a78bfa"}}>Pour le {new Date(hw.date+"T12:00:00").toLocaleDateString("fr-FR")}</div>}</div>
                  </div>
                );})}
              </div>
            )}
          </div>
          <div style={{background:"#1e1e2e",borderRadius:14,padding:"1rem"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:10}}>🎧 Musique Lo-Fi</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {LOFI_STREAMS.map((l,i)=><button key={i} onClick={()=>{setLofiIdx(i);setLofiOn(true);}} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${lofiIdx===i&&lofiOn?"#7c3aed":"#334155"}`,background:lofiIdx===i&&lofiOn?"#4c1d95":"transparent",color:lofiIdx===i&&lofiOn?"#e2e8f0":"#94a3b8",fontSize:12,cursor:"pointer"}}>{l.name}</button>)}
              <button onClick={()=>setLofiOn(false)} style={{padding:"5px 10px",borderRadius:8,border:"1px solid #334155",background:"transparent",color:"#ef4444",fontSize:12,cursor:"pointer"}}>⏹ Stop</button>
            </div>
            {lofiOn?<iframe src={LOFI_STREAMS[lofiIdx].url} style={{width:"100%",height:80,border:"none",borderRadius:8,display:"block"}} allow="autoplay" title="lofi"/>:<div style={{fontSize:12,color:"#475569",textAlign:"center",padding:"12px 0"}}>Clique sur un style 🎵</div>}
          </div>
        </div>
        <div style={{background:"#1e1e2e",borderRadius:14,padding:"1.5rem"}}>
          <div style={{fontSize:13,fontWeight:600,color:"#a78bfa",marginBottom:"1rem"}}>🍅 Timer Pomodoro</div>
          <Pomodoro/>
          <div style={{marginTop:"1rem",background:"#2d2d44",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#94a3b8",lineHeight:1.6}}>
            <strong style={{color:"#e2e8f0"}}>Méthode Pomodoro :</strong><br/>▶ 25 min de travail intense<br/>☕ 5 min de pause<br/>🔄 Répète 4x puis grande pause
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MENTORAT ─────────────────────────────────────────────────────────────────
function MentoratBadge({subjectId,username}){
  const[mentors,setMentors]=useState([]);const[myStatus,setMyStatus]=useState(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{load();},[subjectId]);
  async function load(){setLoading(true);const{data}=await supabase.from("mentors").select("*").eq("subject_id",subjectId);if(data){setMentors(data);if(username)setMyStatus(data.find(m=>m.username===username)?.status||null);}setLoading(false);}
  async function setStatus(status){const name=username||"Anonyme";const existing=mentors.find(m=>m.username===name);if(existing){if(existing.status===status){await supabase.from("mentors").delete().eq("id",existing.id);setMyStatus(null);}else{await supabase.from("mentors").update({status}).eq("id",existing.id);setMyStatus(status);}}else{await supabase.from("mentors").insert({subject_id:subjectId,username:name,status});setMyStatus(status);}load();}
  const helpers=mentors.filter(m=>m.status==="gere");const needers=mentors.filter(m=>m.status==="aide");
  return(
    <div className="fade-in" style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",marginTop:"1rem"}}>
      <div style={{fontSize:12,fontWeight:600,color:"var(--text)",marginBottom:8}}>🤝 Système d'entraide</div>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <button onClick={()=>setStatus("gere")} style={{padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:600,border:myStatus==="gere"?"2px solid #10B981":"1px solid var(--border)",background:myStatus==="gere"?"#d1fae5":"var(--btn-bg)",color:myStatus==="gere"?"#065f46":"var(--text2)"}}>✅ Je gère cette leçon</button>
        <button onClick={()=>setStatus("aide")} style={{padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:600,border:myStatus==="aide"?"2px solid #F59E0B":"1px solid var(--border)",background:myStatus==="aide"?"#fef3c7":"var(--btn-bg)",color:myStatus==="aide"?"#92400e":"var(--text2)"}}>🆘 J'ai besoin d'aide</button>
      </div>
      {!loading&&(<div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {helpers.length>0&&<div><div style={{fontSize:11,color:"#059669",fontWeight:600,marginBottom:4}}>✅ Peuvent aider :</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{helpers.map(m=><span key={m.id} style={{fontSize:11,background:"#d1fae5",color:"#065f46",padding:"2px 8px",borderRadius:20}}>⭐ {m.username}</span>)}</div></div>}
        {needers.length>0&&<div><div style={{fontSize:11,color:"#d97706",fontWeight:600,marginBottom:4}}>🆘 Cherchent de l'aide :</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{needers.map(m=><span key={m.id} style={{fontSize:11,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:20}}>{m.username}</span>)}</div></div>}
        {helpers.length===0&&needers.length===0&&<span style={{fontSize:11,color:"var(--text3)"}}>Personne n'a encore indiqué son statut.</span>}
      </div>)}
    </div>
  );
}

// ─── DEVOIR ITEM ANIMÉ ────────────────────────────────────────────────────────
function HwItem({item,subject,onToggle,onDelete}){
  const[checking,setChecking]=useState(false);
  function handleToggle(){
    if(!item.done){setChecking(true);setTimeout(()=>{onToggle(item.id,item.done);setChecking(false);},350);}
    else onToggle(item.id,item.done);
  }
  return(
    <div className={`hw-item${checking?" checking":""}`} style={{display:"flex",alignItems:"center",gap:12,background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",opacity:item.done?0.5:1}}>
      <input type="checkbox" checked={item.done} onChange={handleToggle} style={{width:16,height:16,cursor:"pointer",flexShrink:0,accentColor:subject.color}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,color:"var(--text)",textDecoration:item.done?"line-through":"none"}}>{item.text}</div>
        <div style={{display:"flex",gap:10,marginTop:2,flexWrap:"wrap"}}>
          {item.date&&<span style={{fontSize:11,color:subject.color}}>Pour le {new Date(item.date+"T12:00:00").toLocaleDateString("fr-FR")}</span>}
          {item.added_by&&<span style={{fontSize:11,color:"var(--text3)"}}>par {item.added_by}</span>}
        </div>
      </div>
      <button onClick={()=>onDelete(item.id)} style={{padding:"4px 8px",border:"none",borderRadius:6,background:"#fee2e2",color:"#dc2626",fontSize:11,cursor:"pointer"}}>Suppr.</button>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const[dark,toggleDark]=useDarkMode();
  const[tab,setTab]=useState("devoirs");const[selectedSubject,setSelectedSubject]=useState(null);
  const[homework,setHomework]=useState([]);const[messages,setMessages]=useState([]);
  const[newHW,setNewHW]=useState({text:"",date:""});const[newMsg,setNewMsg]=useState("");
  const[username,setUsername]=useState(()=>localStorage.getItem("username")||"");
  const[usernameSet,setUsernameSet]=useState(()=>!!localStorage.getItem("username"));
  const[loading,setLoading]=useState(true);const[uploading,setUploading]=useState(false);const[focusMode,setFocusMode]=useState(false);
  const[threads,setThreads]=useState([]);const[selectedThread,setSelectedThread]=useState(null);const[threadMessages,setThreadMessages]=useState([]);
  const[newThreadTitle,setNewThreadTitle]=useState("");const[showNewThread,setShowNewThread]=useState(false);const[newThreadMsg,setNewThreadMsg]=useState("");const[threadSubject,setThreadSubject]=useState(null);
  const messagesEndRef=useRef(null);const threadEndRef=useRef(null);const fileInputRef=useRef(null);const threadFileRef=useRef(null);

  useEffect(()=>{loadAll();},[]);
  useEffect(()=>{const ch=supabase.channel("messages").on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},p=>{setMessages(prev=>[...prev,p.new]);setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:"smooth"}),100);}).subscribe();return()=>supabase.removeChannel(ch);},[]);
  useEffect(()=>{if(!selectedThread)return;const ch=supabase.channel("thread_messages").on("postgres_changes",{event:"INSERT",schema:"public",table:"thread_messages"},p=>{if(p.new.thread_id===selectedThread.id){setThreadMessages(prev=>[...prev,p.new]);setTimeout(()=>threadEndRef.current?.scrollIntoView({behavior:"smooth"}),100);}}).subscribe();return()=>supabase.removeChannel(ch);},[selectedThread]);
  useEffect(()=>{const ch=supabase.channel("devoirs").on("postgres_changes",{event:"*",schema:"public",table:"devoirs"},()=>loadHomework()).subscribe();return()=>supabase.removeChannel(ch);},[]);

  async function loadAll(){await Promise.all([loadHomework(),loadMessages(),loadThreads()]);setLoading(false);}
  async function loadHomework(){const{data}=await supabase.from("devoirs").select("*").order("created_at");if(data)setHomework(data);}
  async function loadMessages(){const{data}=await supabase.from("messages").select("*").order("created_at");if(data)setMessages(data);}
  async function loadThreads(){const{data}=await supabase.from("threads").select("*").order("created_at",{ascending:false});if(data)setThreads(data);}
  async function loadThreadMessages(id){const{data}=await supabase.from("thread_messages").select("*").eq("thread_id",id).order("created_at");if(data)setThreadMessages(data);}
  async function openThread(t){setSelectedThread(t);await loadThreadMessages(t.id);}
  async function createThread(){if(!newThreadTitle.trim()||!threadSubject)return;const{data}=await supabase.from("threads").insert({subject_id:threadSubject,title:newThreadTitle.trim(),created_by:username.trim()||"Anonyme"}).select().single();if(data){setThreads(prev=>[data,...prev]);setNewThreadTitle("");setShowNewThread(false);openThread(data);}}
  async function addHomework(){if(!newHW.text.trim()||!selectedSubject)return;await supabase.from("devoirs").insert({subject_id:selectedSubject,text:newHW.text.trim(),date:newHW.date||null,done:false,added_by:username.trim()||"Anonyme"});setNewHW({text:"",date:""});}
  async function toggleDone(id,done){await supabase.from("devoirs").update({done:!done}).eq("id",id);setHomework(prev=>prev.map(h=>h.id===id?{...h,done:!done}:h));}
  async function deleteHW(id){await supabase.from("devoirs").delete().eq("id",id);setHomework(prev=>prev.filter(h=>h.id!==id));}
  async function sendMessage(fileUrl=null,fileName=null){const text=newMsg.trim();if(!text&&!fileUrl)return;const now=new Date();const time=now.toLocaleString("fr-FR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});await supabase.from("messages").insert({username:username.trim()||"Anonyme",text:text||"",time,file_url:fileUrl||null,file_name:fileName||null});setNewMsg("");}
  async function sendThreadMessage(fileUrl=null,fileName=null){const text=newThreadMsg.trim();if(!text&&!fileUrl)return;const now=new Date();const time=now.toLocaleString("fr-FR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});await supabase.from("thread_messages").insert({thread_id:selectedThread.id,username:username.trim()||"Anonyme",text:text||"",time,file_url:fileUrl||null,file_name:fileName||null});setNewThreadMsg("");}
  async function handleFileUpload(e,isThread=false){const file=e.target.files[0];if(!file)return;setUploading(true);const ext=file.name.split(".").pop();const fileName=`${Date.now()}.${ext}`;const{error}=await supabase.storage.from("corrections").upload(fileName,file,{cacheControl:"3600",upsert:false});if(error){alert("Erreur upload : "+error.message);setUploading(false);return;}const{data:urlData}=supabase.storage.from("corrections").getPublicUrl(fileName);if(isThread)await sendThreadMessage(urlData.publicUrl,file.name);else await sendMessage(urlData.publicUrl,file.name);setUploading(false);e.target.value="";}

  const hwForSubject=id=>homework.filter(h=>h.subject_id===id);
  const pending=id=>hwForSubject(id).filter(h=>!h.done).length;
  const totalPending=SUBJECTS.reduce((a,s)=>a+pending(s.id),0);
  const subject=SUBJECTS.find(s=>s.id===selectedSubject);
  const threadsForSubject=id=>threads.filter(t=>t.subject_id===id);

  const st={
    container:{fontFamily:"system-ui,sans-serif",padding:"1rem",maxWidth:760,margin:"0 auto",background:"var(--bg)",minHeight:"100vh"},
    tabs:{display:"flex",gap:8,margin:"1rem 0",borderBottom:"1px solid var(--border)",paddingBottom:"0.75rem",flexWrap:"wrap"},
    tab:a=>({padding:"6px 14px",border:`1px solid ${a?"var(--border2)":"var(--border)"}`,borderRadius:8,background:a?"var(--card)":"transparent",fontSize:13,fontWeight:a?500:400,color:a?"var(--text)":"var(--text3)",cursor:"pointer"}),
    grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))",gap:12},
    card:(c,has)=>({background:"var(--card)",border:has?`2px solid ${c}`:"1px solid var(--border)",borderRadius:12,padding:"1rem",cursor:"pointer"}),
    badge:(c,has)=>({display:"inline-block",fontSize:11,padding:"2px 8px",borderRadius:6,marginTop:8,background:has?c+"22":"var(--bg3)",color:has?c:"var(--text3)"}),
    backBtn:{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:13,padding:0,marginBottom:"1rem"},
    formBox:{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,padding:"1rem",marginBottom:"1.5rem"},
    input:{flex:"2 1 200px",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:14,outline:"none",background:"var(--input-bg)",color:"var(--text)"},
    inputSm:{flex:"1 1 130px",padding:"8px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:14,outline:"none",background:"var(--input-bg)",color:"var(--text)"},
    btn:c=>({padding:"8px 16px",border:"1px solid var(--border)",borderRadius:8,background:"var(--btn-bg)",color:c||"var(--text)",fontSize:14,cursor:"pointer",fontWeight:500}),
    chatBox:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"1rem",minHeight:280,maxHeight:400,overflowY:"auto",marginBottom:12,display:"flex",flexDirection:"column",gap:14},
    bubble:{background:"var(--bg3)",borderRadius:"0 8px 8px 8px",padding:"8px 12px",fontSize:14,color:"var(--text)",display:"inline-block",maxWidth:"90%",lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word"},
    userBox:{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,padding:"1rem",marginBottom:"1.25rem"},
    uploadBtn:{padding:"8px 12px",border:"1px solid var(--border)",borderRadius:8,background:"var(--btn-bg)",fontSize:14,cursor:"pointer",color:"var(--text2)"},
    threadCard:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",cursor:"pointer"},
    pill:(c,a)=>({padding:"5px 12px",borderRadius:20,border:a?`2px solid ${c}`:"1px solid var(--border)",background:a?c+"18":"var(--btn-bg)",color:a?c:"var(--text3)",fontSize:12,cursor:"pointer",fontWeight:a?600:400}),
  };

  const UsernameBox=()=>!usernameSet?(
    <div style={st.userBox}>
      <div style={{fontSize:13,fontWeight:600,marginBottom:4,color:"var(--text)"}}>Ton prénom (optionnel)</div>
      <div style={{display:"flex",gap:8}}>
        <input style={{...st.input,flex:1}} value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(localStorage.setItem("username",username.trim()||"Anonyme"),setUsernameSet(true))} placeholder="Ton prénom..."/>
        <button style={st.btn()} onClick={()=>{localStorage.setItem("username",username.trim()||"Anonyme");setUsernameSet(true);}}>{username.trim()?"Confirmer":"Anonyme"}</button>
      </div>
    </div>
  ):null;

  const ChatMessages=({msgs,endRef})=>(
    <div style={st.chatBox}>
      {msgs.length===0?<div style={{textAlign:"center",color:"var(--text3)",fontSize:14,margin:"auto"}}>Aucun message encore.</div>
      :msgs.map(msg=>(
        <div key={msg.id} style={{display:"flex",gap:10,alignItems:"flex-start",animation:"slideIn 0.3s ease"}}>
          <Avatar name={msg.username}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"baseline",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{msg.username}</span>
              <span style={{fontSize:11,color:"var(--text3)"}}>{msg.time}</span>
            </div>
            {msg.text&&<div style={st.bubble}>{msg.text}</div>}
            {renderFile(msg.file_url,msg.file_name)}
          </div>
        </div>
      ))}
      <div ref={endRef}/>
    </div>
  );

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"var(--text3)",fontSize:14,background:"var(--bg)"}}><ThemeStyle dark={dark}/>Chargement...</div>);
  if(focusMode)return<><ThemeStyle dark={dark}/><FocusMode homework={homework} onExit={()=>setFocusMode(false)}/></>;

  const hour = new Date().getHours();
  const autoReason = hour >= 20 || hour < 7 ? "nuit" : "jour";

  return(
    <div style={st.container}>
      <ThemeStyle dark={dark}/>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.5rem"}}>
        <div>
          <h1 style={{margin:"0 0 4px",fontSize:20,fontWeight:600,color:"var(--text)"}}>📚 Mon Cahier de Devoirs</h1>
          <p style={{margin:0,fontSize:13,color:"var(--text3)"}}>{totalPending>0?`${totalPending} devoir${totalPending>1?"s":""} en attente`:"Tout est à jour ✓"}</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={toggleDark} title={dark?"Mode clair":"Mode sombre"}
            style={{padding:"8px 12px",borderRadius:10,border:"1px solid var(--border)",background:"var(--btn-bg)",cursor:"pointer",fontSize:18,lineHeight:1}}>
            {dark?"☀️":"🌙"}
          </button>
          <button onClick={()=>setFocusMode(true)} style={{padding:"8px 16px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:13}}>
            🎯 Focus
          </button>
        </div>
      </div>
      <div style={{fontSize:11,color:"var(--text3)",textAlign:"right",marginBottom:"0.75rem"}}>
        {dark?"🌙":"☀️"} Mode {dark?"sombre":"clair"} — automatique ({autoReason}) ·{" "}
        <span style={{cursor:"pointer",textDecoration:"underline",color:"var(--text2)"}} onClick={toggleDark}>forcer</span>
      </div>

      <Countdown dark={dark}/>

      <div style={st.tabs}>
        <button style={st.tab(tab==="devoirs")} onClick={()=>{setTab("devoirs");setSelectedSubject(null);}}>Devoirs {totalPending>0&&`· ${totalPending}`}</button>
        <button style={st.tab(tab==="partage")} onClick={()=>{setTab("partage");setSelectedThread(null);}}>💬 Espace partagé</button>
        <button style={st.tab(tab==="forums")} onClick={()=>{setTab("forums");setSelectedThread(null);setThreadSubject(null);}}>🗂️ Forums</button>
      </div>

      {/* ── DEVOIRS ── */}
      {tab==="devoirs"&&!selectedSubject&&(
        <div className="fade-in" style={st.grid}>
          {SUBJECTS.map(sub=>{const p=pending(sub.id);const first=hwForSubject(sub.id).filter(h=>!h.done)[0];return(
            <div key={sub.id} className="card-hover" style={st.card(sub.color,p>0)} onClick={()=>setSelectedSubject(sub.id)}>
              <div style={{fontSize:28,marginBottom:8}}>{sub.icon}</div>
              <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{sub.name}</div>
              <div style={st.badge(sub.color,p>0)}>{p>0?`${p} à faire`:"Rien à faire ✓"}</div>
              {first&&<div style={{marginTop:8,fontSize:11,color:"var(--text3)",borderLeft:`2px solid ${sub.color}`,paddingLeft:6,lineHeight:1.4}}>{first.text.slice(0,55)}{first.text.length>55?"…":""}</div>}
            </div>
          );})}
        </div>
      )}

      {tab==="devoirs"&&subject&&(
        <div className="fade-in">
          <button style={st.backBtn} onClick={()=>setSelectedSubject(null)}>← Toutes les matières</button>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
            <span style={{fontSize:32}}>{subject.icon}</span>
            <div><h2 style={{margin:0,fontSize:18,fontWeight:600,color:"var(--text)"}}>{subject.name}</h2><span style={{fontSize:12,color:subject.color}}>{pending(subject.id)} devoir{pending(subject.id)!==1?"s":""} en attente</span></div>
          </div>
          <div style={st.formBox}>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:4}}>Ajouter un devoir</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
              <input style={st.input} value={newHW.text} onChange={e=>setNewHW(p=>({...p,text:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addHomework()} placeholder="Ex : Ex 12 p.47, rédaction..."/>
              <input type="date" style={st.inputSm} value={newHW.date} onChange={e=>setNewHW(p=>({...p,date:e.target.value}))}/>
              <button style={st.btn(subject.color)} onClick={addHomework}>Ajouter</button>
            </div>
          </div>
          {hwForSubject(subject.id).length===0
            ?<div style={{textAlign:"center",color:"var(--text3)",fontSize:14,padding:"2rem 0"}}>Aucun devoir pour cette matière 🎉</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...hwForSubject(subject.id).filter(h=>!h.done),...hwForSubject(subject.id).filter(h=>h.done)].map(item=>(
                <HwItem key={item.id} item={item} subject={subject} onToggle={toggleDone} onDelete={deleteHW}/>
              ))}
            </div>}
          <MentoratBadge subjectId={subject.id} username={username||"Anonyme"}/>
        </div>
      )}

      {/* ── ESPACE PARTAGÉ ── */}
      {tab==="partage"&&(
        <div className="fade-in">
          <UsernameBox/>
          <ChatMessages msgs={messages} endRef={messagesEndRef}/>
          <div style={{display:"flex",gap:8}}>
            <input style={{...st.input,flex:1}} value={newMsg} onChange={e=>setNewMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} placeholder={usernameSet?`Écris un message en tant que ${username||"Anonyme"}…`:"Écris ton message…"}/>
            <button style={st.btn("#3B82F6")} onClick={()=>sendMessage()}>Envoyer</button>
            <button style={st.uploadBtn} onClick={()=>fileInputRef.current.click()} disabled={uploading}>{uploading?"⏳":"📎"}</button>
            <input type="file" ref={fileInputRef} style={{display:"none"}} accept="image/*,.pdf,.doc,.docx" onChange={e=>handleFileUpload(e,false)}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            <div style={{fontSize:11,color:"var(--text3)"}}>📎 pour envoyer une photo ou un fichier</div>
            {usernameSet&&<button style={{fontSize:11,padding:"3px 8px",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",background:"var(--btn-bg)",color:"var(--text2)"}} onClick={()=>setUsernameSet(false)}>Changer de nom</button>}
          </div>
        </div>
      )}

      {/* ── FORUMS ── */}
      {tab==="forums"&&!selectedThread&&(
        <div className="fade-in">
          <UsernameBox/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:"1rem"}}>
            <button style={st.pill("#6b7280",threadSubject===null)} onClick={()=>setThreadSubject(null)}>Toutes</button>
            {SUBJECTS.map(sub=><button key={sub.id} style={st.pill(sub.color,threadSubject===sub.id)} onClick={()=>setThreadSubject(sub.id)}>{sub.icon} {sub.name}</button>)}
          </div>
          <div style={{marginBottom:"1rem"}}>
            {!showNewThread
              ?<button style={{...st.btn("#3B82F6"),width:"100%",textAlign:"center"}} onClick={()=>setShowNewThread(true)}>+ Créer un fil de discussion</button>
              :<div style={st.formBox}>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Nouveau fil</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <select style={{...st.inputSm,flex:"1 1 140px"}} value={threadSubject||""} onChange={e=>setThreadSubject(e.target.value||null)}>
                    <option value="">Choisir une matière...</option>
                    {SUBJECTS.map(sub=><option key={sub.id} value={sub.id}>{sub.icon} {sub.name}</option>)}
                  </select>
                  <input style={st.input} value={newThreadTitle} onChange={e=>setNewThreadTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createThread()} placeholder="Titre du fil..."/>
                  <button style={st.btn("#3B82F6")} onClick={createThread}>Créer</button>
                  <button style={st.btn()} onClick={()=>setShowNewThread(false)}>Annuler</button>
                </div>
              </div>}
          </div>
          {(threadSubject?threadsForSubject(threadSubject):threads).length===0
            ?<div style={{textAlign:"center",color:"var(--text3)",fontSize:14,padding:"2rem 0"}}>Aucun fil encore. Crée le premier !</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(threadSubject?threadsForSubject(threadSubject):threads).map(thread=>{
                const sub=SUBJECTS.find(s=>s.id===thread.subject_id);
                return(<div key={thread.id} className="card-hover" style={st.threadCard} onClick={()=>openThread(thread)}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22}}>{sub?.icon||"💬"}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{thread.title}</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{sub?.name} · par {thread.created_by} · {new Date(thread.created_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                    <span style={{color:"var(--text3)"}}>→</span>
                  </div>
                </div>);
              })}
            </div>}
        </div>
      )}

      {tab==="forums"&&selectedThread&&(
        <div className="fade-in">
          <button style={st.backBtn} onClick={()=>{setSelectedThread(null);setThreadMessages([]);}}>← Retour aux fils</button>
          {(()=>{const sub=SUBJECTS.find(s=>s.id===selectedThread.subject_id);return(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1rem"}}>
              <span style={{fontSize:28}}>{sub?.icon}</span>
              <div><h2 style={{margin:0,fontSize:17,fontWeight:600,color:"var(--text)"}}>{selectedThread.title}</h2><span style={{fontSize:12,color:"var(--text3)"}}>{sub?.name} · par {selectedThread.created_by}</span></div>
            </div>
          );})()}
          <ChatMessages msgs={threadMessages} endRef={threadEndRef}/>
          <div style={{display:"flex",gap:8}}>
            <input style={{...st.input,flex:1}} value={newThreadMsg} onChange={e=>setNewThreadMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendThreadMessage()} placeholder={usernameSet?`Réponds en tant que ${username||"Anonyme"}…`:"Écris ta réponse…"}/>
            <button style={st.btn("#3B82F6")} onClick={()=>sendThreadMessage()}>Envoyer</button>
            <button style={st.uploadBtn} onClick={()=>threadFileRef.current.click()} disabled={uploading}>{uploading?"⏳":"📎"}</button>
            <input type="file" ref={threadFileRef} style={{display:"none"}} accept="image/*,.pdf,.doc,.docx" onChange={e=>handleFileUpload(e,true)}/>
          </div>
          <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>📎 pour envoyer une photo ou un fichier</div>
        </div>
      )}
    </div>
  );
}
