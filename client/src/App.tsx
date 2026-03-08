import { useState, useEffect, useCallback } from "react";

function CoinIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" fill="url(#cg)" stroke="#c8910a" strokeWidth="1.5"/>
      <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="'Figtree',sans-serif" fill="#7a4a00">$</text>
      <defs><linearGradient id="cg" x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffe066"/><stop offset="40%" stopColor="#ffd700"/><stop offset="100%" stopColor="#d4900a"/>
      </linearGradient></defs>
    </svg>
  );
}

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0)) || 0;

type User = { id: number; name: string; email: string; salaryBase?: string|number; xp?: number; level?: string; levelNum?: number; streakDays?: number; lastCheckin?: string; isNewUser?: boolean };
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string; recurring?: number; recurringMonths?: number; recurringGoal?: number };
type CC = { id: number; description: string; amount: string; subcategory?: string };
type Income = { id: number; description: string; amount: string; date: string };

const CATS = [
  { id: 1, name: "Pagar-se",    emoji: "💆", color: "#6c63ff" },
  { id: 2, name: "Doar",        emoji: "💝", color: "#ff6b9d" },
  { id: 3, name: "Investir",    emoji: "📈", color: "#00d68f" },
  { id: 4, name: "Contas",      emoji: "📋", color: "#ffb703" },
  { id: 5, name: "Objetivo",    emoji: "🎯", color: "#8b5cf6" },
  { id: 6, name: "Sonho",       emoji: "✨", color: "#06b6d4" },
  { id: 7, name: "Abundar",     emoji: "🌟", color: "#f97316" },
  { id: 8, name: "Variáveis",   emoji: "🛒", color: "#ef4444" },
];
const CC_CATS = ["Comida","Roupas","Gasolina","Transporte","Saúde","Streaming","Outros"];
const SONHO_ID = 6;
const calcXpIncome  = (a: number) => Math.max(1, Math.round(a));
const calcXpExpense = (a: number) => Math.max(1, Math.round(a * 0.05));
const XP_PAY_BILL = 15;

// ── SAÚDE FINANCEIRA ──────────────────────────────────────────────────────────
function calcHealthScore(salary: number, totalExp: number, totalIncome: number, totalPaid: number, totalAll: number, streakDays: number): number {
  if (salary <= 0) return 0;
  const receita = salary + totalIncome;
  // Componente 1: saldo (40pts) — proporção receita vs despesa
  const balanceRatio = receita > 0 ? Math.max(0, (receita - totalAll) / receita) : 0;
  const scoreBalance = Math.min(40, Math.round(balanceRatio * 60));
  // Componente 2: pagamento (30pts) — % contas pagas
  const scorePaid = totalAll > 0 ? Math.min(30, Math.round((totalPaid / totalAll) * 30)) : 15;
  // Componente 3: streak (20pts)
  const scoreStreak = Math.min(20, Math.round((Math.min(streakDays, 30) / 30) * 20));
  // Componente 4: renda extra (10pts)
  const scoreExtra = totalIncome > 0 ? Math.min(10, Math.round((totalIncome / (salary * 0.3)) * 10)) : 0;
  return Math.min(100, scoreBalance + scorePaid + scoreStreak + scoreExtra);
}

function getHealthBand(score: number): { label: string; color: string; bg: string; desc: string } {
  if (score >= 83) return { label: "Ótima",      color: "#00d68f", bg: "rgba(0,214,143,0.12)",   desc: "Vida financeira sem estresse — segurança e liberdade." };
  if (score >= 69) return { label: "Muito Boa",  color: "#4ade80", bg: "rgba(74,222,128,0.1)",   desc: "Domínio do dia a dia. Foque agora no patrimônio." };
  if (score >= 61) return { label: "Boa",        color: "#a3e635", bg: "rgba(163,230,53,0.1)",   desc: "Básico bem feito. Continue registrando." };
  if (score >= 57) return { label: "Ok",         color: "#facc15", bg: "rgba(250,204,21,0.1)",   desc: "Equilíbrio no limite. Pouco espaço para erro." };
  if (score >= 50) return { label: "Baixa",      color: "#fb923c", bg: "rgba(251,146,60,0.1)",   desc: "Primeiros sinais de desequilíbrio. Atenção agora." };
  if (score >= 37) return { label: "Muito Baixa",color: "#f97316", bg: "rgba(249,115,22,0.1)",   desc: "Risco de situação crítica. Revise seus gastos." };
  return              { label: "Ruim",           color: "#ff4d6a", bg: "rgba(255,77,106,0.12)",  desc: "Círculo de fragilidade. É hora de agir." };
}

const STREAK_PHRASES: Record<string, string[]> = {
  "1-3":  ["Controle hoje, tranquilidade amanhã.","Dinheiro visto é dinheiro protegido.","O hábito está nascendo. Não pare agora."],
  "3-7":  ["O controle está virando rotina.","Dinheiro organizado rende mais que dinheiro esquecido.","Você já não gasta no automático."],
  "7-14": ["Uma semana controlando o dinheiro. Isso não é sorte.","Controle é consistência. Você está comprovando isso."],
  "14-25":["Quinze dias. Disciplina cria liberdade.","O controle já virou hábito. Agora vira identidade."],
  "25-30":["Quase um mês. Isso é diferente de 99% das pessoas."],
  "30+":  ["Um mês inteiro. Isso é mentalidade, não sorte.","Riqueza nasce da constância."],
};
const REGISTRO_TEXTOS = [
  "Cada real registrado é um passo na direção da riqueza. Quem vê para onde o dinheiro vai, aprende a mandar nele.",
  "Riqueza não nasce do quanto você ganha — nasce do quanto você acompanha.",
  "O segredo dos ricos é saber exatamente o que entra e o que sai. Cada lançamento é um treino.",
];

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function getStreakPhrase(d: number) { return d>=30?rnd(STREAK_PHRASES["30+"]):d>=25?rnd(STREAK_PHRASES["25-30"]):d>=14?rnd(STREAK_PHRASES["14-25"]):d>=7?rnd(STREAK_PHRASES["7-14"]):d>=3?rnd(STREAK_PHRASES["3-7"]):rnd(STREAK_PHRASES["1-3"]); }
function getStreakIcon(d: number) { return d>=30?"👑":d>=14?"💎":d>=7?"⚡":"🔥"; }
function getStreakXP(d: number) { const m:Record<number,number>={1:5,2:15,3:25,4:35,5:50,6:65,7:100,14:150,30:300}; return m[d]??65; }

// ── XP BAR ────────────────────────────────────────────────────────────────────
function XPLevel({ xp, level, levelNum }: { xp:number; level:string; levelNum:number }) {
  const cur = xp % 100, pct = Math.round(cur);
  const color = level === "avancado" ? "#ffd700" : "#6c63ff";
  return (
    <div style={{ background:"var(--bg3)", borderRadius:14, padding:"12px 16px", marginBottom:14, border:"1px solid var(--border)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:800, color, letterSpacing:1 }}>⚔️ {level==="avancado"?"AVANÇADO":"INICIANTE"} NV.{levelNum}</span>
        <span style={{ fontSize:11, color:"var(--text2)", fontVariantNumeric:"tabular-nums" }}>{cur}/100 XP · {pct}%</span>
      </div>
      <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width:`${pct}%` }}/></div>
      <div style={{ fontSize:10, color:"var(--text2)", marginTop:4 }}>Total: {xp} XP acumulado</div>
    </div>
  );
}

function Toast({ msg, onDone }: { msg:string; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

function Modal({ title, onClose, children }: any) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", padding:"20px 20px 40px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", width:32, height:32, borderRadius:8, fontSize:16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── STREAK MODAL ──────────────────────────────────────────────────────────────
function StreakModal({ user, onClose, onClaim }: { user:User; onClose:()=>void; onClaim:(d:any)=>void }) {
  const [streakData, setStreakData] = useState<{streakDays:number;claimedToday:boolean;expiresIn:string}|null>(null);
  const [claimed, setClaimed] = useState<boolean|null>(null);
  const [claimResult, setClaimResult] = useState<any>(null);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [animPhase, setAnimPhase] = useState<"idle"|"burst"|"done">("idle");
  const [particles, setParticles] = useState<{id:number;x:number;y:number;color:string;angle:number}[]>([]);

  useEffect(() => {
    fetch(`${API}/users/${user.id}/streak`).then(r=>r.json()).then(d=>{
      setStreakData(d); setClaimed(!!d.claimedToday);
      setPhrase(getStreakPhrase(d.claimedToday ? d.streakDays : d.streakDays+1));
    });
  }, []);

  const triggerAnim = () => {
    setAnimPhase("burst");
    const cols = ["#ffd700","#6c63ff","#00d68f","#ff6b9d","#f97316","#a78bfa"];
    setParticles(Array.from({length:20},(_,i)=>({ id:i, x:40+Math.random()*20, y:40+Math.random()*20, color:cols[i%cols.length], angle:(i/20)*360 })));
    setTimeout(()=>{ setAnimPhase("done"); setParticles([]); }, 1200);
  };

  const handleClaim = async () => {
    if (claimed || loading || claimed===null) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${user.id}/streak/checkin`, { method:"POST" });
      const data = await res.json();
      if (res.ok) {
        setClaimed(true); setClaimResult(data);
        setStreakData(s => s ? {...s, streakDays:data.streakDays, claimedToday:true} : s);
        setPhrase(getStreakPhrase(data.streakDays));
        triggerAnim(); onClaim(data);
      } else { setClaimed(true); }
    } catch {}
    setLoading(false);
  };

  const days = streakData?.streakDays ?? 0;
  const nextDays = claimed ? days : days+1;
  const xpNext = getStreakXP(nextDays);
  const accent = nextDays>=30?"#ffd700":nextDays>=14?"#a78bfa":nextDays>=7?"#6c63ff":"#f97316";
  const MILESTONES = [1,2,3,5,7,14,30];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }} onClick={onClose}>
      <div style={{ background:"linear-gradient(180deg,#13162a 0%,var(--bg2) 100%)", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:440, padding:"24px 20px 40px", position:"relative", overflow:"hidden", border:"1px solid rgba(108,99,255,0.2)", borderBottom:"none" }} onClick={e=>e.stopPropagation()}>
        <style>{`
          @keyframes floatUp{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-55px)}}
          @keyframes burstP{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--tx),var(--ty))}}
          @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        `}</style>

        {particles.map(p=>(
          <div key={p.id} style={{ position:"absolute", top:`${p.y}%`, left:`${p.x}%`, width:9, height:9, borderRadius:"50%", background:p.color,
            // @ts-ignore
            "--tx":`${Math.cos(p.angle*Math.PI/180)*120}px`, "--ty":`${Math.sin(p.angle*Math.PI/180)*80}px`,
            animation:"burstP 0.9s ease-out forwards", pointerEvents:"none", zIndex:20 }}/>
        ))}

        <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"rgba(255,255,255,0.06)", border:"1px solid var(--border)", color:"var(--text2)", width:30, height:30, borderRadius:8, fontSize:13 }}>✕</button>

        <div style={{ textAlign:"center", marginBottom:18 }}>
          <span style={{ display:"inline-block", padding:"3px 14px", borderRadius:20, background:"rgba(108,99,255,0.12)", border:"1px solid rgba(108,99,255,0.3)", fontSize:10, fontWeight:800, color:"#a78bfa", letterSpacing:3, textTransform:"uppercase" }}>BÔNUS DIÁRIO</span>
        </div>

        {/* Ícone + número — SEM emoji ao lado do número */}
        <div style={{ textAlign:"center", marginBottom:14, position:"relative" }}>
          <div style={{ fontSize:48, lineHeight:1, marginBottom:4, filter:`drop-shadow(0 0 18px ${accent}99)` }}>{getStreakIcon(nextDays)}</div>
          <div style={{ fontSize:88, fontWeight:900, lineHeight:1, color:accent, letterSpacing:"-5px", fontVariantNumeric:"tabular-nums" }}>{nextDays}</div>
          <div style={{ fontSize:11, color:"var(--text2)", textTransform:"uppercase", letterSpacing:3, marginTop:4 }}>DIAS SEGUIDOS</div>
          {animPhase==="burst"&&(
            <div style={{ position:"absolute", top:6, left:"50%", fontSize:24, fontWeight:900, color:"#ffd700", animation:"floatUp 1.1s ease forwards", whiteSpace:"nowrap" }}>
              +{claimResult?.xpGained??xpNext} XP ⚡
            </div>
          )}
        </div>

        {streakData && !claimed && (
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <span style={{ background:"rgba(255,183,3,0.1)", border:"1px solid rgba(255,183,3,0.2)", borderRadius:8, padding:"4px 10px", color:"#ffb703", fontSize:12 }}>⏱ Expira em {streakData.expiresIn}</span>
          </div>
        )}

        {/* Marcos */}
        <div style={{ display:"flex", gap:5, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
          {MILESTONES.map(d=>{
            const isDone = claimed ? d<=days : d<nextDays;
            const isCurrent = d===nextDays;
            return (
              <div key={d} style={{ flex:"0 0 auto", width:46, background:isCurrent?`${accent}22`:isDone?"rgba(0,214,143,0.08)":"var(--bg3)", border:`1px solid ${isCurrent?accent:isDone?"rgba(0,214,143,0.3)":"var(--border)"}`, borderRadius:10, padding:"7px 2px", textAlign:"center", transform:isCurrent?"scale(1.06)":"none" }}>
                <div style={{ fontSize:13 }}>{isDone&&!isCurrent?"✅":getStreakIcon(d)}</div>
                <div style={{ fontSize:10, fontWeight:800, color:isCurrent?accent:isDone?"var(--green)":"var(--text2)", marginTop:2 }}>{d===7?"7⚡":d===14?"14💎":d===30?"30👑":d}</div>
                <div style={{ fontSize:9, color:"var(--text2)" }}>{getStreakXP(d)}xp</div>
              </div>
            );
          })}
        </div>

        {!claimed && claimed!==null && (
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <span style={{ fontSize:30, fontWeight:900, color:"#ffd700", letterSpacing:-1 }}>+{xpNext}</span>
            <span style={{ fontSize:14, color:"var(--text2)", marginLeft:5 }}>XP</span>
          </div>
        )}

        {/* Frase — sem quebra de linha forçada */}
        <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
          <p style={{ fontSize:15, fontWeight:700, color:"var(--text)", lineHeight:1.5, textAlign:"center", wordBreak:"keep-all" }}>
            {claimed&&claimResult ? "Sequência mantida. Volte amanhã e não quebre o ritmo." : phrase}
          </p>
        </div>

        {claimed===null ? (
          <div style={{ width:"100%", padding:"15px", borderRadius:14, background:"var(--bg3)", textAlign:"center", color:"var(--text2)", fontSize:14 }}>Carregando...</div>
        ) : claimed ? (
          <div style={{ width:"100%", padding:"16px", borderRadius:14, background:"linear-gradient(135deg,rgba(0,214,143,0.15),rgba(0,214,143,0.08))", border:"1px solid rgba(0,214,143,0.35)", textAlign:"center", animation:animPhase!=="idle"?"popIn 0.5s ease":"none" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--green)" }}>Resgatado hoje{claimResult?` · +${claimResult.xpGained} XP`:""}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:3 }}>Volte amanhã para o dia {days+1} 🔥</div>
          </div>
        ) : (
          <button onClick={handleClaim} disabled={loading} style={{ width:"100%", padding:"16px", border:"none", borderRadius:14, background:loading?"var(--bg3)":"linear-gradient(135deg,#6c63ff,#b44fff)", color:loading?"var(--text2)":"white", fontSize:16, fontWeight:800, cursor:loading?"default":"pointer", letterSpacing:0.5, boxShadow:loading?"none":"0 4px 24px rgba(108,99,255,0.45)" }}>
            {loading ? "⏳ Salvando..." : "🎁 Resgatar bônus"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── BAR CHART ─────────────────────────────────────────────────────────────────
function BarChart({ data }: { data:{label:string;value:number;color:string;emoji:string}[] }) {
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:110, padding:"0 2px" }}>
      {data.map((d,i)=>(
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%", textAlign:"center" }}>{d.value>0?fmt(d.value).replace("R$\u00a0","").replace(",00",""):""}</div>
          <div style={{ width:"100%", borderRadius:"4px 4px 0 0", background:d.value>0?d.color:"var(--bg3)", height:`${Math.max(d.value/max*85,d.value>0?6:2)}px`, transition:"height .6s ease", opacity:d.value>0?1:0.3 }}/>
          <div style={{ fontSize:13 }}>{d.emoji}</div>
        </div>
      ))}
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding({ user, onDone }: { user:User; onDone:()=>void }) {
  const [step, setStep] = useState(0);
  const POTES = [
    { emoji:"💆", name:"Pagar-se",  pct:"5-10%",  color:"#6c63ff", desc:"Invista em você mesmo — prazer, saúde, desenvolvimento" },
    { emoji:"💝", name:"Doar",      pct:"5-10%",  color:"#ff6b9d", desc:"Generosidade quebra a mentalidade de escassez" },
    { emoji:"📈", name:"Investir",  pct:"5-10%",  color:"#00d68f", desc:"Construa patrimônio. Os juros compostos trabalham por você" },
    { emoji:"📋", name:"Contas",    pct:"60-70%", color:"#ffb703", desc:"Obrigações mensais. Aprenda a viver bem gastando menos" },
    { emoji:"✨", name:"Sonho",     pct:"5-10%",  color:"#8b5cf6", desc:"Sua meta de longo prazo. Transforma controle em aventura" },
    { emoji:"🌟", name:"Abundar",   pct:"5-10%",  color:"#f97316", desc:"Restaurante melhor, hobby, experiências — você merece" },
  ];
  const steps = [
    <div style={{ textAlign:"center", padding:"0 8px" }}>
      <div style={{ marginBottom:16, display:"flex", justifyContent:"center" }}><CoinIcon size={72}/></div>
      <h2 style={{ fontSize:24, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:12 }}>Bem-vindo, {user.name?.split(" ")[0]}!</h2>
      <p style={{ color:"var(--text2)", fontSize:14, lineHeight:1.65, marginBottom:20 }}>No MoneyGame, cada ação financeira vira experiência. Registre, ganhe XP e suba de nível enquanto constrói riqueza de verdade.</p>
      {[{icon:"⚔️",text:"Ganhe XP proporcional a cada registro"},{icon:"🔥",text:"Mantenha sua streak diária e acumule bônus"},{icon:"📈",text:"Suba de nível e desbloqueie títulos exclusivos"}].map((f,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", textAlign:"left", marginBottom:8 }}>
          <span style={{ fontSize:22 }}>{f.icon}</span><span style={{ fontSize:14, fontWeight:600 }}>{f.text}</span>
        </div>
      ))}
    </div>,
    <div>
      <h2 style={{ fontSize:18, fontWeight:900, textAlign:"center", marginBottom:14 }}>🏺 Os 6 Potes da Riqueza</h2>
      <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#a78bfa", textTransform:"uppercase", letterSpacing:2, marginBottom:6 }}>CADA REGISTRO CONTA</div>
        <p style={{ fontSize:13, color:"var(--text)", lineHeight:1.6 }}>{rnd(REGISTRO_TEXTOS)}</p>
      </div>
      {POTES.map((p,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}`, marginBottom:7 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
              <span style={{ fontSize:11, color:p.color, fontWeight:700 }}>{p.pct}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{p.desc}</div>
          </div>
        </div>
      ))}
    </div>,
    <OnboardingSalary user={user} onDone={onDone}/>,
  ];
  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", padding:"20px 20px" }}>
      <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:28 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:i===step?20:8, height:8, borderRadius:4, background:i===step?"#6c63ff":"var(--bg3)", transition:"all .3s" }}/>)}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>{steps[step]}</div>
      {step<2&&<button className="btn-primary" onClick={()=>setStep(s=>s+1)} style={{ width:"100%", marginTop:20, padding:"15px", fontSize:15 }}>{step===0?"Ver metodologia →":"Configurar meu perfil →"}</button>}
    </div>
  );
}

function OnboardingSalary({ user, onDone }: { user:User; onDone:()=>void }) {
  const [salary, setSalary] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (salary && parseFloat(salary) > 0) {
      setLoading(true);
      await fetch(`${API}/users/${user.id}/settings`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({salaryBase:parseFloat(salary)})});
      setLoading(false);
    }
    onDone();
  };
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:14 }}>💰</div>
      <h2 style={{ fontSize:19, fontWeight:900, marginBottom:8 }}>Qual é seu salário base?</h2>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:20, lineHeight:1.5 }}>Isso ajuda a calcular seu saldo e saúde financeira.</p>
      <input type="number" placeholder="Ex: 3000" value={salary} onChange={e=>setSalary(e.target.value)} style={{ width:"100%", fontSize:18, textAlign:"center", marginBottom:14 }}/>
      <button className="btn-primary" onClick={save} disabled={loading} style={{ width:"100%", padding:"15px", fontSize:15 }}>{loading?"Salvando...":"🚀 Começar minha jornada"}</button>
      <button className="btn-ghost" onClick={onDone} style={{ width:"100%", marginTop:8, fontSize:13 }}>Pular por agora</button>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin }: { onLogin:(u:User)=>void }) {
  const [mode, setMode] = useState<"login"|"register"|"intro">("intro");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data = await res.json();
      if (!res.ok) { setError(data.error||"Erro"); return; }
      onLogin(data.user);
    } catch { setError("Erro de conexão"); } finally { setLoading(false); }
  };

  if (mode==="intro") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0a0d14,#111420)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", textAlign:"center" }}>
      <div style={{ marginBottom:14 }}><CoinIcon size={68}/></div>
      <h1 style={{ fontSize:34, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>MONEYGAME</h1>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:30, maxWidth:300 }}>Gamifique seu controle financeiro com a metodologia dos 6 potes</p>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:10, marginBottom:36 }}>
        {[{emoji:"⚔️",title:"Suba de Nível",desc:"Ganhe XP a cada ação financeira"},{emoji:"🔥",title:"Streak Diária",desc:"Apareça todo dia e acumule recompensas"},{emoji:"📊",title:"Controle Total",desc:"Despesas, cartão, renda extra e sonhos"}].map((f,i)=>(
          <div key={i} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
            <span style={{ fontSize:26 }}>{f.emoji}</span>
            <div><div style={{ fontWeight:700, fontSize:14 }}>{f.title}</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>{f.desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", gap:10 }}>
        <button className="btn-primary" onClick={()=>setMode("register")} style={{ width:"100%", fontSize:15, padding:"15px" }}>🚀 COMEÇAR MINHA JORNADA</button>
        <button className="btn-ghost" onClick={()=>setMode("login")} style={{ width:"100%" }}>Já tenho conta</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:370 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><CoinIcon size={44}/></div>
          <h1 style={{ fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>MONEYGAME</h1>
        </div>
        <div className="card">
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            {(["login","register"] as const).map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{ flex:1, padding:"10px", borderRadius:10, fontWeight:700, fontSize:13, background:mode===m?"var(--primary)":"var(--bg3)", color:mode===m?"white":"var(--text2)", border:"1.5px solid var(--border)" }}>{m==="login"?"Entrar":"Cadastrar"}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {mode==="register"&&<input placeholder="Seu nome" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>}
            <input type="email" placeholder="E-mail" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
            <input type="password" placeholder="Senha" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            {error&&<p style={{ color:"var(--red)", fontSize:13, textAlign:"center" }}>{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:"100%", marginTop:4 }}>{loading?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}</button>
            <button className="btn-ghost" onClick={()=>setMode("intro")} style={{ width:"100%", fontSize:12 }}>← Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SAÚDE FINANCEIRA CARD (topo do dashboard) ─────────────────────────────────
function HealthCard({ score, salary }: { score:number; salary:number }) {
  const band = getHealthBand(score);
  const pct = score;
  const barColor = band.color;
  const needsSalary = salary <= 0;

  if (needsSalary) return (
    <div style={{ background:"rgba(255,183,3,0.08)", border:"1px solid rgba(255,183,3,0.3)", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:800, color:"#ffb703", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>💡 CONFIGURE SEU PERFIL</div>
      <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.5 }}>Defina seu salário base em Configurações para ver sua saúde financeira.</div>
    </div>
  );

  return (
    <div style={{ background:band.bg, border:`1px solid ${band.color}44`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color:"var(--text2)", textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>SAÚDE FINANCEIRA</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ fontSize:28, fontWeight:900, color:band.color, fontVariantNumeric:"tabular-nums" }}>{score}</span>
            <span style={{ fontSize:12, color:"var(--text2)" }}>/100</span>
            <span style={{ fontSize:14, fontWeight:800, color:band.color }}>{band.label}</span>
          </div>
        </div>
        {/* Mini gauge */}
        <div style={{ position:"relative", width:52, height:52, flexShrink:0 }}>
          <svg viewBox="0 0 36 36" width={52} height={52}>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg3)" strokeWidth="3.5"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={barColor} strokeWidth="3.5"
              strokeDasharray={`${pct} ${100-pct}`} strokeDashoffset="25" strokeLinecap="round"
              style={{ transition:"stroke-dasharray 1s ease" }}/>
            <text x="18" y="21" textAnchor="middle" fontSize="9" fontWeight="900" fill={barColor} fontFamily="Figtree,sans-serif">{score}</text>
          </svg>
        </div>
      </div>
      {/* Barra */}
      <div style={{ height:5, background:"var(--bg3)", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${barColor}88,${barColor})`, borderRadius:3, transition:"width 1s ease" }}/>
      </div>
      <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.45 }}>{band.desc}</div>
    </div>
  );
}

// ── DASHBOARD CONTENT ─────────────────────────────────────────────────────────
function DashboardContent({ expenses,cc,incomes,salary,balance,totalExpSemSonho,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,onStreak,onCreditClick }: any) {
  return (
    <>
      {/* SAÚDE FINANCEIRA — topo */}
      <HealthCard score={healthScore} salary={salary}/>

      {/* STREAK */}
      <div onClick={onStreak} style={{ background:streakClaimed?"rgba(0,214,143,0.05)":"rgba(108,99,255,0.06)", border:`1px solid ${streakClaimed?"rgba(0,214,143,0.28)":"rgba(108,99,255,0.32)"}`, borderRadius:14, padding:"12px 16px", marginBottom:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Streak: apenas emoji, sem badge numérico */}
          <span style={{ fontSize:30 }}>{getStreakIcon(streakDays)}</span>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Streak Diária</div>
            <div style={{ fontSize:14, fontWeight:800, color:streakClaimed?"var(--green)":"#a78bfa" }}>
              {streakClaimed ? `✅ ${streakDays} dias` : `${streakDays} dias · resgatar`}
            </div>
          </div>
        </div>
        {!streakClaimed&&<div style={{ background:"rgba(108,99,255,0.15)", border:"1px solid rgba(108,99,255,0.3)", color:"#a78bfa", fontSize:12, fontWeight:700, padding:"5px 11px", borderRadius:8, whiteSpace:"nowrap" }}>+{getStreakXP(streakDays+1)} XP</div>}
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { label:"Salário Base",   value:fmt(salary),                           color:"var(--primary)", icon:"💼" },
          { label:"Total Despesas", value:fmt(totalExpSemSonho+totalCC),         color:"var(--red)",     icon:"💸" },
          { label:"Renda Extra",    value:fmt(totalIncome),                      color:"var(--green)",   icon:"💵" },
          { label:"Saldo Livre",    value:fmt(balance), color:balance>=0?"var(--green)":"var(--red)", icon:balance>=0?"✅":"⚠️" },
        ].map((k,i)=>(
          <div key={i} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 14px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:17, marginBottom:3 }}>{k.icon}</div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>{k.label}</div>
            <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color, marginTop:2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* CC */}
      {totalCC>0&&(
        <div style={{ background:"var(--bg2)", border:"1px solid rgba(255,183,3,0.3)", borderRadius:14, padding:"12px 16px", marginBottom:14, borderTop:"3px solid var(--yellow)", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={onCreditClick}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, marginBottom:3 }}>💳 Fatura do Cartão</div>
            <div style={{ fontSize:20, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(totalCC)}</div>
            <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{cc.length} lançamento{cc.length!==1?"s":""} · Ver detalhes</div>
          </div>
          <div style={{ fontSize:34 }}>💳</div>
        </div>
      )}

      {/* SONHO — aparece sempre que existir despesa na categoria Sonho */}
      {sonhoTotal>0&&(
        <div style={{ background:"linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.08))", border:"1px solid rgba(6,182,212,0.28)", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:sonhoRecorrente?8:0 }}>
            <span style={{ fontSize:26 }}>✨</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#06b6d4", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>Investindo no Sonho</div>
              <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{fmt(sonhoTotal)} este mês</div>
              {sonhoPago
                ? <div style={{ fontSize:11, color:"var(--green)" }}>✅ Pago este mês — vitória!</div>
                : <div style={{ fontSize:11, color:"var(--text2)" }}>Pendente · Você consegue!</div>
              }
            </div>
          </div>
          {sonhoRecorrente&&(
            <>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text2)", marginBottom:4 }}>
                <span>Meta: {fmt(num(sonhoRecorrente.recurringGoal))}</span>
                <span>{Math.round(sonhoProgresso)}% concluído</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${sonhoProgresso}%`, background:"linear-gradient(90deg,#06b6d4,#8b5cf6)" }}/></div>
            </>
          )}
        </div>
      )}

      {/* STATUS PAGAMENTO */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📊 Status de Pagamento</div>
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <div style={{ flex:1, background:"rgba(0,214,143,.1)", border:"1px solid rgba(0,214,143,.2)", borderRadius:10, padding:"10px", textAlign:"center" }}>
            <div style={{ color:"var(--green)", fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{fmt(totalPaid)}</div>
            <div style={{ color:"var(--text2)", fontSize:10, marginTop:2 }}>Pago</div>
          </div>
          <div style={{ flex:1, background:"rgba(255,183,3,.1)", border:"1px solid rgba(255,183,3,.2)", borderRadius:10, padding:"10px", textAlign:"center" }}>
            <div style={{ color:"var(--yellow)", fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>{fmt(totalPending)}</div>
            <div style={{ color:"var(--text2)", fontSize:10, marginTop:2 }}>Pendente</div>
          </div>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width:`${(totalExpSemSonho+totalCC)>0?Math.min(totalPaid/(totalExpSemSonho+totalCC)*100,100):0}%`, background:"var(--green)" }}/></div>
      </div>

      {/* META RENDA */}
      {extraNeeded>0&&(
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🎯 Meta de Renda Extra</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text2)", marginBottom:6 }}>
            <span>Necessário: {fmt(extraNeeded)}</span><span>Ganhou: {fmt(totalIncome)}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.min(totalIncome/extraNeeded*100,100)}%`, background:"linear-gradient(90deg,var(--primary),var(--purple))" }}/></div>
        </div>
      )}

      {/* POR CATEGORIA */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📂 Por Categoria</div>
        {byCategory.map((cat:any)=>(
          <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ fontSize:15, width:22 }}>{cat.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, fontWeight:600 }}>
                <span>{cat.name}</span>
                <span style={{ color:cat.total>0?"var(--text)":"var(--text2)", fontVariantNumeric:"tabular-nums" }}>{fmt(cat.total)}</span>
              </div>
              <div className="progress-bar" style={{ marginTop:4 }}><div className="progress-fill" style={{ width:`${(totalExpSemSonho+totalCC)>0?Math.min(cat.total/(totalExpSemSonho+totalCC)*100,100):0}%`, background:cat.color }}/></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User|null>(()=>{ try{return JSON.parse(sessionStorage.getItem("mg_user")||"null")}catch{return null} });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cc, setCC] = useState<CC[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  // FIX #3: salário começa como 0, não 2300, e só seta quando vem do servidor
  const [salary, setSalary] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState("iniciante");
  const [levelNum, setLevelNum] = useState(1);
  const [streakDays, setStreakDays] = useState(0);
  const [streakClaimed, setStreakClaimed] = useState(false);
  const [toast, setToast] = useState("");
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddCC, setShowAddCC] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [isPC, setIsPC] = useState(typeof window!=="undefined" && window.innerWidth>=1024);

  useEffect(()=>{ const h=()=>setIsPC(window.innerWidth>=1024); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  const showToast = (msg:string) => setToast(msg);

  const gainXpRaw = useCallback(async (xpGain:number) => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/users/${user.id}/xp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({xpGain})});
      const data = await res.json();
      setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level);
      showToast(`+${xpGain} XP ⚔️`);
    } catch {}
  },[user]);

  // FIX #3: login seta salário corretamente — sem fallback para 2300
  const login = (u:User) => {
    sessionStorage.setItem("mg_user",JSON.stringify(u)); setUser(u);
    setSalary(num(u.salaryBase)); // Se for 0, fica 0 — sem fallback!
    if (u.xp) setXp(u.xp);
    if (u.levelNum) setLevelNum(u.levelNum);
    if (u.level) setLevel(u.level);
    if (u.streakDays) setStreakDays(u.streakDays);
    if (u.isNewUser) setShowOnboarding(true);
    if (u.lastCheckin) {
      const today=new Date(); today.setHours(0,0,0,0);
      const last=new Date(u.lastCheckin); last.setHours(0,0,0,0);
      setStreakClaimed(last.getTime()===today.getTime());
    }
  };

  const logout = () => { sessionStorage.removeItem("mg_user"); setUser(null); setSalary(0); };

  const load = useCallback(async () => {
    if (!user) return;
    const [e,c,i] = await Promise.all([
      fetch(`${API}/users/${user.id}/expenses`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/users/${user.id}/credit-card`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/users/${user.id}/extra-income`).then(r=>r.json()).catch(()=>[]),
    ]);
    setExpenses(Array.isArray(e)?e:[]); setCC(Array.isArray(c)?c:[]); setIncomes(Array.isArray(i)?i:[]);
    // FIX #3: recarrega salário do servidor a cada load
    try {
      const uRes = await fetch(`${API}/auth/me/${user.id}`);
      if (uRes.ok) { const uData = await uRes.json(); if (uData.salaryBase !== undefined) setSalary(num(uData.salaryBase)); }
    } catch {}
  },[user]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    if (!expenses.length) return;
    const dueSoon = expenses.filter(e=>{ if (!e.dueDate||e.paid) return false; const diff=Math.ceil((new Date(e.dueDate).getTime()-new Date().getTime())/86400000); return diff>=0&&diff<=3; });
    if (dueSoon.length>0) setTimeout(()=>showToast(`⚠️ ${dueSoon.length} conta(s) vencem em breve!`),1500);
  },[expenses]);

  if (!user) return <Auth onLogin={login}/>;
  if (showOnboarding) return <Onboarding user={user} onDone={()=>{setShowOnboarding(false);load();}}/>;

  // CÁLCULOS
  const totalExpSemSonho = expenses.filter(e=>e.categoryId!==SONHO_ID).reduce((s,e)=>s+num(e.amount),0);
  const totalCC = cc.reduce((s,c)=>s+num(c.amount),0);
  const totalIncome = incomes.reduce((s,i)=>s+num(i.amount),0);
  const totalPaid = expenses.filter(e=>e.paid&&e.categoryId!==SONHO_ID).reduce((s,e)=>s+num(e.amount),0)+totalCC;
  const totalPending = totalExpSemSonho+totalCC-totalPaid;
  const balance = salary+totalIncome-totalExpSemSonho-totalCC;
  const extraNeeded = Math.max(0,totalExpSemSonho+totalCC-salary);
  // FIX #1: Sonho — busca por categoryId === SONHO_ID
  const sonhoExp = expenses.filter(e=>Number(e.categoryId)===SONHO_ID);
  const sonhoTotal = sonhoExp.reduce((s,e)=>s+num(e.amount),0);
  const sonhoPago = sonhoExp.some(e=>!!e.paid);
  const sonhoRecorrente = sonhoExp.find(e=>e.recurring && num(e.recurringGoal)>0 && num(e.recurringMonths)>0);
  const sonhoProgresso = sonhoRecorrente ? Math.min(sonhoTotal/num(sonhoRecorrente.recurringGoal)*100,100) : 0;
  const byCategory = CATS.map(cat=>({...cat,items:expenses.filter(e=>Number(e.categoryId)===cat.id),total:expenses.filter(e=>Number(e.categoryId)===cat.id).reduce((s,e)=>s+num(e.amount),0)}));
  // FIX #5: score de saúde financeira
  const healthScore = calcHealthScore(salary, totalExpSemSonho, totalIncome, totalPaid, totalExpSemSonho+totalCC, streakDays);

  const NAV = [{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"expenses",icon:"💸",label:"Despesas"},{id:"credit",icon:"💳",label:"Cartão"},{id:"income",icon:"💵",label:"Renda Extra"},{id:"reports",icon:"📈",label:"Relatórios"}];

  const onStreakClaim = (data:any) => { setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level); setStreakDays(data.streakDays); setStreakClaimed(true); showToast(`+${data.xpGained} XP 🔥 ${data.streakDays} dias!`); };

  // FIX #2: reset-month não zera XP — atualiza state após reset
  const handleReset = async () => {
    const res = await fetch(`${API}/users/${user.id}/reset-month`,{method:"POST"});
    const data = await res.json();
    if (res.ok && data.user) {
      // Preserva XP, só recarrega despesas
      setXp(data.user.xp||xp); setLevelNum(data.user.levelNum||levelNum);
    }
    setShowReset(false); load();
    showToast("✅ Mês arquivado com sucesso!");
  };

  const sharedModals = (
    <>
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {showStreak&&<StreakModal user={user} onClose={()=>setShowStreak(false)} onClaim={onStreakClaim}/>}
      {showAddExp&&<AddExpenseModal userId={user.id} onClose={()=>{setShowAddExp(false);load();}} onXp={gainXpRaw}/>}
      {showAddCC&&<AddCCModal userId={user.id} onClose={()=>{setShowAddCC(false);load();}} onXp={gainXpRaw}/>}
      {showAddIncome&&<AddIncomeModal userId={user.id} onClose={()=>{setShowAddIncome(false);load();}} onXp={gainXpRaw}/>}
      {/* FIX #3: SettingsModal retorna salário salvo e atualiza state */}
      {showSettings&&<SettingsModal user={user} salary={salary} onSave={(s:number)=>{setSalary(s);showToast("✅ Salário atualizado!");setShowSettings(false);}} onClose={()=>setShowSettings(false)} onReset={()=>{setShowSettings(false);setShowReset(true);}}/>}
      {showMethodology&&<MethodologyModal onClose={()=>setShowMethodology(false)}/>}
      {showReset&&<ResetModal onClose={()=>setShowReset(false)} onConfirm={handleReset}/>}
    </>
  );

  const dashProps = { expenses,cc,incomes,salary,balance,totalExpSemSonho,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,onStreak:()=>setShowStreak(true),onCreditClick:()=>setTab("credit") };

  // ── PC LAYOUT ─────────────────────────────────────────────────────────────
  if (isPC) return (
    <>
      {sharedModals}
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>
        <aside style={{ width:235, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"22px 18px 14px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <CoinIcon size={26}/>
              <span style={{ fontSize:16, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>MONEYGAME</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", paddingLeft:36 }}>Olá, {user.name?.split(" ")[0]}!</div>
          </div>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ fontSize:10, fontWeight:800, color:"#6c63ff" }}>⚔️ {level==="avancado"?"AVANÇADO":"INICIANTE"} NV.{levelNum}</span>
              <span style={{ fontSize:10, color:"var(--text2)" }}>{xp%100}/100</span>
            </div>
            <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width:`${xp%100}%` }}/></div>
            <div style={{ fontSize:9, color:"var(--text2)", marginTop:3 }}>{xp} XP total</div>
          </div>
          <div onClick={()=>setShowStreak(true)} style={{ margin:"10px 10px 0", padding:"11px 13px", borderRadius:12, cursor:"pointer", background:streakClaimed?"rgba(0,214,143,0.06)":"rgba(108,99,255,0.08)", border:`1px solid ${streakClaimed?"rgba(0,214,143,0.22)":"rgba(108,99,255,0.28)"}`, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:24 }}>{getStreakIcon(streakDays)}</span>
            <div>
              <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>STREAK</div>
              <div style={{ fontSize:13, fontWeight:800, color:streakClaimed?"var(--green)":"#a78bfa" }}>{streakDays} dias {streakClaimed?"✅":`· +${getStreakXP(streakDays+1)}XP`}</div>
            </div>
          </div>
          <nav style={{ padding:"12px 10px", flex:1 }}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 13px", borderRadius:10, marginBottom:3, background:tab===n.id?"rgba(108,99,255,0.15)":"transparent", border:`1px solid ${tab===n.id?"rgba(108,99,255,0.28)":"transparent"}`, color:tab===n.id?"#a78bfa":"var(--text2)", fontSize:13, fontWeight:tab===n.id?700:500, cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span> {n.label}
              </button>
            ))}
          </nav>
          <div style={{ padding:"10px 10px 20px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:6 }}>
            <button onClick={()=>setShowMethodology(true)} style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>📚 Metodologia</button>
            <button onClick={()=>setShowSettings(true)} style={{ width:"100%", background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>⚙️ Configurações</button>
            <button onClick={logout} style={{ width:"100%", background:"rgba(255,77,106,0.08)", border:"1px solid rgba(255,77,106,0.2)", color:"var(--red)", padding:"9px 12px", borderRadius:10, fontSize:12, textAlign:"left", cursor:"pointer" }}>🚪 Sair</button>
          </div>
        </aside>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"14px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div>
              <h1 style={{ fontSize:19, fontWeight:900, color:"var(--text)", margin:0 }}>{NAV.find(n=>n.id===tab)?.icon} {NAV.find(n=>n.id===tab)?.label}</h1>
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {[{label:"Saldo",value:fmt(balance),color:balance>=0?"var(--green)":"var(--red)"},{label:"Despesas",value:fmt(totalExpSemSonho+totalCC),color:"var(--red)"},{label:"Saúde",value:`${healthScore}/100`,color:getHealthBand(healthScore).color}].map((k,i)=>(
                <div key={i} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"7px 13px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
            <XPLevel xp={xp} level={level} levelNum={levelNum}/>
            {tab==="dashboard"&&<DashboardContent {...dashProps}/>}
            {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)} onPay={async(exp:Expense)=>{ await fetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }} onDelete={async(id:number)=>{ await fetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="credit"&&<CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)} onDelete={async(id:number)=>{ await fetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await fetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }}/>}
            {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} salary={salary} healthScore={healthScore}/>}
          </div>
        </div>
      </div>
    </>
  );

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", paddingBottom:80 }}>
      {sharedModals}
      <header style={{ background:"var(--bg2)", borderBottom:"1px solid var(--border)", padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", display:"flex", alignItems:"center", gap:6 }}>
            <CoinIcon size={20}/> MONEYGAME
          </div>
          <div style={{ fontSize:11, color:"var(--text2)" }}>Olá, {user.name?.split(" ")[0]}! ⚔️ {level==="avancado"?"AVANÇADO":"INICIANTE"} NV.{levelNum}</div>
        </div>
        <div style={{ display:"flex", gap:7 }}>
          <button onClick={()=>setShowMethodology(true)} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>📚</button>
          <button onClick={()=>setShowSettings(true)} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>⚙️</button>
          <button onClick={logout} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>🚪</button>
        </div>
      </header>
      <main style={{ padding:"14px 14px 0" }}>
        <XPLevel xp={xp} level={level} levelNum={levelNum}/>
        {tab==="dashboard"&&<DashboardContent {...dashProps}/>}
        {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)} onPay={async(exp:Expense)=>{ await fetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }} onDelete={async(id:number)=>{ await fetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}/>}
        {tab==="credit"&&<CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)} onDelete={async(id:number)=>{ await fetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}/>}
        {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await fetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }}/>}
        {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} salary={salary} healthScore={healthScore}/>}
      </main>
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--bg2)", borderTop:"1px solid var(--border)", display:"flex", zIndex:50 }}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{ flex:1, padding:"9px 4px 7px", background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:2, color:tab===n.id?"var(--primary)":"var(--text2)", cursor:"pointer" }}>
            <span style={{ fontSize:tab===n.id?19:17 }}>{n.icon}</span>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.3 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── ABA DESPESAS ──────────────────────────────────────────────────────────────
function ExpensesContent({ expenses,byCategory,onAdd,onPay,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💸 Despesas</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Adicionar</button>
      </div>
      {byCategory.map((cat:any)=>(
        <div key={cat.id} className="card" style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:cat.items.length?10:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:17 }}>{cat.emoji}</span>
              <span style={{ fontWeight:700, fontSize:14 }}>{cat.name}</span>
              <span style={{ fontSize:10, background:"var(--bg3)", padding:"2px 7px", borderRadius:20, color:"var(--text2)" }}>{cat.items.length}</span>
            </div>
            <span style={{ fontWeight:800, fontSize:14, fontVariantNumeric:"tabular-nums" }}>{fmt(cat.total)}</span>
          </div>
          {cat.items.map((exp:Expense)=>{
            const isDueSoon = exp.dueDate&&!exp.paid&&(()=>{ const diff=Math.ceil((new Date(exp.dueDate!).getTime()-new Date().getTime())/86400000); return diff>=0&&diff<=3; })();
            return (
              <div key={exp.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"var(--bg3)", borderRadius:10, marginBottom:5, border:`1px solid ${isDueSoon?"rgba(255,183,3,.4)":"var(--border)"}` }}>
                <input type="checkbox" checked={!!exp.paid} onChange={()=>onPay(exp)} style={{ width:18, height:18, accentColor:"var(--primary)", flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, textDecoration:exp.paid?"line-through":"none", color:exp.paid?"var(--text2)":"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{exp.name}</div>
                  <div style={{ fontSize:10, color:isDueSoon?"var(--yellow)":"var(--text2)" }}>
                    {exp.subcategory&&`${exp.subcategory} · `}
                    {exp.dueDate&&`Vence: ${new Date(exp.dueDate).toLocaleDateString("pt-BR")}`}
                    {isDueSoon&&" ⚠️"}{exp.recurring?" 🔄":""}
                  </div>
                </div>
                <span style={{ fontWeight:800, fontSize:12, fontVariantNumeric:"tabular-nums", color:exp.paid?"var(--green)":"var(--yellow)", flexShrink:0 }}>{fmt(num(exp.amount))}</span>
                <button className="btn-danger" onClick={()=>onDelete(exp.id)} style={{ padding:"5px 9px", flexShrink:0 }}>🗑</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── ABA CARTÃO ────────────────────────────────────────────────────────────────
function CreditContent({ cc,totalCC,onAdd,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💳 Cartão</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Adicionar</button>
      </div>
      <div className="card" style={{ marginBottom:14, borderTop:"3px solid var(--yellow)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase" }}>Total da Fatura</div>
            <div style={{ fontSize:26, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(totalCC)}</div>
          </div>
          <span style={{ fontSize:38 }}>💳</span>
        </div>
      </div>
      {cc.length===0&&<div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:38 }}>Nenhum gasto no cartão</div>}
      {cc.map((c:CC)=>(
        <div key={c.id} className="card" style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", marginBottom:7 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{c.description}</div>
            {c.subcategory&&<div style={{ fontSize:11, color:"var(--text2)" }}>{c.subcategory}</div>}
          </div>
          <span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(num(c.amount))}</span>
          <button className="btn-danger" onClick={()=>onDelete(c.id)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── ABA RENDA EXTRA ───────────────────────────────────────────────────────────
function IncomeContent({ incomes,totalIncome,extraNeeded,onAdd,onDelete }: any) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💵 Renda Extra</h2>
        <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Registrar</button>
      </div>
      <div className="card" style={{ marginBottom:14, borderTop:"3px solid var(--green)" }}>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase" }}>Total Ganho</div>
            <div style={{ fontSize:26, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>{fmt(totalIncome)}</div>
          </div>
          {extraNeeded>0&&<div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:"var(--text2)" }}>Meta necessária</div>
            <div style={{ fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(extraNeeded)}</div>
          </div>}
        </div>
        {extraNeeded>0&&<div className="progress-bar" style={{ marginTop:10 }}><div className="progress-fill" style={{ width:`${Math.min(totalIncome/extraNeeded*100,100)}%`, background:"linear-gradient(90deg,var(--green),var(--primary))" }}/></div>}
      </div>
      {incomes.length===0&&<div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:38 }}>Nenhuma renda extra registrada</div>}
      {incomes.map((inc:Income)=>(
        <div key={inc.id} className="card" style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", marginBottom:7 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{inc.description}</div>
            <div style={{ fontSize:11, color:"var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</div>
          </div>
          <span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>+{fmt(num(inc.amount))}</span>
          <button className="btn-danger" onClick={()=>onDelete(inc.id)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

// ── ABA RELATÓRIOS — com histórico de meses ───────────────────────────────────
function ReportsContent({ byCategory,totalExpSemSonho,totalCC,totalIncome,expenses,cc,xp,userId,salary,healthScore }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingH, setLoadingH] = useState(true);

  useEffect(()=>{
    setLoadingH(true);
    fetch(`${API}/users/${userId}/history`).then(r=>r.json()).then(d=>{ setHistory(Array.isArray(d)?d:[]); }).catch(()=>setHistory([])).finally(()=>setLoadingH(false));
  },[userId]);

  const band = getHealthBand(healthScore);
  const monthLabel = new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});

  return (
    <div>
      <h2 style={{ fontSize:17, fontWeight:800, marginBottom:14 }}>📈 Relatórios</h2>

      {/* Cards resumo */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { label:"Despesas",    value:fmt(totalExpSemSonho+totalCC), color:"var(--red)"     },
          { label:"Renda Extra", value:fmt(totalIncome),              color:"var(--green)"   },
          { label:"Registros",   value:`${expenses.length+cc.length}`,color:"var(--primary)" },
          { label:"XP Total",    value:`${xp} XP`,                   color:"var(--yellow)"  },
        ].map((k,i)=>(
          <div key={i} className="card" style={{ borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:17, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Saúde financeira detalhada */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💚 Saúde Financeira — {monthLabel}</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:32, fontWeight:900, color:band.color, fontVariantNumeric:"tabular-nums" }}>{healthScore}<span style={{ fontSize:14, color:"var(--text2)" }}>/100</span></div>
            <div style={{ fontSize:14, fontWeight:700, color:band.color }}>{band.label}</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:3, lineHeight:1.4 }}>{band.desc}</div>
          </div>
          <div>
            {[{min:83,label:"Ótima",c:"#00d68f"},{min:69,label:"Muito Boa",c:"#4ade80"},{min:61,label:"Boa",c:"#a3e635"},{min:57,label:"Ok",c:"#facc15"},{min:50,label:"Baixa",c:"#fb923c"},{min:37,label:"Muito Baixa",c:"#f97316"},{min:0,label:"Ruim",c:"#ff4d6a"}].map((b,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:b.c, flexShrink:0, opacity:healthScore>=b.min?1:0.3 }}/>
                <span style={{ fontSize:11, color:healthScore>=b.min?"var(--text)":"var(--text2)", fontWeight:healthScore>=b.min?700:400 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:8, background:"var(--bg3)", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${healthScore}%`, background:`linear-gradient(90deg,#ff4d6a,#fb923c,#facc15,#a3e635,#00d68f)`, transition:"width 1s ease" }}/>
        </div>
      </div>

      {/* Gráfico potes */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>📊 Gastos por Pote — {monthLabel}</div>
        <BarChart data={byCategory.map((cat:any)=>({label:cat.name,value:cat.total,color:cat.color,emoji:cat.emoji}))}/>
      </div>

      {/* Distribuição % */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>🏺 Distribuição por Pote</div>
        {byCategory.filter((c:any)=>c.total>0).map((cat:any)=>(
          <div key={cat.id} style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
              <span style={{ fontWeight:600 }}>{cat.emoji} {cat.name}</span>
              <span style={{ fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fmt(cat.total)} · {(totalExpSemSonho+totalCC)>0?Math.round(cat.total/(totalExpSemSonho+totalCC)*100):0}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width:`${(totalExpSemSonho+totalCC)>0?Math.min(cat.total/(totalExpSemSonho+totalCC)*100,100):0}%`, background:cat.color }}/></div>
          </div>
        ))}
        {byCategory.every((c:any)=>c.total===0)&&<div style={{ textAlign:"center", color:"var(--text2)", padding:16, fontSize:13 }}>Nenhum gasto registrado ainda</div>}
      </div>

      {/* HISTÓRICO DE MESES */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📅 Histórico de Meses</div>
        {loadingH ? (
          <div style={{ textAlign:"center", color:"var(--text2)", padding:16 }}>Carregando...</div>
        ) : history.length===0 ? (
          <div style={{ textAlign:"center", color:"var(--text2)", padding:16, fontSize:13, lineHeight:1.5 }}>
            Nenhum mês arquivado ainda.<br/>Use "Virar Mês" em Configurações ao final de cada mês.
          </div>
        ) : (
          <>
            {/* Mini gráfico de barras do histórico */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, marginBottom:14, paddingBottom:2 }}>
              {history.slice().reverse().map((h:any,i:number)=>{
                const maxVal = Math.max(...history.map((x:any)=>x.totalExpenses),1);
                const pct = Math.max(h.totalExpenses/maxVal*70, 4);
                const isPositive = h.balance >= 0;
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:isPositive?"var(--green)":"var(--red)", height:`${pct}px`, transition:"height .6s", opacity:0.85 }}/>
                    <div style={{ fontSize:8, color:"var(--text2)", textAlign:"center", whiteSpace:"nowrap" }}>{h.month.slice(5)}/{h.month.slice(2,4)}</div>
                  </div>
                );
              })}
            </div>
            {history.map((h:any,i:number)=>(
              <div key={i} style={{ padding:"10px 12px", background:"var(--bg3)", borderRadius:10, marginBottom:7, borderLeft:`3px solid ${h.balance>=0?"var(--green)":"var(--red)"}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>
                    {new Date(h.month+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
                  </span>
                  <span style={{ fontSize:12, fontWeight:800, color:h.balance>=0?"var(--green)":"var(--red)", fontVariantNumeric:"tabular-nums" }}>
                    {h.balance>=0?"+":""}{fmt(h.balance)}
                  </span>
                </div>
                <div style={{ display:"flex", gap:14, fontSize:11, color:"var(--text2)" }}>
                  <span>💸 {fmt(h.totalExpenses)}</span>
                  <span>💵 {fmt(h.totalIncome)}</span>
                  <span>📋 {h.items} itens</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Como ganhar XP */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>⚔️ Como ganhar XP</div>
        {[
          {label:"Renda extra registrada",desc:"1 real = 1 XP",color:"var(--green)",emoji:"💵"},
          {label:"Despesa ou cartão",desc:"1 real = 0,05 XP",color:"var(--primary)",emoji:"💸"},
          {label:"Conta marcada como paga",desc:"+15 XP fixo",color:"var(--purple)",emoji:"✅"},
          {label:"Streak diária",desc:"5 a 300 XP",color:"#f97316",emoji:"🔥"},
        ].map((r,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<3?"1px solid var(--border)":"none" }}>
            <span style={{ fontSize:17 }}>{r.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{r.label}</div>
              <div style={{ fontSize:11, color:"var(--text2)" }}>{r.desc}</div>
            </div>
            <div style={{ width:8, height:8, borderRadius:4, background:r.color }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MODAIS ────────────────────────────────────────────────────────────────────
function AddExpenseModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ categoryId:"4", name:"", amount:"", subcategory:"", dueDate:"", recurring:false, recurringMonths:"", recurringGoal:"" });
  const [loading, setLoading] = useState(false);
  const isSonho = parseInt(form.categoryId)===SONHO_ID;

  const submit = async () => {
    // Sonho com meta: amount pode ser calculado automaticamente
    const sonhoAutoCalc = isSonho && form.recurring && form.recurringGoal && form.recurringMonths;
    if (!form.name) return;
    if (!sonhoAutoCalc && !form.amount) return;
    setLoading(true);
    try {
      // Calcula amount: se Sonho com meta, divide automaticamente
      const computedAmount = sonhoAutoCalc && (!form.amount || parseFloat(form.amount) <= 0)
        ? parseFloat(form.recurringGoal) / parseInt(form.recurringMonths)
        : parseFloat(form.amount);
      const payload: any = {
        categoryId: parseInt(form.categoryId),
        name: form.name,
        amount: computedAmount,
        subcategory: form.subcategory || undefined,
        dueDate: form.dueDate || undefined,
        recurring: form.recurring ? 1 : 0,
      };
      if (sonhoAutoCalc) {
        payload.recurringGoal = parseFloat(form.recurringGoal);
        payload.recurringMonths = parseInt(form.recurringMonths);
      }
      const res = await fetch(`${API}/users/${userId}/expenses`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (res.ok) { onXp(calcXpExpense(computedAmount)); onClose(); }
      else { const err = await res.json(); console.error("Erro ao salvar despesa:", err); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const monthlyCalc = isSonho && form.recurring && form.recurringGoal && form.recurringMonths
    ? parseFloat(form.recurringGoal) / parseInt(form.recurringMonths)
    : null;

  return (
    <Modal title="💸 Nova Despesa" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <select value={form.categoryId} onChange={e=>setForm(f=>({...f,categoryId:e.target.value}))}>
          {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <input placeholder="Nome da despesa *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        <input type="number" placeholder={isSonho&&form.recurring?"Valor mensal (deixe em branco p/ calcular)":"Valor (R$) *"} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <input placeholder="Subcategoria (opcional)" value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))}/>
        <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))}/>
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--text2)", cursor:"pointer" }}>
          <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}/> Recorrente 🔄
        </label>

        {/* FIX #1: Bloco Sonho aparece quando categoria=Sonho + recorrente */}
        {isSonho && form.recurring && (
          <div style={{ background:"rgba(6,182,212,0.07)", border:"1px solid rgba(6,182,212,0.22)", borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:9 }}>
            <div style={{ fontSize:10, color:"#06b6d4", fontWeight:800, textTransform:"uppercase", letterSpacing:1 }}>✨ META DO SONHO</div>
            <input type="number" placeholder="Valor total do sonho (R$)" value={form.recurringGoal} onChange={e=>setForm(f=>({...f,recurringGoal:e.target.value}))}/>
            <input type="number" placeholder="Em quantos meses?" value={form.recurringMonths} onChange={e=>setForm(f=>({...f,recurringMonths:e.target.value}))}/>
            {monthlyCalc !== null && (
              <div style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>
                📅 {fmt(monthlyCalc)}/mês durante {form.recurringMonths} meses
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", gap:8, marginTop:2 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.name||(!(isSonho&&form.recurring&&form.recurringGoal&&form.recurringMonths)&&!form.amount)} style={{ flex:1 }}>{loading?"...":"Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddCCModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ subcategory:"Outros", description:"", amount:"" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description||!form.amount) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/credit-card`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amount:parseFloat(form.amount)})});
      if (res.ok) { onXp(calcXpExpense(parseFloat(form.amount))); onClose(); }
    } catch {}
    setLoading(false);
  };
  return (
    <Modal title="💳 Gasto no Cartão" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <select value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))}>{CC_CATS.map(c=><option key={c}>{c}</option>)}</select>
        <input placeholder="Descrição *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.description||!form.amount} style={{ flex:1 }}>{loading?"...":"Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddIncomeModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ description:"", amount:"" });
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!form.description||!form.amount) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/extra-income`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amount:parseFloat(form.amount)})});
      if (res.ok) { onXp(calcXpIncome(parseFloat(form.amount))); onClose(); }
    } catch {}
    setLoading(false);
  };
  return (
    <Modal title="💵 Renda Extra" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <input placeholder="Descrição (ex: Freelance, Venda...) *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
        <input type="number" placeholder="Valor (R$) *" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
        {form.amount&&parseFloat(form.amount)>0&&(
          <div style={{ fontSize:12, color:"var(--green)", fontWeight:600, padding:"8px 12px", background:"rgba(0,214,143,0.08)", borderRadius:8 }}>
            ⚔️ +{calcXpIncome(parseFloat(form.amount))} XP com esse registro!
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.description||!form.amount} style={{ flex:1 }}>{loading?"...":"Registrar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ user, salary, onSave, onClose, onReset }: any) {
  const [s, setS] = useState(String(salary||""));
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!s || parseFloat(s) < 0) return;
    setLoading(true);
    try {
      // FIX #3: aguarda resposta e usa o salário confirmado pelo servidor
      const res = await fetch(`${API}/users/${user.id}/settings`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({salaryBase:parseFloat(s)})});
      const data = await res.json();
      if (res.ok) { onSave(parseFloat(data.salaryBase ?? s)); }
    } catch { onSave(parseFloat(s)); }
    setLoading(false);
  };
  return (
    <Modal title="⚙️ Configurações" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:6, letterSpacing:1 }}>SALÁRIO BASE (R$)</label>
          <input type="number" value={s} onChange={e=>setS(e.target.value)}/>
        </div>
        <button className="btn-primary" onClick={save} disabled={loading||!s} style={{ width:"100%" }}>{loading?"Salvando...":"Salvar"}</button>
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <div style={{ fontSize:12, color:"var(--text2)", marginBottom:10 }}>⚠️ Zona de perigo</div>
          <button onClick={onReset} style={{ width:"100%", background:"rgba(255,77,106,.15)", color:"var(--red)", padding:"12px", borderRadius:12, fontSize:13, fontWeight:700, border:"1px solid rgba(255,77,106,.3)" }}>
            🔄 Virar Mês — Arquivar e limpar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResetModal({ onClose, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => { setLoading(true); await onConfirm(); setLoading(false); };
  return (
    <Modal title="🔄 Virar o Mês" onClose={onClose}>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:8, lineHeight:1.6 }}>
        Os dados serão <strong style={{ color:"var(--green)" }}>arquivados</strong> e você começa o mês limpo.
      </p>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:20, lineHeight:1.5 }}>
        Seu XP e nível <strong style={{ color:"var(--primary)" }}>não são zerados</strong> — apenas despesas, cartão e renda extra.
      </p>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
        <button onClick={confirm} disabled={loading} style={{ flex:1, background:"var(--primary)", color:"white", padding:"12px", borderRadius:12, fontSize:14, fontWeight:700 }}>{loading?"Arquivando...":"Confirmar"}</button>
      </div>
    </Modal>
  );
}

function MethodologyModal({ onClose }: any) {
  const POTES = [
    { cat:"Pagar-se",  pct:"5-10%",  color:"#6c63ff", emoji:"💆", desc:"Invista em você mesmo. Um presente, um passeio, um momento de prazer." },
    { cat:"Doar",      pct:"5-10%",  color:"#ff6b9d", emoji:"💝", desc:"Generosidade quebra a mentalidade de escassez e cria energia de abundância." },
    { cat:"Investir",  pct:"5-10%",  color:"#00d68f", emoji:"📈", desc:"Construa patrimônio. Quanto mais cedo começa, mais os juros compostos trabalham." },
    { cat:"Contas",    pct:"60-70%", color:"#ffb703", emoji:"📋", desc:"Suas obrigações mensais. Aprenda a viver bem gastando menos." },
    { cat:"Sonho",     pct:"5-10%",  color:"#8b5cf6", emoji:"✨", desc:"Seu objetivo motivador. Transforma controle financeiro em aventura." },
    { cat:"Abundar",   pct:"5-10%",  color:"#f97316", emoji:"🌟", desc:"Os luxos da vida. Restaurante melhor, hobby, experiências." },
  ];
  return (
    <Modal title="📚 Metodologia dos 6 Potes" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:"var(--bg3)", borderRadius:12, padding:12, fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
          A metodologia dos 6 Potes propõe que riqueza é um estado mental baseado em inteligência emocional. A chave está em como você distribui o que ganha.
        </div>
        {POTES.map((p,i)=>(
          <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}` }}>
            <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{p.cat}</span>
                <span style={{ fontSize:11, color:p.color, fontWeight:700 }}>{p.pct}</span>
              </div>
              <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
