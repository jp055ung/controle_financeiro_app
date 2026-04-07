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

function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="30" height="20" rx="5" fill="#6c63ff"/>
      <path d="M10 15H30V25H10V15Z" fill="#8b5cf6"/>
      <circle cx="20" cy="20" r="3" fill="#fff"/>
      <path d="M10 20L15 20M25 20L30 20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 15L15 25M25 15L25 25" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0)) || 0;

type User = { id: number; name: string; email: string; salaryBase?: string|number; xp?: number; level?: string; levelNum?: number; streakDays?: number; lastCheckin?: string; isNewUser?: boolean };
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string; recurring?: number; recurringMonths?: number; recurringGoal?: number };
type CC = { id: number; description: string; amount: string; subcategory?: string; paid: number; totalAmount?: string|null; installments?: number; installmentCurrent?: number; dueDay?: number|null };
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
const calcXpIncome  = (a: number) => Math.max(1, Math.round(a));           // renda extra: 1 XP/real
const calcXpExpense = (a: number) => Math.max(1, Math.round(a * 0.1));     // despesa/cartão: 10% → R$100 = 10 XP
const XP_PAY_BILL = 15;

// ── SAÚDE FINANCEIRA ──────────────────────────────────────────────────────────
function calcHealthScore(salary: number, totalExp: number, totalIncome: number, totalPaid: number, totalAll: number, streakDays: number): number {
  // Receita total = salário base + renda extra
  const receita = salary + totalIncome;
  if (receita <= 0) return 0;
  // Componente 1: saldo (50pts) — (receita - despesas) / receita
  // Mesmo que despesas > salário, renda extra pode cobrir → pontuação justa
  const balanceRatio = Math.max(0, (receita - totalAll) / receita);
  const scoreBalance = Math.min(50, Math.round(balanceRatio * 70));
  // Componente 2: pagamento (30pts) — % contas pagas
  const scorePaid = totalAll > 0 ? Math.min(30, Math.round((totalPaid / totalAll) * 30)) : 20;
  // Componente 3: streak (20pts)
  const scoreStreak = Math.min(20, Math.round((Math.min(streakDays, 30) / 30) * 20));
  return Math.min(100, scoreBalance + scorePaid + scoreStreak);
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
function getStreakXP(d: number) { return d * 10; } // dia 1=10xp, dia 2=20xp, ..., dia 30=300xp

const INVESTIR_ID = 3;

// ── SISTEMA DE NÍVEIS ─────────────────────────────────────────────────────────
// Iniciante NV.1–49   → 1.000 XP por nível → 49.000 XP total para sair
// Investidor NV.50–99 → 1.000 XP por nível → 50.000 XP total para sair
// Avançado NV.100     → FIM DE JOGO (zerou!)
const XP_PER_LEVEL = 1000;
const TIER_BREAK = 50;   // NV.50 = vira Investidor
const MAX_LEVEL  = 100;  // NV.100 = Avançado, fim de jogo

function getLevelInfo(xpTotal: number): { label:string; color:string; tier:"iniciante"|"investidor"|"avancado"; levelNum:number; xpInLevel:number; pctInLevel:number } {
  const rawLevel = Math.floor(xpTotal / XP_PER_LEVEL) + 1;
  const levelNum  = Math.min(rawLevel, MAX_LEVEL);
  const xpInLevel = levelNum < MAX_LEVEL ? xpTotal % XP_PER_LEVEL : XP_PER_LEVEL;
  const pctInLevel = levelNum < MAX_LEVEL ? Math.round(xpInLevel / XP_PER_LEVEL * 100) : 100;

  if (levelNum >= MAX_LEVEL) return { label:"AVANÇADO",   color:"#ffd700", tier:"avancado",   levelNum, xpInLevel, pctInLevel };
  if (levelNum >= TIER_BREAK) return { label:"INVESTIDOR", color:"#00d68f", tier:"investidor", levelNum, xpInLevel, pctInLevel };
  return                              { label:"INICIANTE",  color:"#6c63ff", tier:"iniciante",  levelNum, xpInLevel, pctInLevel };
}

// % recomendadas por tier
function getTargetPct(tier: string) {
  if (tier === "avancado")   return { pagar:10, doar:10, investir:25, contas:45, sonho:5,  abundar:5 };
  if (tier === "investidor") return { pagar:10, doar:5,  investir:15, contas:55, sonho:10, abundar:5 };
  return                            { pagar:5,  doar:5,  investir:5,  contas:70, sonho:10, abundar:5 };
}

// ── MODAL LEVEL UP / CONQUISTA ────────────────────────────────────────────────
function LevelUpModal({ levelNum, tier, onClose }: { levelNum:number; tier:string; onClose:()=>void }) {
  const isMax = levelNum >= MAX_LEVEL;
  const isNewTier = levelNum === TIER_BREAK || isMax;
  const info = isMax
    ? { emoji:"👑", title:"Missão Cumprida.", color:"#ffd700",
        msg:"Você fez o que menos de 1% das pessoas conseguem: transformou disciplina em liberdade.\nO NaCarteira foi seu treino — a vida real é o seu campo agora.\nVocê superou o app." }
    : levelNum === TIER_BREAK
    ? { emoji:"📈", title:"Você é Investidor!", color:"#00d68f",
        msg:"Disciplina comprovada. Agora seu foco muda: mais capital para os investimentos, menos para Contas. Os juros compostos já estão trabalhando por você." }
    : { emoji:"⚔️", title:`Nível ${levelNum}!`, color:"#a78bfa",
        msg:`+1 nível conquistado. Continue registrando, continue crescendo.` };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:24, padding:"32px 24px", maxWidth:380, width:"100%", textAlign:"center", border:`2px solid ${info.color}44` }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:64, marginBottom:12 }}>{info.emoji}</div>
        <div style={{ fontSize:22, fontWeight:900, color:info.color, marginBottom:10 }}>{info.title}</div>
        {isMax && <div style={{ fontSize:13, color:"#ffd700", fontWeight:700, letterSpacing:2, marginBottom:10, textTransform:"uppercase" }}>🏆 TOP 1% • NV.100</div>}
        <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.7, whiteSpace:"pre-line", marginBottom:24 }}>{info.msg}</div>
        {isMax && (
          <div style={{ background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.3)", borderRadius:14, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#ffd700", lineHeight:1.6 }}>
            ✨ Continue usando o app para manter seus registros e inspirar novos investidores!
          </div>
        )}
        <button onClick={onClose} style={{ background:info.color, color:"#000", border:"none", borderRadius:14, padding:"14px 32px", fontSize:15, fontWeight:800, cursor:"pointer", width:"100%" }}>
          {isMax ? "🎉 Eu superei o app!" : isNewTier ? "🚀 Vamos nessa!" : "⚔️ Continuar!"}
        </button>
      </div>
    </div>
  );
}

// ── XP BAR ────────────────────────────────────────────────────────────────────
function XPLevel({ xp }: { xp:number; level?:string; levelNum?:number }) {
  const info = getLevelInfo(xp);
  const isMax = info.levelNum >= MAX_LEVEL;
  // XP até o próximo nível
  const xpToNext = isMax ? 0 : XP_PER_LEVEL - info.xpInLevel;
  // NV que destrava o próximo tier
  const nextTierLv = info.tier === "iniciante" ? TIER_BREAK : info.tier === "investidor" ? MAX_LEVEL : null;

  return (
    <div style={{ background:"var(--bg3)", borderRadius:14, padding:"12px 16px", marginBottom:14, border:`1px solid ${isMax?"rgba(255,215,0,0.3)":"var(--border)"}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:800, color:info.color, letterSpacing:1 }}>
          {isMax ? "👑" : "⚔️"} {info.label} NV.{info.levelNum}
          {isMax && <span style={{ fontSize:10, marginLeft:6, color:"#ffd700" }}>MAX</span>}
        </span>
        <span style={{ fontSize:11, color:"var(--text2)", fontVariantNumeric:"tabular-nums" }}>
          {isMax ? "ZERADO 🏆" : `${info.xpInLevel}/${XP_PER_LEVEL} XP`}
        </span>
      </div>
      <div className="xp-bar-wrap">
        <div className="xp-bar-fill" style={{ width:`${info.pctInLevel}%`, background:isMax?"linear-gradient(90deg,#ffd700,#ff8c00)":info.color }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontSize:10, color:"var(--text2)" }}>{xp.toLocaleString("pt-BR")} XP total</span>
        {!isMax && nextTierLv && (
          <span style={{ fontSize:10, color:info.color }}>
            🔓 {info.tier==="iniciante" ? "Investidor" : "Avançado"} no NV.{nextTierLv} · faltam {(nextTierLv - info.levelNum)} níveis
          </span>
        )}
      </div>
    </div>
  );
}

function Toast({ msg, onDone }: { msg:string; onDone:()=>void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

function Modal({ title, onClose, children }: { title:string; onClose?:()=>void; children:React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:"16px" }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:20, width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto", padding:"20px 20px 28px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800 }}>{title}</h3>
          {onClose && <button onClick={onClose} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", width:32, height:32, borderRadius:8, fontSize:16 }}>✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── STREAK MILESTONE MODAL ────────────────────────────────────────────────────
function StreakMilestoneModal({ days, xpGained, onClose }: { days:number; xpGained:number; onClose:()=>void }) {
  const info = days === 7
    ? { emoji:"⚡", title:"7 Dias Consecutivos!", color:"#6c63ff",
        quote:"\"A consistência é o que transforma a média em excelência.\" — Tony Robbins",
        msg:"Uma semana inteira controlando seu dinheiro. Você está construindo um hábito que menos de 10% das pessoas têm." }
    : days === 15
    ? { emoji:"💎", title:"15 Dias! Você é diferente.", color:"#a78bfa",
        quote:"\"Quem não sabe para onde vai o dinheiro, sempre vai a lugar nenhum.\" — Primo Rico",
        msg:"Meio mês de disciplina financeira. Você já vê para onde vai cada real. Isso é poder." }
    : { emoji:"👑", title:"30 Dias! Missão do Mês Concluída.", color:"#ffd700",
        quote:"\"Riqueza nasce da constância, não do acaso.\" — Flávio Augusto",
        msg:"Um mês completo. Isso é mentalidade de quem constrói patrimônio. O streak recomeça — e você já sabe que consegue." };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:24, padding:"32px 24px", maxWidth:380, width:"100%", textAlign:"center", border:`2px solid ${info.color}55` }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:64, marginBottom:8 }}>{info.emoji}</div>
        <div style={{ fontSize:11, fontWeight:800, color:info.color, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>🏆 CONQUISTA DESBLOQUEADA</div>
        <div style={{ fontSize:22, fontWeight:900, color:info.color, marginBottom:12 }}>{info.title}</div>
        <div style={{ fontSize:14, color:"var(--text2)", lineHeight:1.7, marginBottom:14 }}>{info.msg}</div>
        <div style={{ background:`${info.color}10`, border:`1px solid ${info.color}30`, borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:13, color:"var(--text2)", fontStyle:"italic", lineHeight:1.6 }}>
          {info.quote}
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:"#ffd700", marginBottom:16 }}>+{xpGained} XP 🔥</div>
        <button onClick={onClose} style={{ background:info.color, color:"#000", border:"none", borderRadius:14, padding:"14px 32px", fontSize:15, fontWeight:800, cursor:"pointer", width:"100%" }}>
          🚀 Continuar a jornada!
        </button>
      </div>
    </div>
  );
}

// ── STREAK MODAL ──────────────────────────────────────────────────────────────
function StreakModal({ user, onClose, onClaim }: { user:User; onClose:()=>void; onClaim:(d:any)=>void }) {
  const [streakDays, setStreakDays] = useState(0);
  const [claimed, setClaimed] = useState<boolean|null>(null);
  const [xpGained, setXpGained] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState("");
  const [milestone, setMilestone] = useState<number|null>(null);
  const [streakBroken, setStreakBroken] = useState(false);

  useEffect(() => {
    fetch(`${API}/users/${user.id}/streak`)
      .then(r => r.json())
      .then(d => {
        const days = d.streakDays || 0;
        setStreakDays(days);
        setClaimed(!!d.claimedToday);
        setExpiresIn(d.expiresIn || "");
        setStreakBroken(!!d.streakBroken);
        if (d.claimedToday) setXpGained(days * 10);
      })
      .catch(() => setClaimed(false));
  }, []);

  const handleClaim = async () => {
    if (loading || claimed === true) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${user.id}/streak/checkin`, { method:"POST", headers:{"Content-Type":"application/json"} });
      const data = await res.json();
      if (res.ok) {
        setStreakDays(data.streakDays);
        setXpGained(data.xpGained);
        setClaimed(true);
        if (data.isMilestone) setMilestone(data.streakDays);
        onClaim(data);
      } else if (data?.error?.includes("hoje")) {
        setClaimed(true);
      }
    } catch {}
    setLoading(false);
  };

  if (milestone) return <StreakMilestoneModal days={milestone} xpGained={xpGained} onClose={()=>{ setMilestone(null); onClose(); }}/>;

  const nextDay = claimed ? streakDays : streakDays + 1;
  const nextXP = nextDay * 10;
  const accent = streakDays >= 30 ? "#ffd700" : streakDays >= 14 ? "#a78bfa" : streakDays >= 7 ? "#6c63ff" : "#f97316";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }} onClick={onClose}>
      <div style={{ background:"var(--bg2)", borderRadius:24, width:"100%", maxWidth:400, padding:"28px 24px 32px", position:"relative", border:"1px solid rgba(108,99,255,0.25)" }} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", width:30, height:30, borderRadius:8, fontSize:13 }}>✕</button>

        <div style={{ textAlign:"center", marginBottom:20 }}>
          {streakBroken && (
            <div style={{ background:"rgba(255,77,106,0.1)", border:"1px solid rgba(255,77,106,0.3)", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:12, color:"#ff4d6a" }}>
              💔 Sua streak foi resetada — você perdeu um dia. Comece de novo!
            </div>
          )}
          <div style={{ fontSize:52, marginBottom:8 }}>{streakDays >= 30 ? "👑" : streakDays >= 14 ? "💎" : streakDays >= 7 ? "⚡" : "🔥"}</div>
          <div style={{ fontSize:72, fontWeight:900, color:accent, lineHeight:1, letterSpacing:"-3px", fontVariantNumeric:"tabular-nums" }}>
            {claimed ? streakDays : streakDays === 0 ? 1 : streakDays + 1}
          </div>
          <div style={{ fontSize:12, color:"var(--text2)", textTransform:"uppercase", letterSpacing:2, marginTop:4 }}>DIAS SEGUIDOS</div>
        </div>

        {!claimed && claimed !== null && (
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <span style={{ fontSize:28, fontWeight:900, color:"#ffd700" }}>+{nextXP}</span>
            <span style={{ fontSize:14, color:"var(--text2)", marginLeft:4 }}>XP ao resgatar</span>
          </div>
        )}

        {expiresIn && !claimed && (
          <div style={{ textAlign:"center", marginBottom:14 }}>
            <span style={{ background:"rgba(255,183,3,0.1)", border:"1px solid rgba(255,183,3,0.2)", borderRadius:8, padding:"4px 10px", color:"#ffb703", fontSize:12 }}>⏱ Disponível por mais {expiresIn}</span>
          </div>
        )}

        {/* Milestones — sem emoji ao lado, só em cima */}
        <div style={{ display:"flex", justifyContent:"space-between", gap:4, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
          {[
            { day:1,  xp:10,  emoji:"🔥", label:"1"  },
            { day:2,  xp:20,  emoji:"🔥", label:"2"  },
            { day:3,  xp:30,  emoji:"🔥", label:"3"  },
            { day:5,  xp:50,  emoji:"🔥", label:"5"  },
            { day:7,  xp:70,  emoji:"⚡",  label:"7"  },
            { day:14, xp:140, emoji:"💎", label:"14" },
            { day:30, xp:300, emoji:"👑", label:"30" },
          ].map((m,i)=>{
            const active = (claimed ? streakDays : streakDays+1) >= m.day;
            const isCurrent = (claimed ? streakDays : streakDays+1) === m.day;
            return (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, minWidth:36,
                background: isCurrent ? "rgba(108,99,255,0.25)" : active ? "rgba(108,99,255,0.10)" : "var(--bg3)",
                border: `1.5px solid ${isCurrent ? "#6c63ff" : active ? "rgba(108,99,255,0.3)" : "var(--border)"}`,
                borderRadius:10, padding:"6px 4px" }}>
                <span style={{ fontSize:16 }}>{m.emoji}</span>
                <span style={{ fontSize:10, fontWeight:800, color: active ? "var(--text)" : "var(--text2)" }}>{m.label}</span>
                <span style={{ fontSize:9, color: active ? accent : "var(--text2)", fontWeight:700 }}>{m.xp}xp</span>
              </div>
            );
          })}
        </div>

        {claimed === null ? (
          <div style={{ width:"100%", padding:15, borderRadius:14, background:"var(--bg3)", textAlign:"center", color:"var(--text2)", fontSize:14 }}>Carregando...</div>
        ) : claimed ? (
          <div style={{ width:"100%", padding:16, borderRadius:14, background:"rgba(0,214,143,0.12)", border:"1px solid rgba(0,214,143,0.35)", textAlign:"center" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--green)" }}>Resgatado hoje! +{xpGained} XP</div>
            <div style={{ fontSize:12, color:"var(--text2)", marginTop:3 }}>Volte amanhã para o dia {streakDays + 1} 🔥</div>
          </div>
        ) : (
          <button onClick={handleClaim} disabled={loading} style={{ width:"100%", padding:16, border:"none", borderRadius:14, background:loading?"var(--bg3)":"linear-gradient(135deg,#6c63ff,#b44fff)", color:loading?"var(--text2)":"white", fontSize:16, fontWeight:800, cursor:loading?"default":"pointer", boxShadow:loading?"none":"0 4px 20px rgba(108,99,255,0.4)" }}>
            {loading ? "⏳ Salvando..." : `🎁 Resgatar +${nextXP} XP`}
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
    { emoji:"💆", name:"Pagar-se",  pct:"5%",  color:"#6c63ff", desc:"Invista em você. Um presente, saúde, desenvolvimento pessoal." },
    { emoji:"💝", name:"Doar",      pct:"5%",  color:"#ff6b9d", desc:"Generosidade quebra a mentalidade de escassez." },
    { emoji:"📈", name:"Investir",  pct:"5%",  color:"#00d68f", desc:"Seu futuro começa aqui. Juros compostos trabalham 24h por você." },
    { emoji:"📋", name:"Contas",    pct:"70%", color:"#ffb703", desc:"Obrigações. A disciplina aqui libera o resto." },
    { emoji:"✨", name:"Sonho",     pct:"10%", color:"#8b5cf6", desc:"Sua meta grande. Viagem, carro, casa — transforma controle em aventura." },
    { emoji:"🌟", name:"Abundar",   pct:"5%",  color:"#f97316", desc:"Você merece. Restaurante, hobby, experiências sem culpa." },
  ];

  const steps = [
    // STEP 0: Jornada de níveis — a tela que faz desejar chegar lá
    <div>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontSize:44, marginBottom:8 }}>⚔️</div>
        <h2 style={{ fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>
          Sua Jornada Começa Aqui
        </h2>
        <p style={{ color:"var(--text2)", fontSize:13, lineHeight:1.6, maxWidth:320, margin:"0 auto" }}>
          Cada ação financeira vira XP. 100 níveis, 3 fases. No topo, você entra no seleto grupo que realmente construiu riqueza.
        </p>
      </div>

      {/* Referência brasileira */}
      <div style={{ background:"linear-gradient(135deg,rgba(255,215,0,0.07),rgba(108,99,255,0.07))", border:"1px solid rgba(255,215,0,0.2)", borderRadius:16, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:10, color:"#ffd700", fontWeight:800, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>💡 QUEM JÁ CHEGOU LÁ</div>
        <p style={{ fontSize:13, color:"var(--text)", lineHeight:1.65, margin:0 }}>
          Líderes como <strong style={{color:"var(--text)"}}>Flávio Augusto (Geração de Valor)</strong>, <strong style={{color:"var(--text)"}}>Thiago Nigro (Primo Rico)</strong> e grandes investidores brasileiros seguem exatamente esta lógica: <em style={{color:"var(--text2)"}}>pagar a si primeiro, investir consistentemente e viver dentro dos meios</em> — não importa o salário, o princípio é o mesmo.
        </p>
      </div>

      {/* Três fases */}
      {[
        { emoji:"🌱", tier:"INICIANTE", range:"NV.1 → 49", color:"#6c63ff", bg:"rgba(108,99,255,0.06)",
          headline:"Crie o hábito.",
          desc:"5% investido por mês. O valor não importa tanto quanto a consistência. Você está reprogramando sua mentalidade." },
        { emoji:"📈", tier:"INVESTIDOR", range:"NV.50 → 99", color:"#00d68f", bg:"rgba(0,214,143,0.06)",
          headline:"Acelere o patrimônio.",
          desc:"15% investido. Juros compostos trabalhando a seu favor. Você já provou que tem disciplina — hora de aumentar o ritmo." },
        { emoji:"👑", tier:"AVANÇADO", range:"NV.100", color:"#ffd700", bg:"rgba(255,215,0,0.06)",
          headline:"Você superou o app.",
          desc:"25% investido. TOP 1% da população. Missão cumprida — você transformou disciplina em liberdade financeira real." },
      ].map((n,i)=>(
        <div key={i} style={{ background:n.bg, border:`1px solid ${n.color}33`, borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>{n.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontWeight:900, fontSize:13, color:n.color }}>{n.tier}</span>
                <span style={{ fontSize:10, color:"var(--text2)", background:"var(--bg3)", padding:"2px 7px", borderRadius:5 }}>{n.range}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:"var(--text)", marginTop:1 }}>{n.headline}</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5, paddingLeft:34 }}>{n.desc}</div>
        </div>
      ))}

      <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"10px 14px", marginTop:4, fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>
        🔥 <strong style={{color:"var(--text)"}}>Como ganhar XP:</strong> Renda extra (1 real = 1 XP) · Pagar contas (+15 XP) · Streak diária (até +300 XP/dia)
      </div>
    </div>,

    // STEP 1: Os 6 Potes
    <div>
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <div style={{ fontSize:38, marginBottom:6 }}>🏺</div>
        <h2 style={{ fontSize:20, fontWeight:900, marginBottom:6 }}>Os 6 Potes da Riqueza</h2>
        <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
          Esta metodologia — usada por milionários ao redor do mundo — divide sua renda em 6 destinos. No NV.50 as porcentagens mudam para maximizar seu patrimônio.
        </p>
      </div>

      <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"10px 14px", marginBottom:12, fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>
        📊 <strong style={{color:"var(--text)"}}>Distribuição atual (Iniciante):</strong> Foco em criar o hábito. Quando você virar Investidor (NV.50), Investir sobe para 15% e Contas cai para 55%.
      </div>

      {POTES.map((p,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}`, marginBottom:7 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>{p.emoji}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
              <span style={{ fontSize:12, color:p.color, fontWeight:800, background:`${p.color}18`, padding:"2px 9px", borderRadius:6 }}>{p.pct}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", marginTop:2, lineHeight:1.4 }}>{p.desc}</div>
          </div>
        </div>
      ))}
    </div>,

    // STEP 2: Configurar salário
    <OnboardingSalary user={user} onDone={onDone}/>,
  ];

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", padding:"20px 16px" }}>
      {/* Progresso */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24 }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ flex:i===step?2:1, height:6, borderRadius:3, background:i<=step?"var(--primary)":"var(--bg3)", transition:"all .35s" }}/>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>{steps[step]}</div>
      {step<2 && (
        <button className="btn-primary" onClick={()=>setStep(s=>s+1)} style={{ width:"100%", marginTop:20, padding:"15px", fontSize:15, fontWeight:800 }}>
          {step===0 ? "Ver os 6 Potes →" : "Configurar meu perfil →"}
        </button>
      )}
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
  const [mode, setMode] = useState<"login"|"register"|"intro"|"forgot">("intro");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDone, setForgotDone] = useState(false);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/${mode}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data = await res.json();
      if (!res.ok) { setError(data.error||"Erro"); return; }
      onLogin(data.user);
    } catch { setError("Erro de conexão"); } finally { setLoading(false); }
  };

  const submitForgot = async () => {
    if (!forgotEmail.trim()) { setError("Digite seu e-mail"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/reset-password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:forgotEmail.trim()})});
      const data = await res.json();
      if (!res.ok) { setError(data.error||"E-mail não encontrado"); }
      else { setForgotDone(true); }
    } catch { setError("Erro de conexão"); }
    setLoading(false);
  };

  if (mode==="intro") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0a0d14,#111420)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", textAlign:"center" }}>
      <div style={{ marginBottom:14 }}><LogoIcon size={68}/></div>
      <h1 style={{ fontSize:34, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff,#ffd700)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>NaCarteira</h1>
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

  if (mode==="forgot") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:370 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><LogoIcon size={44}/></div>
          <h1 style={{ fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>NaCarteira</h1>
        </div>
        <div className="card">
          {forgotDone ? (
            <div style={{ textAlign:"center", padding:"12px 0" }}>
              <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:16, fontWeight:800, color:"var(--green)", marginBottom:8 }}>Senha resetada!</div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6, marginBottom:20 }}>
                Sua senha foi redefinida para <strong style={{color:"var(--text)"}}>0000</strong>.<br/>
                Entre com ela e troque em ⚙️ Configurações.
              </div>
              <button className="btn-primary" onClick={()=>{setMode("login");setForgotDone(false);setForgotEmail("");}} style={{ width:"100%" }}>
                Ir para o login →
              </button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>🔑 Redefinir Senha</div>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.5 }}>
                Digite seu e-mail cadastrado. Sua senha será redefinida para <strong style={{color:"var(--text)"}}>0000</strong> — troque depois em ⚙️ Configurações.
              </div>
              <input type="email" placeholder="Seu e-mail cadastrado" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitForgot()}/>
              {error&&<p style={{ color:"var(--red)", fontSize:13, textAlign:"center", margin:0 }}>{error}</p>}
              <button className="btn-primary" onClick={submitForgot} disabled={loading} style={{ width:"100%" }}>
                {loading ? "Aguarde..." : "Redefinir para 0000"}
              </button>
              <button className="btn-ghost" onClick={()=>{setMode("login");setError("");}} style={{ width:"100%", fontSize:12 }}>← Voltar ao login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:370 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}><LogoIcon size={44}/></div>
          <h1 style={{ fontSize:22, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>NaCarteira</h1>
        </div>
        <div className="card">
          <div style={{ display:"flex", gap:8, marginBottom:18 }}>
            {(["login","register"] as const).map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError("");}} style={{ flex:1, padding:"10px", borderRadius:10, fontWeight:700, fontSize:13, background:mode===m?"var(--primary)":"var(--bg3)", color:mode===m?"white":"var(--text2)", border:"1.5px solid var(--border)" }}>{m==="login"?"Entrar":"Cadastrar"}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {mode==="register"&&<input placeholder="Seu nome" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>}
            <input type="email" placeholder="E-mail" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
            <input type="password" placeholder="Senha" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            {error&&<p style={{ color:"var(--red)", fontSize:13, textAlign:"center", margin:0 }}>{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ width:"100%", marginTop:4 }}>{loading?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}</button>
            {mode==="login" && (
              <button onClick={()=>{setMode("forgot");setError("");}} style={{ background:"none", border:"none", color:"var(--text2)", fontSize:12, cursor:"pointer", padding:"4px 0" }}>
                Esqueci minha senha
              </button>
            )}
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
function DashboardContent({ expenses,cc,incomes,salary,balance,totalExpSemSonho,totalExpReais,totalInvestido,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,levelInfo,onStreak,onCreditClick }: any) {
  const [collapsedCards, setCollapsedCards] = useState<Record<string,boolean>>({});
  const toggleCard = (id: string) => setCollapsedCards(p => ({...p,[id]:!p[id]}));
  const isCollapsed = (id: string) => !!collapsedCards[id];

  const CollapseHeader = ({ id, children }: { id:string; children:React.ReactNode }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={()=>toggleCard(id)}>
      <div style={{ flex:1 }}>{children}</div>
      <span style={{ fontSize:12, color:"var(--text2)", marginLeft:8, flexShrink:0 }}>{isCollapsed(id)?"▶":"▼"}</span>
    </div>
  );

  return (
    <>
      {/* SAÚDE FINANCEIRA — topo */}
      <HealthCard score={healthScore} salary={salary}/>

      {/* STREAK */}
      <div onClick={onStreak} style={{ background:streakClaimed?"rgba(0,214,143,0.05)":"rgba(108,99,255,0.06)", border:`1px solid ${streakClaimed?"rgba(0,214,143,0.28)":"rgba(108,99,255,0.32)"}`, borderRadius:14, padding:"12px 16px", marginBottom:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:totalInvestido>0?10:14 }}>
        {[
          { label:"Salário Base",    value:fmt(salary),                              color:"var(--primary)", icon:"💼" },
          { label:"Despesas Reais",  value:fmt(totalExpReais+totalCC),               color:"var(--red)",     icon:"💸" },
          { label:"Renda Extra",     value:fmt(totalIncome),                         color:"var(--green)",   icon:"💵" },
          { label:"Saldo Livre",     value:fmt(balance), color:balance>=0?"var(--green)":"var(--red)", icon:balance>=0?"✅":"⚠️" },
        ].map((k,i)=>(
          <div key={i} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 14px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:17, marginBottom:3 }}>{k.icon}</div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>{k.label}</div>
            <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color, marginTop:2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* CAPITAL ALOCADO — COLAPSÁVEL */}
      {(()=>{
        const investTotal = byCategory.find((c:any)=>c.id===INVESTIR_ID)?.total||0;
        if (investTotal === 0) return null;
        const receita = salary + totalIncome;
        const pct = receita > 0 ? Math.round(investTotal/receita*100) : 0;
        const tier = levelInfo?.tier || "iniciante";
        const targetPct = getTargetPct(tier);

        type RiskProfile = { label:string; color:string; icon:string; tip:string; tipExtra?: string };
        let riskProfile: RiskProfile;
        if (tier === "avancado") {
          if (pct >= 20) riskProfile = { label:"Agressivo", color:"#a78bfa", icon:"🚀", tip:"Você está no topo. Considere diversificar em FIIs, BDRs e fundos internacionais.", tipExtra:"Verifique se sua reserva de emergência está intacta." };
          else if (pct >= 10) riskProfile = { label:"Moderado", color:"#00d68f", icon:"📈", tip:"Bom ritmo. Explore fundos de índice (ETFs) e previdência PGBL/VGBL.", tipExtra:`Target Avançado: ${targetPct.investir}% — você está em ${pct}%.` };
          else riskProfile = { label:"Abaixo do target", color:"#ffb703", icon:"⚠️", tip:"Para seu nível, você pode aportar mais.", tipExtra:`Meta recomendada: ${targetPct.investir}%. Você está em ${pct}%.` };
        } else if (tier === "investidor") {
          if (pct >= 15) riskProfile = { label:"Acima do Target", color:"#a78bfa", icon:"🚀", tip:"Excelente! Considere CDBs de liquidez diária e LCI/LCA isentos.", tipExtra:"Não coloque mais de 30% em um único ativo." };
          else if (pct >= 10) riskProfile = { label:"No Target", color:"#00d68f", icon:"✅", tip:`Perfeito para Investidor. Foque em Tesouro Selic para reserva.`, tipExtra:`Meta: ${targetPct.investir}% — você está em ${pct}%.` };
          else riskProfile = { label:"Conservador", color:"#ffb703", icon:"🛡️", tip:"Priorize Tesouro Selic até completar reserva de emergência (6× despesas).", tipExtra:`Meta: ${targetPct.investir}% — você está em ${pct}%.` };
        } else {
          if (pct >= 10) riskProfile = { label:"Acima do esperado!", color:"#00d68f", icon:"🌱", tip:"Incrível! Certifique-se de ter reserva de emergência antes de mais risco.", tipExtra:"Chegando a 100 XP você vira Investidor." };
          else if (pct >= 5) riskProfile = { label:"No caminho certo", color:"#6c63ff", icon:"💡", tip:"Ótimo começo. Tesouro Selic e CDBs de alta liquidez são perfeitos.", tipExtra:`Meta: ${targetPct.investir}% — você está em ${pct}%.` };
          else riskProfile = { label:"Comece pequeno", color:"#ffb703", icon:"🌱", tip:"Mesmo R$50/mês com juros compostos valem muito em 10 anos.", tipExtra:"Automatize um aporte fixo todo dia de pagamento." };
        }

        const collapsed = isCollapsed("capital");

        return (
          <div style={{ background:"linear-gradient(135deg,rgba(0,214,143,0.07),rgba(0,214,143,0.03))", border:"1px solid rgba(0,214,143,0.28)", borderRadius:14, padding:"13px 16px", marginBottom:14 }}>
            <CollapseHeader id="capital">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:24 }}>📈</span>
                <div>
                  <div style={{ fontSize:10, color:"#00d68f", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4 }}>Capital Alocado este Mês</div>
                  <div style={{ fontSize:20, fontWeight:900, color:"#00d68f", fontVariantNumeric:"tabular-nums" }}>{fmt(investTotal)}</div>
                </div>
              </div>
            </CollapseHeader>
            {!collapsed && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700 }}>% DA RECEITA</div>
                    <div style={{ fontSize:20, fontWeight:900, color:riskProfile.color }}>{pct}%</div>
                  </div>
                </div>
                {receita > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text2)", marginBottom:4 }}>
                      <span>Atual: {pct}%</span>
                      <span>Target {levelInfo?.label?.toLowerCase()||"iniciante"}: {targetPct.investir}%</span>
                    </div>
                    <div style={{ height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pct/targetPct.investir*100,100)}%`, background:"linear-gradient(90deg,#00d68f,#6c63ff)", borderRadius:3, transition:"width .6s" }}/>
                    </div>
                  </div>
                )}
                <div style={{ background:"rgba(0,0,0,0.18)", borderRadius:10, padding:"9px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                    <span style={{ fontSize:16 }}>{riskProfile.icon}</span>
                    <span style={{ fontSize:11, fontWeight:800, color:riskProfile.color }}>{riskProfile.label}</span>
                  </div>
                  <div style={{ fontSize:11, color:"var(--text2)", lineHeight:1.5 }}>{riskProfile.tip}</div>
                  {riskProfile.tipExtra && (
                    <div style={{ fontSize:10, color:"var(--text2)", marginTop:5, paddingTop:5, borderTop:"1px solid rgba(255,255,255,0.06)", fontStyle:"italic" }}>{riskProfile.tipExtra}</div>
                  )}
                </div>
                <div style={{ marginTop:8, fontSize:10, color:"rgba(0,214,143,0.6)", display:"flex", alignItems:"flex-start", gap:5 }}>
                  <span style={{ flexShrink:0 }}>ℹ️</span>
                  <span>Investimento é uma <strong style={{ color:"rgba(0,214,143,0.8)" }}>conquista</strong>, não um gasto — mas entra no saldo para controle real.</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* FATURA DO CARTÃO — COLAPSÁVEL */}
      {totalCC>0&&(
        <div style={{ background:"var(--bg2)", border:"1px solid rgba(255,183,3,0.3)", borderRadius:14, padding:"12px 16px", marginBottom:14, borderTop:"3px solid var(--yellow)" }}>
          <CollapseHeader id="fatura">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, marginBottom:3 }}>💳 Fatura do Cartão</div>
                <div style={{ fontSize:20, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(totalCC)}</div>
                <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{cc.length} lançamento{cc.length!==1?"s":""}</div>
              </div>
              <div style={{ fontSize:34 }}>💳</div>
            </div>
          </CollapseHeader>
          {!isCollapsed("fatura") && (
            <div style={{ marginTop:10 }}>
              <button onClick={onCreditClick} style={{ width:"100%", background:"rgba(255,183,3,0.1)", border:"1px solid rgba(255,183,3,0.3)", color:"var(--yellow)", borderRadius:10, padding:"8px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Ver detalhes →
              </button>
            </div>
          )}
        </div>
      )}

      {/* INVESTINDO NO SONHO — COLAPSÁVEL */}
      {sonhoTotal>0&&(
        <div style={{ background:"linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.08))", border:"1px solid rgba(6,182,212,0.28)", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
          <CollapseHeader id="sonho">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
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
          </CollapseHeader>
          {!isCollapsed("sonho") && sonhoRecorrente&&(
            <div style={{ marginTop:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text2)", marginBottom:4 }}>
                <span>Meta: {fmt(num(sonhoRecorrente.recurringGoal))}</span>
                <span>{Math.round(sonhoProgresso)}% concluído</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${sonhoProgresso}%`, background:"linear-gradient(90deg,#06b6d4,#8b5cf6)" }}/></div>
            </div>
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
  const [user, setUser] = useState<User|null>(()=>{ try{return JSON.parse(sessionStorage.getItem("nc_user")||"null")}catch{return null} });
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
  const [lastAIInsight, setLastAIInsight] = useState(() => { const d = localStorage.getItem('nc_last_ai'); return d ? new Date(d) : null; });
  const [showStreak, setShowStreak] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{levelNum:number;tier:string}|null>(null);
  const [isPC, setIsPC] = useState(typeof window!=="undefined" && window.innerWidth>=1024);

  useEffect(()=>{ const h=()=>setIsPC(window.innerWidth>=1024); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]);

  const showToast = (msg:string) => setToast(msg);

  const gainXpRaw = useCallback(async (xpGain:number) => {
    if (!user) return;
    try {
      const res = await fetch(`${API}/users/${user.id}/xp`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({xpGain})});
      const data = await res.json();
      const prevInfo = getLevelInfo(xp);
      const newInfo  = getLevelInfo(data.xp);
      setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level);
      // Detectar level up
      if (newInfo.levelNum > prevInfo.levelNum) {
        // Só mostra modal em marcos especiais ou a cada 10 níveis
        const lv = newInfo.levelNum;
        if (lv === TIER_BREAK || lv === MAX_LEVEL || lv % 10 === 0) {
          setLevelUpInfo({ levelNum: lv, tier: newInfo.tier });
        } else {
          showToast(`⚔️ LEVEL UP! ${newInfo.label} NV.${lv}`);
        }
      } else {
        showToast(`+${xpGain} XP ⚔️`);
      }
    } catch {}
  },[user, xp]);

  const login = (u:User) => {
    sessionStorage.setItem("nc_user",JSON.stringify(u)); setUser(u);
    setSalary(num(u.salaryBase));
    setXp(num(u.xp));           // sempre — mesmo que seja 0
    setLevelNum(num(u.levelNum) || 1);
    setLevel(u.level || "iniciante");
    setStreakDays(num(u.streakDays));
    if (u.isNewUser) setShowOnboarding(true);
    if (u.lastCheckin) {
      const today=new Date(); today.setHours(0,0,0,0);
      const last=new Date(u.lastCheckin); last.setHours(0,0,0,0);
      setStreakClaimed(last.getTime()===today.getTime());
    }
  };

  const logout = () => { sessionStorage.removeItem("nc_user"); setUser(null); setSalary(0); };

  const load = useCallback(async () => {
    if (!user) return;
    const [e,c,i] = await Promise.all([
      fetch(`${API}/users/${user.id}/expenses`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/users/${user.id}/credit-card`).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/users/${user.id}/extra-income`).then(r=>r.json()).catch(()=>[]),
    ]);
    setExpenses(Array.isArray(e)?e:[]); setCC(Array.isArray(c)?c:[]); setIncomes(Array.isArray(i)?i:[]);
    // Recarrega usuário completo sempre do servidor
    try {
      const uRes = await fetch(`${API}/auth/me/${user.id}`);
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData.salaryBase !== undefined) setSalary(num(uData.salaryBase));
        if (uData.xp !== undefined) setXp(num(uData.xp));
        if (uData.levelNum !== undefined) setLevelNum(num(uData.levelNum) || 1);
        if (uData.level) setLevel(uData.level);
        if (uData.streakDays !== undefined) setStreakDays(num(uData.streakDays));
        if (uData.lastCheckin !== undefined) {
          const today = new Date(); today.setHours(0,0,0,0);
          const last = uData.lastCheckin ? new Date(uData.lastCheckin) : null;
          if (last) { last.setHours(0,0,0,0); setStreakClaimed(last.getTime()===today.getTime()); }
          else { setStreakClaimed(false); }
        }
      }
    } catch {}
  },[user]);

  useEffect(()=>{ if(user) { apiFetch(`${API}/auth/me/${user.id}`).then(r=>r.json()).then(uData => setUser(u => u ? {...u, ...uData} : u)); load(); } },[load, user?.id]);

  useEffect(()=>{
    if (!expenses.length) return;
    const dueSoon = expenses.filter(e=>{ if (!e.dueDate||e.paid) return false; const diff=Math.ceil((new Date(e.dueDate).getTime()-new Date().getTime())/86400000); return diff>=0&&diff<=3; });
    if (dueSoon.length>0) setTimeout(()=>showToast(`⚠️ ${dueSoon.length} conta(s) vencem em breve!`),1500);
  },[expenses]);

  if (!user) return <Auth onLogin={login}/>;
  if (showOnboarding) return <Onboarding user={user} onDone={()=>{setShowOnboarding(false);load();}}/>;

  // CÁLCULOS
  const totalInvestido = expenses.filter(e=>Number(e.categoryId)===INVESTIR_ID).reduce((s,e)=>s+num(e.amount),0);
  // Todas as despesas entram no total — Sonho e Investir são conquistas mas contam como saída
  const totalExpAll = expenses.reduce((s,e)=>s+num(e.amount),0);
  // Alias para compatibilidade com dashboard/reports
  const totalExpSemSonho = totalExpAll;
  const totalExpReais = totalExpAll; // tudo conta no saldo/pendente
  const totalCC = cc.reduce((s,c)=>s+num(c.amount),0);
  // CC não pago = pendente real (não basta ter renda, precisa marcar pago)
  const totalCCPago = cc.filter((c:any)=>c.paid).reduce((s:number,c:any)=>s+num(c.amount),0);
  const totalIncome = incomes.reduce((s,i)=>s+num(i.amount),0);
  const totalPaid = expenses.filter(e=>e.paid).reduce((s,e)=>s+num(e.amount),0) + totalCCPago;
  const totalPending = totalExpAll + totalCC - totalPaid;
  // Saldo = Receita - Todas despesas - Cartão
  const balance = salary + totalIncome - totalExpAll - totalCC;
  const extraNeeded = Math.max(0, totalExpAll+totalCC-salary);
  // Tier de nível baseado no XP total
  const levelInfo = getLevelInfo(xp);
  // FIX #1: Sonho — busca por categoryId === SONHO_ID
  const sonhoExp = expenses.filter(e=>Number(e.categoryId)===SONHO_ID);
  const sonhoTotal = sonhoExp.reduce((s,e)=>s+num(e.amount),0);
  const sonhoPago = sonhoExp.some(e=>!!e.paid);
  const sonhoRecorrente = sonhoExp.find(e=>e.recurring && num(e.recurringGoal)>0 && num(e.recurringMonths)>0);
  const sonhoProgresso = sonhoRecorrente ? Math.min(sonhoTotal/num(sonhoRecorrente.recurringGoal)*100,100) : 0;
  const byCategory = CATS.map(cat=>({...cat,items:expenses.filter(e=>Number(e.categoryId)===cat.id),total:expenses.filter(e=>Number(e.categoryId)===cat.id).reduce((s,e)=>s+num(e.amount),0)}));
  // Score de saúde financeira — usa total real (todas as categorias)
  const healthScore = calcHealthScore(salary, totalExpAll, totalIncome, totalPaid, totalExpAll+totalCC, streakDays);

  const NAV = [{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"expenses",icon:"💸",label:"Despesas"},{id:"credit",icon:"💳",label:"Cartão"},{id:"income",icon:"💵",label:"Renda Extra"},{id:"reports",icon:"📈",label:"Relatórios"}];

  const onStreakClaim = (data:any) => { setXp(data.xp); setLevelNum(data.levelNum); setLevel(data.level); setStreakDays(data.streakDays); setStreakClaimed(true); showToast(`+${data.xpGained} XP 🔥 ${data.streakDays} dias!`); load(); };

  // FIX #2: reset-month não zera XP — atualiza state após reset
  const handleReset = async () => {
    try {
      // Envia o mês do cliente para respeitar o timezone do usuário
      const clientMonth = new Date().toLocaleDateString("pt-BR-u-ca-iso8601").slice(0,7).replace("/","-") ||
        `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
      const res = await fetch(`${API}/users/${user.id}/reset-month`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: clientMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Erro ao arquivar: ${data.error || "tente novamente"}`);
        return;
      }
      // XP preservado — só atualiza se o servidor retornar dados do usuário
      if (data.user) {
        if (data.user.xp !== undefined) setXp(data.user.xp);
        if (data.user.levelNum !== undefined) setLevelNum(data.user.levelNum);
      }
      setShowReset(false);
      await load();
      showToast("✅ Mês arquivado! Começando do zero.");
    } catch(e) {
      showToast("❌ Erro de conexão. Tente novamente.");
    }
  };

  const sharedModals = (
    <>
      {toast&&<Toast msg={toast} onDone={()=>setToast("")}/>}
      {levelUpInfo&&<LevelUpModal levelNum={levelUpInfo.levelNum} tier={levelUpInfo.tier} onClose={()=>setLevelUpInfo(null)}/>}
      {showStreak&&<StreakModal user={user} onClose={()=>setShowStreak(false)} onClaim={onStreakClaim}/>}
      {showAddExp&&<AddExpenseModal userId={user.id} onClose={()=>{setShowAddExp(false);load();}} onXp={gainXpRaw}/>}
      {showAddCC&&<AddCCModal userId={user.id} onClose={()=>{setShowAddCC(false);load();}} onXp={gainXpRaw}/>}
      {showAddIncome&&<AddIncomeModal userId={user.id} onClose={()=>{setShowAddIncome(false);load();}} onXp={gainXpRaw}/>}
      {showSettings&&<SettingsModal user={user} salary={salary} onSave={(s:number)=>{setSalary(s);showToast("✅ Salário atualizado!");setShowSettings(false);}} onClose={()=>setShowSettings(false)} onReset={()=>{setShowSettings(false);setShowReset(true);}}/>}
      {showMethodology&&<MethodologyModal xp={xp} onClose={()=>setShowMethodology(false)}/>}
      {showReset&&<ResetModal onClose={()=>setShowReset(false)} onConfirm={handleReset}/>}
    </>
  );

  const dashProps = { expenses,cc,incomes,salary,balance,totalExpSemSonho,totalExpReais,totalInvestido,totalCC,totalIncome,totalPaid,totalPending,extraNeeded,sonhoTotal,sonhoPago,sonhoRecorrente,sonhoProgresso,byCategory,streakDays,streakClaimed,healthScore,levelInfo,onStreak:()=>setShowStreak(true),onCreditClick:()=>setTab("credit") };

  // ── PC LAYOUT ─────────────────────────────────────────────────────────────
  if (isPC) return (
    <>
      {sharedModals}
      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>
        <aside style={{ width:235, background:"var(--bg2)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" }}>
          <div style={{ padding:"22px 18px 14px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <LogoIcon size={26}/>
              <span style={{ fontSize:16, fontWeight:900, background:"linear-gradient(135deg,#6c63ff,#b44fff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>NaCarteira</span>
            </div>
            <div style={{ fontSize:11, color:"var(--text2)", paddingLeft:36 }}>Olá, {user.name?.split(" ")[0]}!</div>
          </div>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ fontSize:10, fontWeight:800, color:levelInfo.color }}>⚔️ {levelInfo.label} NV.{levelNum}</span>
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
              {[{label:"Saldo",value:fmt(balance),color:balance>=0?"var(--green)":"var(--red)"},{label:"Despesas",value:fmt(totalExpReais+totalCC),color:"var(--red)"},{label:"Saúde",value:`${healthScore}/100`,color:getHealthBand(healthScore).color}].map((k,i)=>(
                <div key={i} style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"7px 13px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, fontVariantNumeric:"tabular-nums", color:k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
            <XPLevel xp={xp}/>
            {tab==="dashboard"&&<DashboardContent {...dashProps}/>}
            {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)}
              onPay={async(exp:Expense)=>{ await fetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }}
              onDelete={async(id:number)=>{ await fetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}
              onEdit={async(id:number,name:string,amount:string)=>{ await fetch(`${API}/expenses/${id}/edit`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,amount:parseFloat(amount)})}); load(); }}
            />}
            {tab==="credit"&&<CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)}
              onDelete={async(id:number)=>{ await fetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}
              onPay={async(c:any)=>{ 
                if((c.installments||1)>1 && !c.paid) {
                  // Parcelado + ainda não pago: marca pago E agenda avanço de parcela
                  await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:true})});
                  gainXpRaw(XP_PAY_BILL);
                } else if((c.installments||1)>1 && c.paid) {
                  // Desmarcar pago numa parcela
                  await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:false})});
                } else {
                  await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!c.paid})});
                  if(!c.paid)gainXpRaw(XP_PAY_BILL);
                }
                load();
              }}
              onAdvance={async(c:any)=>{ await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({advanceInstallment:true})}); load(); }}
              onEdit={async(id:number,desc:string,amount:string,dueDay:string)=>{ await fetch(`${API}/credit-card/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,amount:parseFloat(amount),dueDay:dueDay?parseInt(dueDay):null})}); load(); }}
              onPayAll={async()=>{ await fetch(`${API}/users/${user.id}/credit-card/pay-all`,{method:"POST"}); load(); }}
            />}
            {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await fetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }} onEdit={async(id:number,desc:string,amount:string)=>{ await fetch(`${API}/extra-income/${id}/edit`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,amount:parseFloat(amount)})}); load(); }}/>}
            {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} userName={user.name} salary={salary} healthScore={healthScore} totalInvestido={totalInvestido} levelInfo={levelInfo}/>}
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
            <LogoIcon size={20}/> NaCarteira
          </div>
          <div style={{ fontSize:11, color:"var(--text2)" }}>Olá, {user.name?.split(" ")[0]}! <span style={{ color:levelInfo.color, fontWeight:700 }}>⚔️ {levelInfo.label} NV.{levelNum}</span></div>
        </div>
        <div style={{ display:"flex", gap:7 }}>
          <button onClick={()=>setShowMethodology(true)} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>📚</button>
          <button onClick={()=>setShowSettings(true)} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>⚙️</button>
          <button onClick={logout} style={{ background:"var(--bg3)", border:"1px solid var(--border)", color:"var(--text2)", padding:"8px 11px", borderRadius:10, fontSize:12 }}>🚪</button>
        </div>
      </header>
      <main style={{ padding:"14px 14px 0" }}>
        <XPLevel xp={xp}/>
        {tab==="dashboard"&&<DashboardContent {...dashProps}/>}
        {tab==="expenses"&&<ExpensesContent expenses={expenses} byCategory={byCategory} onAdd={()=>setShowAddExp(true)}
          onPay={async(exp:Expense)=>{ await fetch(`${API}/expenses/${exp.id}/paid`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!exp.paid})}); if(!exp.paid)gainXpRaw(XP_PAY_BILL); load(); }}
          onDelete={async(id:number)=>{ await fetch(`${API}/expenses/${id}`,{method:"DELETE"}); load(); }}
          onEdit={async(id:number,name:string,amount:string)=>{ await fetch(`${API}/expenses/${id}/edit`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,amount:parseFloat(amount)})}); load(); }}
        />}
        {tab==="credit"&&<CreditContent cc={cc} totalCC={totalCC} onAdd={()=>setShowAddCC(true)}
          onDelete={async(id:number)=>{ await fetch(`${API}/credit-card/${id}`,{method:"DELETE"}); load(); }}
          onPay={async(c:any)=>{ 
            if((c.installments||1)>1 && !c.paid) {
              await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:true})});
              gainXpRaw(XP_PAY_BILL);
            } else if((c.installments||1)>1 && c.paid) {
              await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:false})});
            } else {
              await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:!c.paid})});
              if(!c.paid)gainXpRaw(XP_PAY_BILL);
            }
            load();
          }}
          onAdvance={async(c:any)=>{ await fetch(`${API}/credit-card/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({advanceInstallment:true})}); load(); }}
          onEdit={async(id:number,desc:string,amount:string,dueDay:string)=>{ await fetch(`${API}/credit-card/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,amount:parseFloat(amount),dueDay:dueDay?parseInt(dueDay):null})}); load(); }}
          onPayAll={async()=>{ await fetch(`${API}/users/${user.id}/credit-card/pay-all`,{method:"POST"}); load(); }}
        />}
        {tab==="income"&&<IncomeContent incomes={incomes} totalIncome={totalIncome} extraNeeded={extraNeeded} onAdd={()=>setShowAddIncome(true)} onDelete={async(id:number)=>{ await fetch(`${API}/extra-income/${id}`,{method:"DELETE"}); load(); }} onEdit={async(id:number,desc:string,amount:string)=>{ await fetch(`${API}/extra-income/${id}/edit`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,amount:parseFloat(amount)})}); load(); }}/>}
        {tab==="reports"&&<ReportsContent byCategory={byCategory} totalExpSemSonho={totalExpSemSonho} totalCC={totalCC} totalIncome={totalIncome} expenses={expenses} cc={cc} xp={xp} userId={user.id} userName={user.name} salary={salary} healthScore={healthScore} totalInvestido={totalInvestido} levelInfo={levelInfo}/>}
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
function ExpensesContent({ expenses,byCategory,onAdd,onPay,onDelete,onEdit }: any) {
  const [editId, setEditId] = useState<number|null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

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
            const isSonhoOrInvest = Number(exp.categoryId)===SONHO_ID || Number(exp.categoryId)===INVESTIR_ID;
            return (
              <div key={exp.id} style={{ padding:"8px 10px", background:"var(--bg3)", borderRadius:10, marginBottom:5, border:`1px solid ${isDueSoon?"rgba(255,183,3,.4)":"var(--border)"}` }}>
                {editId===exp.id ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                    <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nome"
                      style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text)", fontSize:13 }}/>
                    <input value={editAmount} onChange={e=>setEditAmount(e.target.value)} placeholder="Valor (R$)" type="number" step="0.01"
                      style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text)", fontSize:13 }}/>
                    <div style={{ display:"flex", gap:7 }}>
                      <button onClick={()=>{ onEdit(exp.id,editName,editAmount); setEditId(null); }} className="btn-primary" style={{ flex:1, padding:"7px", fontSize:12 }}>✅ Salvar</button>
                      <button onClick={()=>setEditId(null)} style={{ flex:1, padding:"7px", background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text2)", cursor:"pointer", fontSize:12 }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input type="checkbox" checked={!!exp.paid} onChange={()=>onPay(exp)} style={{ width:18, height:18, accentColor:"var(--primary)", flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, textDecoration:exp.paid?"line-through":"none", color:exp.paid?"var(--text2)":isSonhoOrInvest?"var(--text)":"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {exp.name}
                        {isSonhoOrInvest && <span style={{ fontSize:10, color: Number(exp.categoryId)===INVESTIR_ID?"var(--green)":"#06b6d4", fontWeight:700, marginLeft:5 }}>{Number(exp.categoryId)===INVESTIR_ID?"📈 Patrimônio":"✨ Sonho"}</span>}
                      </div>
                      <div style={{ fontSize:10, color:isDueSoon?"var(--yellow)":"var(--text2)" }}>
                        {exp.subcategory&&`${exp.subcategory} · `}
                        {exp.dueDate&&`Vence: ${new Date(exp.dueDate).toLocaleDateString("pt-BR")}`}
                        {isDueSoon&&" ⚠️"}{exp.recurring?" 🔄":""}
                      </div>
                    </div>
                    <span style={{ fontWeight:800, fontSize:12, fontVariantNumeric:"tabular-nums", color:exp.paid?"var(--green)":"var(--yellow)", flexShrink:0 }}>{fmt(num(exp.amount))}</span>
                    <button onClick={()=>{ setEditId(exp.id); setEditName(exp.name); setEditAmount(String(num(exp.amount))); }}
                      style={{ background:"rgba(108,99,255,0.1)", border:"1px solid rgba(108,99,255,0.25)", color:"#a78bfa", borderRadius:7, padding:"4px 8px", fontSize:12, cursor:"pointer", flexShrink:0 }}>✏️</button>
                    <button className="btn-danger" onClick={()=>onDelete(exp.id)} style={{ padding:"4px 8px", flexShrink:0 }}>🗑</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── ABA CARTÃO ────────────────────────────────────────────────────────────────
function CreditContent({ cc, totalCC, onAdd, onDelete, onPay, onEdit, onPayAll, onAdvance }: any) {
  const [editId, setEditId] = useState<number|null>(null);
  const [editVal, setEditVal] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDueDay, setEditDueDay] = useState("");

  const totalPago = cc.filter((c:any)=>c.paid).reduce((s:number,c:any)=>s+num(c.amount),0);
  const totalPendente = totalCC - totalPago;

  // Vencimento global
  const dueDayGlobal = cc.find((c:any)=>c.dueDay)?.dueDay || null;
  const getDueInfo = () => {
    if (!dueDayGlobal) return null;
    const today = new Date();
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), dueDayGlobal);
    if (dueThisMonth < today) dueThisMonth.setMonth(dueThisMonth.getMonth() + 1);
    const diff = Math.ceil((dueThisMonth.getTime() - today.getTime()) / 86400000);
    return { day: dueDayGlobal, diff };
  };
  const dueInfo = getDueInfo();

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:17, fontWeight:800 }}>💳 Cartão</h2>
        <div style={{ display:"flex", gap:7 }}>
          {cc.some((c:any)=>!c.paid) && (
            <button onClick={onPayAll} style={{ padding:"9px 13px", fontSize:12, background:"rgba(0,214,143,0.12)", border:"1px solid rgba(0,214,143,0.3)", color:"var(--green)", borderRadius:10, fontWeight:700, cursor:"pointer" }}>
              ✅ Pagar Fatura
            </button>
          )}
          <button className="btn-primary" onClick={onAdd} style={{ padding:"9px 16px", fontSize:13 }}>+ Adicionar</button>
        </div>
      </div>

      {/* Resumo fatura */}
      <div className="card" style={{ marginBottom:14, borderTop:"3px solid var(--yellow)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase" }}>Total da Fatura</div>
            <div style={{ fontSize:28, fontWeight:900, fontVariantNumeric:"tabular-nums", color:"var(--yellow)" }}>{fmt(totalCC)}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ fontSize:32 }}>💳</span>
            {dueInfo && (
              <div style={{ fontSize:11, fontWeight:700, color: dueInfo.diff <= 3 ? "var(--red)" : dueInfo.diff <= 7 ? "var(--yellow)" : "var(--text2)", marginTop:2 }}>
                {dueInfo.diff <= 0 ? "⚠️ Vence hoje!" : `📅 Vence em ${dueInfo.diff}d (dia ${dueInfo.day})`}
              </div>
            )}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div style={{ background:"rgba(0,214,143,0.08)", border:"1px solid rgba(0,214,143,0.2)", borderRadius:10, padding:"8px 12px" }}>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700 }}>✅ PAGO</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--green)", fontVariantNumeric:"tabular-nums" }}>{fmt(totalPago)}</div>
          </div>
          <div style={{ background:"rgba(255,183,3,0.08)", border:"1px solid rgba(255,183,3,0.2)", borderRadius:10, padding:"8px 12px" }}>
            <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700 }}>⏳ PENDENTE</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--yellow)", fontVariantNumeric:"tabular-nums" }}>{fmt(totalPendente)}</div>
          </div>
        </div>
        {totalCC > 0 && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width:`${Math.min(totalPago/totalCC*100,100)}%`, background:"var(--green)" }}/>
          </div>
        )}
      </div>

      {cc.length===0 && <div className="card" style={{ textAlign:"center", color:"var(--text2)", padding:38 }}>Nenhum gasto no cartão ainda</div>}

      {cc.map((c: CC) => {
        const isParcelado = (c.installments||1) > 1;
        const parcAtual = c.installmentCurrent || 1;
        const parcTotal = c.installments || 1;
        const totalCompra = c.totalAmount ? num(c.totalAmount) : num(c.amount) * parcTotal;
        // parcPagas = parcelas anteriores (já viradas) + se a atual está paga
        const parcPagas = (parcAtual - 1) + (c.paid ? 1 : 0);
        const restantes = parcTotal - parcPagas;

        return (
          <div key={c.id} className="card" style={{ marginBottom:10, padding:"12px 14px", opacity:c.paid&&!isParcelado?0.75:1, borderLeft:`3px solid ${c.paid?"var(--green)":isParcelado?"var(--primary)":"var(--border)"}` }}>
            {editId===c.id ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder="Descrição"
                  style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:13 }}/>
                <input value={editVal} onChange={e=>setEditVal(e.target.value)} placeholder="Valor da parcela (R$)"
                  type="number" step="0.01" style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:13 }}/>
                <input value={editDueDay} onChange={e=>setEditDueDay(e.target.value)} placeholder="Dia de vencimento (ex: 10)"
                  type="number" min="1" max="31" style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"7px 10px", color:"var(--text)", fontSize:13 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>{ onEdit(c.id, editDesc, editVal, editDueDay); setEditId(null); }}
                    className="btn-primary" style={{ flex:1, padding:"8px" }}>✅ Salvar</button>
                  <button onClick={()=>setEditId(null)}
                    style={{ flex:1, padding:"8px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text2)", cursor:"pointer" }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                {/* Linha principal */}
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, textDecoration:c.paid&&!isParcelado?"line-through":"none", color:c.paid&&!isParcelado?"var(--text2)":"var(--text)" }}>
                      {c.description}
                    </div>
                    {c.subcategory && <div style={{ fontSize:11, color:"var(--text2)", marginTop:1 }}>{c.subcategory}</div>}
                    {isParcelado && (
                      <div style={{ fontSize:11, color: c.paid ? "var(--green)" : "var(--primary)", fontWeight:700, marginTop:3 }}>
                        📦 Parcela {parcAtual}/{parcTotal} {c.paid ? "✅" : ""} · Total: {fmt(totalCompra)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontWeight:900, fontSize:16, fontVariantNumeric:"tabular-nums", color:c.paid?"var(--green)":"var(--yellow)" }}>
                      {fmt(num(c.amount))}
                    </div>
                    {isParcelado && <div style={{ fontSize:10, color:"var(--text2)" }}>por mês</div>}
                  </div>
                </div>

                {/* Barra de parcelas */}
                {isParcelado && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text2)", marginBottom:3 }}>
                      <span style={{ color: parcPagas > 0 ? "var(--green)" : "var(--text2)" }}>{parcPagas} {parcPagas===1?"parcela paga":"parcelas pagas"}</span>
                      <span>{restantes} {restantes===1?"restante":"restantes"}</span>
                    </div>
                    <div style={{ display:"flex", gap:2 }}>
                      {Array.from({length:parcTotal}).map((_,i)=>(
                        <div key={i} style={{
                          flex:1, height:5, borderRadius:3,
                          background: i < parcPagas ? "var(--green)" : i === parcAtual-1 ? (c.paid ? "var(--green)" : "var(--primary)") : "var(--bg3)"
                        }}/>
                      ))}
                    </div>
                    {/* Botão avançar parcela — só aparece quando pago */}
                    {c.paid && parcAtual < parcTotal && (
                      <button onClick={()=>onAdvance(c)}
                        style={{ marginTop:8, width:"100%", padding:"7px", background:"rgba(0,214,143,0.08)", border:"1px solid rgba(0,214,143,0.25)", color:"var(--green)", borderRadius:9, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        ➡️ Avançar para Parcela {parcAtual+1}/{parcTotal}
                      </button>
                    )}
                    {c.paid && parcAtual >= parcTotal && (
                      <div style={{ marginTop:8, fontSize:11, color:"var(--green)", fontWeight:700, textAlign:"center" }}>
                        🎉 Última parcela — pode excluir após confirmação
                      </div>
                    )}
                  </div>
                )}

                {/* Ações */}
                <div style={{ display:"flex", gap:7, marginTop:10, justifyContent:"flex-end" }}>
                  <button onClick={()=>onPay(c)} title={c.paid?"Desmarcar":"Marcar pago"}
                    style={{ background:c.paid?"rgba(0,214,143,0.12)":"rgba(0,214,143,0.18)", border:`1px solid ${c.paid?"rgba(0,214,143,0.25)":"rgba(0,214,143,0.45)"}`, color:"var(--green)", borderRadius:8, padding:"5px 10px", fontSize:13, cursor:"pointer" }}>
                    {c.paid ? "↩️ Desmarcar" : "✅ Pagar"}
                  </button>
                  <button onClick={()=>{ setEditId(c.id); setEditVal(String(num(c.amount))); setEditDesc(c.description); setEditDueDay(c.dueDay ? String(c.dueDay) : ""); }}
                    style={{ background:"rgba(108,99,255,0.1)", border:"1px solid rgba(108,99,255,0.25)", color:"#a78bfa", borderRadius:8, padding:"5px 10px", fontSize:13, cursor:"pointer" }}>✏️</button>
                  <button className="btn-danger" onClick={()=>onDelete(c.id)} style={{ padding:"5px 10px" }}>🗑</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ABA RENDA EXTRA ───────────────────────────────────────────────────────────
function IncomeContent({ incomes,totalIncome,extraNeeded,onAdd,onDelete,onEdit }: any) {
  const [editId, setEditId] = useState<number|null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmt, setEditAmt] = useState("");

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
        <div key={inc.id} className="card" style={{ padding:"11px 14px", marginBottom:7 }}>
          {editId===inc.id ? (
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              <input value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder="Descrição"
                style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text)", fontSize:13 }}/>
              <input value={editAmt} onChange={e=>setEditAmt(e.target.value)} placeholder="Valor (R$)" type="number" step="0.01"
                style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 10px", color:"var(--text)", fontSize:13 }}/>
              <div style={{ display:"flex", gap:7 }}>
                <button onClick={()=>{ onEdit(inc.id,editDesc,editAmt); setEditId(null); }} className="btn-primary" style={{ flex:1, padding:"7px", fontSize:12 }}>✅ Salvar</button>
                <button onClick={()=>setEditId(null)} style={{ flex:1, padding:"7px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text2)", cursor:"pointer", fontSize:12 }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{inc.description}</div>
                <div style={{ fontSize:11, color:"var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</div>
              </div>
              <span style={{ fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>+{fmt(num(inc.amount))}</span>
              <button onClick={()=>{ setEditId(inc.id); setEditDesc(inc.description); setEditAmt(String(num(inc.amount))); }}
                style={{ background:"rgba(108,99,255,0.1)", border:"1px solid rgba(108,99,255,0.25)", color:"#a78bfa", borderRadius:7, padding:"5px 9px", fontSize:12, cursor:"pointer" }}>✏️</button>
              <button className="btn-danger" onClick={()=>onDelete(inc.id)}>🗑</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── PIZZA CHART (SVG puro) ────────────────────────────────────────────────────
function PieChart({ data }: { data:{label:string;value:number;color:string;emoji:string}[] }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  if (total <= 0) return (
    <div style={{ textAlign:"center", padding:"28px 0", color:"var(--text2)", fontSize:13 }}>
      Nenhum gasto registrado ainda
    </div>
  );
  const size = 160, cx = 80, cy = 80, r = 68, inner = 40;
  let angle = -Math.PI / 2;
  const slices = data.filter(d=>d.value>0).map(d=>{
    const pct = d.value / total;
    const startAngle = angle;
    angle += pct * Math.PI * 2;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(angle),       y2 = cy + r * Math.sin(angle);
    const xi1= cx + inner * Math.cos(startAngle), yi1= cy + inner * Math.sin(startAngle);
    const xi2= cx + inner * Math.cos(angle),       yi2= cy + inner * Math.sin(angle);
    const large = pct > 0.5 ? 1 : 0;
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    return { ...d, path, pct };
  });
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s,i)=>(
            <path key={i} d={s.path} fill={s.color} stroke="var(--bg2)" strokeWidth="1.5">
              <title>{s.label}: {fmt(s.value)} ({Math.round(s.pct*100)}%)</title>
            </path>
          ))}
          <circle cx={cx} cy={cy} r={inner} fill="var(--bg2)"/>
          <text x={cx} y={cy-6} textAnchor="middle" fontSize="10" fill="var(--text2)" fontFamily="Figtree,sans-serif">Total</text>
          <text x={cx} y={cy+8} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text)" fontFamily="Figtree,sans-serif">{fmt(total).replace("R$\u00a0","R$")}</text>
        </svg>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {slices.map((s,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:11, height:11, borderRadius:3, background:s.color, flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:12 }}>{s.emoji} {s.label}</div>
            <div style={{ fontSize:12, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{fmt(s.value)}</div>
            <div style={{ fontSize:11, color:s.color, fontWeight:700, minWidth:34, textAlign:"right" }}>{Math.round(s.pct*100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GRÁFICO HORIZONTAL DE BARRAS (3 barras: salário azul, renda extra verde, gastos vermelho) ──
function HBarChart({ data }: { data:{label:string;expenses:number;income:number;salary:number;extraIncome:number;month:string}[] }) {
  if (!data.length) return (
    <div style={{ textAlign:"center", padding:"28px 0", color:"var(--text2)", fontSize:13 }}>
      Nenhum mês arquivado ainda.<br/>
      <span style={{ fontSize:11 }}>Use "Virar Mês" em ⚙️ Configurações ao fechar cada mês.</span>
    </div>
  );
  const maxVal = Math.max(...data.flatMap(d=>[d.expenses, d.salary, d.extraIncome]), 1);

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth: Math.max(data.length * 90, 280), padding:"4px 0 0" }}>
        <div style={{ position:"relative", height:160, marginBottom:0 }}>
          {[0,0.25,0.5,0.75,1].map((p,i)=>(
            <div key={i} style={{ position:"absolute", left:0, right:0, bottom:`${p*100}%`, borderTop:`1px dashed ${p===0?"var(--border)":"rgba(255,255,255,0.06)"}`, display:"flex", alignItems:"center" }}>
              {p > 0 && <span style={{ fontSize:9, color:"var(--text2)", paddingRight:4, background:"var(--bg2)", lineHeight:1 }}>{fmt(maxVal*p).replace("R$\u00a0","").replace(",00","")}</span>}
            </div>
          ))}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"flex-end", gap:0, paddingBottom:1 }}>
            {data.map((d,i)=>{
              const expH   = Math.max(d.expenses/maxVal*154,    d.expenses>0?3:0);
              const salH   = Math.max(d.salary/maxVal*154,      d.salary>0?3:0);
              const extH   = Math.max(d.extraIncome/maxVal*154, d.extraIncome>0?3:0);
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:154 }}>
                    <div title={`Salário: ${fmt(d.salary)}`}
                      style={{ width:14, height:salH, background:"#378ADD", borderRadius:"4px 4px 0 0", opacity:0.9, transition:"height .6s ease", flexShrink:0 }}/>
                    <div title={`Renda Extra: ${fmt(d.extraIncome)}`}
                      style={{ width:14, height:extH, background:"var(--green)", borderRadius:"4px 4px 0 0", opacity:0.85, transition:"height .6s ease", flexShrink:0 }}/>
                    <div title={`Despesas: ${fmt(d.expenses)}`}
                      style={{ width:14, height:expH, background:"var(--red)", borderRadius:"4px 4px 0 0", opacity:0.85, transition:"height .6s ease", flexShrink:0 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display:"flex", borderTop:"1px solid var(--border)", paddingTop:6 }}>
          {data.map((d,i)=>(
            <div key={i} style={{ flex:1, textAlign:"center", fontSize:10, color:"var(--text2)", textTransform:"capitalize", lineHeight:1.3 }}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--text2)" }}>
          <div style={{ width:12,height:12,background:"#378ADD",borderRadius:3 }}/> Salário fixo
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--text2)" }}>
          <div style={{ width:12,height:12,background:"var(--green)",borderRadius:3, opacity:0.85 }}/> Renda extra
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--text2)" }}>
          <div style={{ width:12,height:12,background:"var(--red)",borderRadius:3, opacity:0.85 }}/> Despesas
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE ANÁLISE IA ─────────────────────────────────────────────────────
function AiInsightButton({ salary, totalGasto, totalIncome, totalCC, totalInvestido, byCategory, cc, healthScore, levelInfo, xp, userId, userName }: any) {
  const [insights, setInsights] = useState<{type:string;label:string;text:string;sub?:string}[]|null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<string|null>(null);
  const monthLabel = new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const currentMonth = new Date().toISOString().slice(0,7);
  const day = new Date().getDate();
  const windowKey = `${currentMonth}-${day <= 15 ? 'A' : 'B'}`;
  const cacheKey = `mg_ia_${windowKey}`;

  useEffect(()=>{ const id="mg-shimmer-style"; if (!document.getElementById(id)) { const s=document.createElement("style"); s.id=id; s.textContent=`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`; document.head.appendChild(s); } },[]);

  useEffect(()=>{
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) { const { data } = JSON.parse(raw); if (Array.isArray(data)) setInsights(data); }
    } catch {}
  },[cacheKey]);

  const saveCache = (data: any[]) => {
    try { localStorage.setItem(cacheKey, JSON.stringify({ data })); } catch {}
    try { Object.keys(localStorage).filter(k=>k.startsWith("mg_ia_") && k!==cacheKey).forEach(k=>localStorage.removeItem(k)); } catch {}
  };

  const generate = async () => {
    if (loading) return;
    setLoading(true); setBlocked(null);
    try {
      const totalReceita = salary + totalIncome;
      const pctCC = totalReceita > 0 ? Math.round(totalCC / totalReceita * 100) : 0;
      const pctInvest = totalReceita > 0 ? Math.round(totalInvestido / totalReceita * 100) : 0;
      const saldo = totalReceita - totalGasto;
      const metaInvest = levelInfo?.tier === "iniciante" ? 5 : levelInfo?.tier === "investidor" ? 15 : 25;
      const parcelamentos = cc.filter((c:any)=>(c.installments||1)>1);
      const parcStr = parcelamentos.length > 0
        ? parcelamentos.map((c:any)=>`${c.description}: ${c.installmentCurrent||1}/${c.installments}x de ${fmt(num(c.amount))}`).join("; ")
        : "nenhum";

      const prompt = `Você é um consultor financeiro direto e amigável do app NaCarteira. Analise estes dados e gere de 2 a 4 insights financeiros úteis em JSON.\n\nDADOS DO MÊS (${monthLabel}):\n- Salário base: R$ ${salary}\n- Renda extra: R$ ${totalIncome}\n- Receita total: R$ ${totalReceita}\n- Total gasto: R$ ${totalGasto}\n- Cartão: R$ ${totalCC} (${pctCC}% da receita)\n- Investido: R$ ${totalInvestido} (${pctInvest}% — meta do nível: ${metaInvest}%)\n- Saldo: R$ ${saldo}\n- Saúde financeira: ${healthScore}/100\n- Nível: ${levelInfo?.label||"Iniciante"} NV.${levelInfo?.levelNum||1}\n- Parcelamentos: ${parcStr}\n\nRetorne SOMENTE um array JSON válido (sem markdown, sem texto extra):\n[{"type":"tip|alert|info|gold","label":"Título curto","text":"1-2 frases com números reais","sub":"dica curta opcional"}]\n\ntip=positivo/verde, alert=atenção/vermelho, info=informativo/roxo, gold=projeção/dourado.`;

      const res = await fetch(`${API}/ai/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId }),
      });
      const resData = await res.json();
      if (res.status === 429) { setBlocked(resData.error || "Limite atingido"); setLoading(false); return; }
      if (!res.ok) throw new Error(resData.error || "Erro no servidor");

      const clean = (resData.text || "").replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) { setInsights(parsed); saveCache(parsed); }
      else throw new Error("Resposta inválida");
    } catch (e: any) {
      const fallback = [{type:"alert",label:"Erro ao gerar análise",text:`Verifique a ANTHROPIC_API_KEY no servidor. Detalhe: ${e.message}`,sub:""}];
      setInsights(fallback);
    }
    setLoading(false);
  };

  // Gerar PDF do relatório
  const generatePDF = () => {
    if (!insights) return;
    const totalReceita = salary + totalIncome;
    const saldo = totalReceita - totalGasto;
    const healthBand = getHealthBand(healthScore);

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#fff;color:#1a1a2e}
  .page{max-width:800px;margin:0 auto;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6c63ff;padding-bottom:16px;margin-bottom:24px}
  .logo{font-size:24px;font-weight:900;color:#6c63ff}
  .subtitle{font-size:12px;color:#666;margin-top:4px}
  .badge{background:#6c63ff;color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin:20px 0 10px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi{background:#f7f7fb;border-radius:10px;padding:14px;text-align:center}
  .kpi-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
  .kpi-value{font-size:20px;font-weight:900;margin-top:4px}
  .insight{border-radius:10px;padding:14px 16px;margin-bottom:10px;border-left:4px solid}
  .insight-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .insight-text{font-size:13px;line-height:1.6}
  .insight-sub{font-size:11px;color:#666;margin-top:5px;font-style:italic}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center}
  .health-bar{height:8px;border-radius:4px;background:linear-gradient(90deg,#ff4d6a,#fb923c,#facc15,#a3e635,#00d68f);margin-top:6px}
</style></head><body><div class="page">
<div class="header">
  <div><div class="logo">💰 NaCarteira</div><div class="subtitle">Relatório Financeiro Mensal · Confidencial</div></div>
  <div><div style="font-size:13px;font-weight:700">${monthLabel}</div><div style="font-size:11px;color:#888;margin-top:3px">${userName || "Usuário"}</div><div class="badge" style="margin-top:6px;display:inline-block">${levelInfo?.label||"Iniciante"} NV.${levelInfo?.levelNum||1}</div></div>
</div>

<div class="section-title">VISÃO GERAL DO MÊS</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Receita Total</div><div class="kpi-value" style="color:#6c63ff">${fmt(totalReceita)}</div></div>
  <div class="kpi"><div class="kpi-label">Total Gasto</div><div class="kpi-value" style="color:#ff4d6a">${fmt(totalGasto)}</div></div>
  <div class="kpi"><div class="kpi-label">Saldo Livre</div><div class="kpi-value" style="color:${saldo>=0?'#00d68f':'#ff4d6a'}">${fmt(saldo)}</div></div>
  <div class="kpi"><div class="kpi-label">Saúde</div><div class="kpi-value" style="color:${healthBand.color}">${healthScore}/100</div><div style="font-size:11px;color:#888">${healthBand.label}</div></div>
</div>

<div class="section-title">ANÁLISE IA — INSIGHTS DO MÊS</div>
${insights.map(ins=>{
  const colors: Record<string,{bg:string;border:string;label:string}> = {
    alert:{bg:"#fff5f5",border:"#ff4d6a",label:"⚠️ ALERTA"},
    tip:  {bg:"#f0fff8",border:"#00d68f",label:"✅ PONTO FORTE"},
    info: {bg:"#f5f3ff",border:"#6c63ff",label:"💡 INSIGHT"},
    gold: {bg:"#fffbeb",border:"#ffd700",label:"📊 PROJEÇÃO"},
  };
  const s = colors[ins.type] || colors.info;
  return `<div class="insight" style="background:${s.bg};border-left-color:${s.border}">
    <div class="insight-label" style="color:${s.border}">${s.label} · ${ins.label}</div>
    <div class="insight-text">${ins.text}</div>
    ${ins.sub?`<div class="insight-sub">${ins.sub}</div>`:''}
  </div>`;
}).join('')}

<div class="footer">NaCarteira · Relatório gerado automaticamente · ${new Date().toLocaleDateString("pt-BR")} · Dados do período ${monthLabel}</div>
</div></body></html>`;

    const win = window.open('','_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),500); }
  };

  const typeStyle: Record<string,{bg:string;border:string;labelColor:string;barColor:string}> = {
    alert: { bg:"rgba(255,77,106,0.07)",   border:"rgba(255,77,106,0.22)",   labelColor:"#ff4d6a", barColor:"#ff4d6a" },
    tip:   { bg:"rgba(0,214,143,0.06)",    border:"rgba(0,214,143,0.2)",     labelColor:"#00d68f", barColor:"#00d68f" },
    info:  { bg:"rgba(108,99,255,0.07)",   border:"rgba(108,99,255,0.22)",   labelColor:"#a78bfa", barColor:"#6c63ff" },
    gold:  { bg:"rgba(255,215,0,0.06)",    border:"rgba(255,215,0,0.2)",     labelColor:"#ffd700", barColor:"#ffd700" },
  };

  // Info da grade de 15 dias
  const windowLabel = day <= 15 ? `1–15 de ${monthLabel}` : `16–fim de ${monthLabel}`;
  const nextWindowLabel = day <= 15 ? `dia 16` : `dia 1 do próximo mês`;

  return (
    <div style={{ marginBottom:14 }}>
      {blocked && (
        <div style={{ background:"rgba(255,183,3,0.08)", border:"1px solid rgba(255,183,3,0.3)", borderRadius:12, padding:"12px 14px", marginBottom:10, fontSize:12, color:"#ffb703", lineHeight:1.6 }}>
          ⏳ <strong>Limite da grade atingido.</strong> {blocked}<br/>
          <span style={{ fontSize:11, color:"var(--text2)" }}>Próxima análise disponível a partir do {nextWindowLabel}.</span>
        </div>
      )}

      {!insights && !blocked && (
        <button onClick={generate} disabled={loading}
          style={{ width:"100%", background:"linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,214,143,0.06))", border:"1px solid rgba(108,99,255,0.25)", borderRadius:16, padding:"18px 16px", cursor:loading?"default":"pointer", textAlign:"center", opacity:loading?0.8:1 }}>
          <div style={{ fontSize:28, marginBottom:6 }}>{loading ? "⏳" : "🤖"}</div>
          <div style={{ fontSize:15, fontWeight:900, color:"var(--text)", marginBottom:4 }}>
            {loading ? "Analisando seus dados..." : `Análise IA — ${monthLabel}`}
          </div>
          <div style={{ fontSize:12, color:"var(--text2)" }}>
            {loading ? "Isso pode levar alguns segundos" : `Disponível neste período: ${windowLabel}`}
          </div>
          {loading && (
            <div style={{ marginTop:10, height:3, background:"var(--bg3)", borderRadius:2, overflow:"hidden", position:"relative" }}>
              <div style={{ position:"absolute", top:0, left:0, width:"50%", height:"100%", background:"linear-gradient(90deg,transparent,#6c63ff,#00d68f,transparent)", animation:"shimmer 1.5s infinite" }}/>
            </div>
          )}
        </button>
      )}

      {insights && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>🤖 Análise IA — {monthLabel}</div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={generatePDF}
                style={{ fontSize:11, color:"#6c63ff", background:"rgba(108,99,255,0.1)", border:"1px solid rgba(108,99,255,0.25)", borderRadius:7, padding:"3px 9px", cursor:"pointer" }}>
                📄 PDF
              </button>
              <button onClick={()=>{ setInsights(null); try{localStorage.removeItem(cacheKey);}catch{} }}
                style={{ fontSize:11, color:"var(--text2)", background:"none", border:"1px solid var(--border)", borderRadius:7, padding:"3px 9px", cursor:"pointer" }}>
                🔄
              </button>
            </div>
          </div>
          {insights.map((ins,i)=>{
            const s = typeStyle[ins.type] || typeStyle.info;
            return (
              <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:13, padding:"12px 14px", marginBottom:8, borderLeft:`3px solid ${s.barColor}` }}>
                <div style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:1, color:s.labelColor, marginBottom:5 }}>
                  {ins.type==="alert"?"⚠️":ins.type==="tip"?"✅":ins.type==="gold"?"📊":"💡"} {ins.label}
                </div>
                <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.6 }}>{ins.text}</div>
                {ins.sub && <div style={{ fontSize:11, color:"var(--text2)", marginTop:5, fontStyle:"italic" }}>{ins.sub}</div>}
              </div>
            );
          })}
          <div style={{ fontSize:10, color:"var(--text2)", textAlign:"center", marginTop:4 }}>
            Análise do período {windowLabel} · Próxima a partir do {nextWindowLabel}
          </div>
        </div>
      )}
    </div>
  );
}


// ── ABA RELATÓRIOS ────────────────────────────────────────────────────────────
function ReportsContent({ byCategory,totalExpSemSonho,totalCC,totalIncome,expenses,cc,xp,userId,userName,salary,healthScore,totalInvestido,levelInfo: lvInfo }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingH, setLoadingH] = useState(true);

  useEffect(()=>{
    setLoadingH(true);
    fetch(`${API}/users/${userId}/history`).then(r=>r.json()).then(d=>{ setHistory(Array.isArray(d)?d:[]); }).catch(()=>setHistory([])).finally(()=>setLoadingH(false));
  },[userId]);

  const band = getHealthBand(healthScore);
  const monthLabel = new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const levelInfo = lvInfo || getLevelInfo(xp||0);
  const totalRegistros = expenses.length + cc.length;
  const totalProduzido = salary + totalIncome;
  const totalGasto = totalExpSemSonho + totalCC;
  const pieData = byCategory.map((cat:any)=>({ label:cat.name, value:cat.total, color:cat.color, emoji:cat.emoji }));
  const histChartData = history.slice().reverse().map((h:any)=>({
    label: new Date(h.month+"-02").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}).replace(". de "," "),
    expenses: h.totalExpenses || 0,
    income: h.totalIncome || 0,
    salary: h.totalSalary || (h.totalIncome || 0),
    extraIncome: h.totalExtraIncome || 0,
    month: h.month,
  }));

  return (
    <div>
      <h2 style={{ fontSize:17, fontWeight:800, marginBottom:14 }}>📈 Relatórios</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div className="card" style={{ borderTop:"3px solid var(--red)" }}>
          <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Gastos</div>
          <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--red)" }}>{fmt(totalGasto)}</div>
        </div>
        <div className="card" style={{ borderTop:"3px solid var(--green)" }}>
          <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Produzido</div>
          <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:"var(--green)" }}>{fmt(totalProduzido)}</div>
          <div style={{ fontSize:9, color:"var(--text2)", marginTop:2 }}>salário + extras</div>
        </div>
        <div className="card" style={{ borderTop:"3px solid var(--primary)" }}>
          <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Registros</div>
          <div style={{ fontSize:15, fontWeight:800, color:"var(--primary)" }}>{totalRegistros}</div>
          <div style={{ fontSize:9, color:"var(--text2)", marginTop:2 }}>{expenses.length} despesas · {cc.length} cartão</div>
        </div>
        <div className="card" style={{ borderTop:`3px solid ${(totalProduzido-totalGasto)>=0?"var(--green)":"var(--red)"}` }}>
          <div style={{ fontSize:10, color:"var(--text2)", fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>Saldo</div>
          <div style={{ fontSize:15, fontWeight:800, fontVariantNumeric:"tabular-nums", color:(totalProduzido-totalGasto)>=0?"var(--green)":"var(--red)" }}>{fmt(totalProduzido-totalGasto)}</div>
        </div>
      </div>

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
              <div key={i} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:b.c, flexShrink:0, opacity:healthScore>=b.min?1:0.3 }}/>
                <span style={{ fontSize:11, color:healthScore>=b.min?"var(--text)":"var(--text2)", fontWeight:healthScore>=b.min?700:400 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height:8, background:"var(--bg3)", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${healthScore}%`, background:"linear-gradient(90deg,#ff4d6a,#fb923c,#facc15,#a3e635,#00d68f)", transition:"width 1s ease" }}/>
        </div>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>🥧 Gastos por Pote — {monthLabel}</div>
        <PieChart data={pieData}/>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>📅 Histórico de Meses</div>
        {loadingH ? (
          <div style={{ textAlign:"center", color:"var(--text2)", padding:16 }}>Carregando...</div>
        ) : (
          <>
            <HBarChart data={histChartData}/>
            {history.length > 0 && (
              <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:6 }}>
                {history.map((h:any,i:number)=>{
                  const saldo = (h.totalIncome||0) - (h.totalExpenses||0);
                  return (
                    <div key={i} style={{ padding:"9px 12px", background:"var(--bg3)", borderRadius:10, borderLeft:`3px solid ${saldo>=0?"var(--green)":"var(--red)"}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontWeight:700, fontSize:13, textTransform:"capitalize" }}>
                          {new Date(h.month+"-02").toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
                        </span>
                        <span style={{ fontSize:12, fontWeight:800, color:saldo>=0?"var(--green)":"var(--red)", fontVariantNumeric:"tabular-nums" }}>
                          {saldo>=0?"+":""}{fmt(saldo)}
                        </span>
                      </div>
                      <div style={{ display:"flex", gap:14, fontSize:11, color:"var(--text2)", marginTop:3 }}>
                        <span style={{ color:"#378ADD" }}>💼 {fmt(h.totalSalary||0)}</span>
                        <span style={{ color:"var(--green)" }}>💵 {fmt(h.totalExtraIncome||0)}</span>
                        <span style={{ color:"var(--red)" }}>💸 {fmt(h.totalExpenses||0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {history.length===0 && (
              <div style={{ textAlign:"center", color:"var(--text2)", padding:20, fontSize:13, lineHeight:1.6 }}>
                Nenhum mês arquivado ainda.<br/>
                <span style={{ fontSize:11 }}>Use "Virar Mês" em ⚙️ ao fechar cada mês.</span>
              </div>
            )}
          </>
        )}
      </div>

      <AiInsightButton
        salary={salary}
        totalGasto={totalGasto}
        totalIncome={totalIncome}
        totalCC={totalCC}
        totalInvestido={totalInvestido||0}
        byCategory={byCategory}
        cc={cc}
        healthScore={healthScore}
        levelInfo={levelInfo}
        xp={xp||0}
        userId={userId}
        userName={userName}
      />
    </div>
  );
}



// ── MODAIS ────────────────────────────────────────────────────────────────────
function AddExpenseModal({ userId, onClose, onXp }: any) {
  const [form, setForm] = useState({ categoryId:"4", name:"", amount:"", subcategory:"", dueDate:"", recurring:false, recurringMonths:"", recurringGoal:"" });
  const [loading, setLoading] = useState(false);
  const isSonho = parseInt(form.categoryId)===SONHO_ID;

  const submit = async () => {
    if (!form.name.trim()) return;
    const sonhoAutoCalc = isSonho && form.recurring && form.recurringGoal && form.recurringMonths;

    // Calcula amount com segurança — nunca NaN
    let computedAmount: number;
    if (sonhoAutoCalc) {
      const manual = parseFloat(form.amount);
      computedAmount = (!isNaN(manual) && manual > 0)
        ? manual
        : parseFloat(form.recurringGoal) / parseInt(form.recurringMonths);
    } else {
      computedAmount = parseFloat(form.amount);
    }

    if (isNaN(computedAmount) || computedAmount <= 0) return; // guard final

    setLoading(true);
    try {
      const payload: any = {
        categoryId: parseInt(form.categoryId),
        name: form.name.trim(),
        amount: computedAmount,
        subcategory: form.subcategory || null,
        dueDate: form.dueDate || null,
        recurring: form.recurring ? 1 : 0,
        recurringGoal: sonhoAutoCalc ? parseFloat(form.recurringGoal) : null,
        recurringMonths: sonhoAutoCalc ? parseInt(form.recurringMonths) : null,
      };
      const res = await fetch(`${API}/users/${userId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onXp(calcXpExpense(computedAmount));
        onClose();
      } else {
        const err = await res.json();
        alert("Erro: " + (err.error || "tente novamente"));
      }
    } catch(e) {
      alert("Erro de conexão. Verifique sua internet.");
    }
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
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--text2)", cursor:"pointer", userSelect:"none" as any }}>
          <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))} style={{ width:16, height:16, accentColor:"var(--primary)", flexShrink:0 }}/>
          <span>Recorrente 🔄</span>
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
          <button
            className="btn-primary"
            onClick={submit}
            disabled={loading || !form.name.trim() || (
              !(isSonho && form.recurring && form.recurringGoal && form.recurringMonths) &&
              (!form.amount || parseFloat(form.amount) <= 0)
            )}
            style={{ flex:1 }}
          >{loading ? "⏳ Salvando..." : "Adicionar"}</button>
        </div>
      </div>
    </Modal>
  );
}

function AddCCModal({ userId, onClose, onXp }: any) {
  // Modo: "total" (valor total ÷ parcelas) ou "parcela" (valor da parcela × vezes)
  const [mode, setMode] = useState<"total"|"parcela">("parcela");
  const [form, setForm] = useState({ subcategory:"Outros", description:"", amount:"", installments:"1", dueDay:"" });
  const [loading, setLoading] = useState(false);

  const inst = Math.max(1, parseInt(form.installments) || 1);
  const rawAmt = parseFloat(form.amount) || 0;
  // Em modo "parcela": amount = valor da parcela, totalAmount = parcela × inst
  // Em modo "total":   amount = valor total,   parcelAmt = total ÷ inst
  const parcelAmt = mode === "parcela" ? rawAmt : (inst > 1 ? Math.round(rawAmt / inst * 100) / 100 : rawAmt);
  const totalAmt  = mode === "parcela" ? rawAmt * inst : rawAmt;

  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${userId}/credit-card`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          description: form.description,
          subcategory: form.subcategory,
          amount: totalAmt,      // servidor recebe total e divide por inst
          installments: inst,
          dueDay: form.dueDay ? parseInt(form.dueDay) : null,
        })
      });
      if (res.ok) { onXp(calcXpExpense(parcelAmt)); onClose(); }
    } catch {}
    setLoading(false);
  };

  return (
    <Modal title="💳 Gasto no Cartão" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        <select value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))}>
          {CC_CATS.map(c=><option key={c}>{c}</option>)}
        </select>
        <input placeholder="Descrição *" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>

        {/* Toggle de modo */}
        <div style={{ display:"flex", gap:6 }}>
          {(["parcela","total"] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{ flex:1, padding:"8px", borderRadius:9, border:`1.5px solid ${mode===m?"var(--primary)":"var(--border)"}`,
                background:mode===m?"var(--primary)":"var(--bg3)", color:mode===m?"white":"var(--text2)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              {m==="parcela" ? "💳 Valor da parcela" : "🏷️ Valor total"}
            </button>
          ))}
        </div>

        <input type="number" step="0.01"
          placeholder={mode==="parcela" ? "Valor de cada parcela (R$) *" : "Valor total da compra (R$) *"}
          value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>

        {/* Parcelamento — número livre + botões rápidos */}
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:5 }}>NÚMERO DE PARCELAS</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:7 }}>
            {[1,2,3,4,6,10,12].map(n=>(
              <button key={n} onClick={()=>setForm(f=>({...f,installments:String(n)}))}
                style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${inst===n?"var(--primary)":"var(--border)"}`,
                  background:inst===n?"var(--primary)":"var(--bg3)", color:inst===n?"white":"var(--text2)",
                  fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {n===1?"À vista":`${n}x`}
              </button>
            ))}
          </div>
          <input type="number" min="1" max="60" placeholder="Ou digite (ex: 18)"
            value={form.installments} onChange={e=>setForm(f=>({...f,installments:e.target.value}))}
            style={{ fontSize:13 }}/>
        </div>

        {/* Preview */}
        {rawAmt > 0 && (
          <div style={{ background:"rgba(108,99,255,0.08)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:10, padding:"10px 14px" }}>
            {inst > 1 ? (
              <>
                <div style={{ fontSize:18, fontWeight:900, color:"var(--primary)" }}>{inst}x de {fmt(parcelAmt)}</div>
                <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>Total: {fmt(totalAmt)}</div>
              </>
            ) : (
              <div style={{ fontSize:16, fontWeight:800, color:"var(--primary)" }}>À vista: {fmt(rawAmt)}</div>
            )}
            <div style={{ fontSize:11, color:"#00d68f", marginTop:4 }}>⚔️ +{calcXpExpense(parcelAmt)} XP por parcela registrada</div>
          </div>
        )}

        {/* Vencimento */}
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:5 }}>DIA DE VENCIMENTO (opcional)</label>
          <input type="number" placeholder="Ex: 10" min="1" max="31"
            value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:e.target.value}))}/>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={loading||!form.description||!form.amount} style={{ flex:1 }}>
            {loading ? "..." : "Adicionar"}
          </button>
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

function ChangePasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [form, setForm] = useState({ current: "", newPw: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    setError("");
    if (!form.current || !form.newPw || !form.confirm) { setError("Preencha todos os campos"); return; }
    if (form.newPw.length < 6) { setError("Nova senha deve ter pelo menos 6 caracteres"); return; }
    if (form.newPw !== form.confirm) { setError("As senhas não coincidem"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao alterar senha"); }
      else { setSuccess(true); setTimeout(onClose, 1800); }
    } catch { setError("Erro de conexão"); }
    setLoading(false);
  };

  return (
    <Modal title="🔑 Alterar Senha" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {success ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--green)" }}>Senha alterada com sucesso!</div>
          </div>
        ) : (
          <>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:5, letterSpacing:1 }}>SENHA ATUAL</label>
              <input type="password" placeholder="Sua senha atual" value={form.current} onChange={e=>setForm(f=>({...f,current:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:5, letterSpacing:1 }}>NOVA SENHA</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={form.newPw} onChange={e=>setForm(f=>({...f,newPw:e.target.value}))}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:5, letterSpacing:1 }}>CONFIRMAR NOVA SENHA</label>
              <input type="password" placeholder="Repita a nova senha" value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
            {error && <div style={{ fontSize:12, color:"var(--red)", padding:"8px 12px", background:"rgba(255,77,106,0.08)", borderRadius:8 }}>⚠️ {error}</div>}
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button className="btn-ghost" onClick={onClose} style={{ flex:1 }}>Cancelar</button>
              <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex:1 }}>
                {loading ? "Salvando..." : "🔑 Alterar Senha"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function SettingsModal({ user, salary, onSave, onClose, onReset }: any) {
  const [s, setS] = useState(String(salary||""));
  const [loading, setLoading] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const save = async () => {
    if (!s || parseFloat(s) < 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/${user.id}/settings`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({salaryBase:parseFloat(s)})});
      const data = await res.json();
      if (res.ok) { onSave(parseFloat(data.salaryBase ?? s)); }
    } catch { onSave(parseFloat(s)); }
    setLoading(false);
  };

  if (showChangePw) return <ChangePasswordModal user={user} onClose={()=>setShowChangePw(false)}/>;

  return (
    <Modal title="⚙️ Configurações" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={{ fontSize:11, color:"var(--text2)", fontWeight:700, display:"block", marginBottom:6, letterSpacing:1 }}>SALÁRIO BASE (R$)</label>
          <input type="number" value={s} onChange={e=>setS(e.target.value)}/>
        </div>
        <button className="btn-primary" onClick={save} disabled={loading||!s} style={{ width:"100%" }}>{loading?"Salvando...":"Salvar"}</button>
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={()=>setShowChangePw(true)} style={{ width:"100%", background:"rgba(108,99,255,0.08)", color:"var(--primary)", padding:"12px", borderRadius:12, fontSize:13, fontWeight:700, border:"1px solid rgba(108,99,255,0.25)", cursor:"pointer" }}>
            🔑 Alterar Senha
          </button>
          <div style={{ fontSize:12, color:"var(--text2)", marginBottom:2 }}>⚠️ Zona de perigo</div>
          <button onClick={onReset} style={{ width:"100%", background:"rgba(255,77,106,.15)", color:"var(--red)", padding:"12px", borderRadius:12, fontSize:13, fontWeight:700, border:"1px solid rgba(255,77,106,.3)", cursor:"pointer" }}>
            🔄 Virar Mês — Arquivar e limpar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ResetModal({ onClose, onConfirm }: any) {
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true);
    await onConfirm();
    // onConfirm já fecha o modal via setShowReset(false)
    // setLoading(false) pode não executar se o componente desmontar — tudo bem
  };
  return (
    <Modal title="🔄 Virar o Mês" onClose={loading ? undefined : onClose}>
      <p style={{ color:"var(--text2)", fontSize:14, marginBottom:8, lineHeight:1.6 }}>
        Os dados serão <strong style={{ color:"var(--green)" }}>arquivados</strong> e você começa o mês limpo.
      </p>
      <p style={{ color:"var(--text2)", fontSize:13, marginBottom:20, lineHeight:1.5 }}>
        Seu XP e nível <strong style={{ color:"var(--primary)" }}>não são zerados</strong> — apenas despesas, cartão e renda extra.
      </p>
      <div style={{ display:"flex", gap:8 }}>
        <button className="btn-ghost" onClick={onClose} disabled={loading} style={{ flex:1, opacity:loading?0.5:1 }}>Cancelar</button>
        <button onClick={confirm} disabled={loading} style={{ flex:1, background:loading?"var(--bg3)":"var(--primary)", color:loading?"var(--text2)":"white", padding:"12px", borderRadius:12, fontSize:14, fontWeight:700, border:"none", cursor:loading?"default":"pointer" }}>
          {loading ? "⏳ Arquivando..." : "✅ Confirmar"}
        </button>
      </div>
    </Modal>
  );
}

function MethodologyModal({ onClose, xp }: any) {
  const [tab, setTab] = useState<"potes"|"niveis"|"saude">("potes");
  const levelInfo = getLevelInfo(xp || 0);

  const POTES_INICIANTE = [
    { cat:"Pagar-se",  pct:"5%",   color:"#6c63ff", emoji:"💆", desc:"Invista em você mesmo. Um presente, um passeio, um momento de prazer." },
    { cat:"Doar",      pct:"5%",   color:"#ff6b9d", emoji:"💝", desc:"Generosidade quebra a mentalidade de escassez e cria energia de abundância." },
    { cat:"Investir",  pct:"5%",   color:"#00d68f", emoji:"📈", desc:"Construa patrimônio. Mesmo que pequeno, o hábito é o que importa agora." },
    { cat:"Contas",    pct:"70%",  color:"#ffb703", emoji:"📋", desc:"Suas obrigações mensais. Aprenda a viver bem gastando menos." },
    { cat:"Sonho",     pct:"10%",  color:"#8b5cf6", emoji:"✨", desc:"Seu objetivo motivador. Transforma controle financeiro em aventura." },
    { cat:"Abundar",   pct:"5%",   color:"#f97316", emoji:"🌟", desc:"Os luxos da vida. Restaurante melhor, hobby, experiências." },
  ];
  const POTES_INVESTIDOR = [
    { cat:"Pagar-se",  pct:"10%",  color:"#6c63ff", emoji:"💆", desc:"Você já controla os gastos — merece aumentar o que investe em si." },
    { cat:"Doar",      pct:"5%",   color:"#ff6b9d", emoji:"💝", desc:"Generosidade gera abundância. Mantenha o hábito." },
    { cat:"Investir",  pct:"15%",  color:"#00d68f", emoji:"📈", desc:"Prioridade máxima agora. Diversifique: Tesouro, FIIs, ações." },
    { cat:"Contas",    pct:"55%",  color:"#ffb703", emoji:"📋", desc:"Com disciplina, você reduziu Contas para abrir espaço para investimentos." },
    { cat:"Sonho",     pct:"10%",  color:"#8b5cf6", emoji:"✨", desc:"Sonho maior agora — você tem estrutura para realizá-los." },
    { cat:"Abundar",   pct:"5%",   color:"#f97316", emoji:"🌟", desc:"Recompensa merecida. Aproveite sem culpa." },
  ];
  const potes = (levelInfo.tier === "investidor" || levelInfo.tier === "avancado") ? POTES_INVESTIDOR : POTES_INICIANTE;

  const SAUDE_BANDS = [
    { range:"83 a 100", label:"Ótima",       color:"#00d68f", bg:"rgba(0,214,143,0.12)",  desc:"Vida financeira sem estresse. Finanças proporcionam segurança e liberdade." },
    { range:"69 a 82",  label:"Muito Boa",   color:"#4ade80", bg:"rgba(74,222,128,0.1)",  desc:"Domínio do dia a dia, mas precisa dar o salto do patrimônio." },
    { range:"61 a 68",  label:"Boa",         color:"#a3e635", bg:"rgba(163,230,53,0.08)", desc:"Básico bem feito." },
    { range:"57 a 60",  label:"Ok",          color:"#facc15", bg:"rgba(250,204,21,0.08)", desc:"Equilíbrio financeiro no limite — com pouco espaço para erro." },
    { range:"50 a 56",  label:"Baixa",       color:"#fb923c", bg:"rgba(251,146,60,0.08)", desc:"Primeiros sinais de desequilíbrio." },
    { range:"37 a 49",  label:"Muito Baixa", color:"#f97316", bg:"rgba(249,115,22,0.08)", desc:"Risco de atingir uma situação crítica." },
    { range:"0 a 36",   label:"Ruim",        color:"#ff4d6a", bg:"rgba(255,77,106,0.12)", desc:"Círculo de fragilidade, estresse e desorganização financeira." },
  ];

  return (
    <Modal title="📚 Metodologia do App" onClose={onClose}>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {([{id:"potes",label:"🏺 Potes"},{id:"niveis",label:"⚔️ Níveis"},{id:"saude",label:"💚 Saúde"}] as const).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"8px 4px", borderRadius:10, fontWeight:700, fontSize:11, background:tab===t.id?"var(--primary)":"var(--bg3)", color:tab===t.id?"white":"var(--text2)", border:`1.5px solid ${tab===t.id?"var(--primary)":"var(--border)"}` }}>{t.label}</button>
        ))}
      </div>

      {tab==="potes" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* Badge nível atual */}
          <div style={{ background:`${levelInfo.color}18`, border:`1px solid ${levelInfo.color}44`, borderRadius:12, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>⚔️</span>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:levelInfo.color }}>Distribuição atual: {levelInfo.label}</div>
              <div style={{ fontSize:11, color:"var(--text2)" }}>
                {levelInfo.tier==="iniciante" ? "Foco em criar o hábito. Investimento conservador." : "Você tem disciplina — aumente o investimento!"}
              </div>
            </div>
          </div>
          {potes.map((p,i)=>(
            <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", background:"var(--bg3)", borderRadius:12, borderLeft:`3px solid ${p.color}` }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{p.cat}</span>
                  <span style={{ fontSize:12, color:p.color, fontWeight:800, background:`${p.color}18`, padding:"2px 8px", borderRadius:6 }}>{p.pct}</span>
                </div>
                <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="niveis" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {/* XP atual do usuário */}
          <div style={{ background:`${levelInfo.color}12`, border:`1px solid ${levelInfo.color}44`, borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:28 }}>{levelInfo.tier==="avancado"?"👑":levelInfo.tier==="investidor"?"📈":"🌱"}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:13, color:levelInfo.color }}>{levelInfo.label} NV.{levelInfo.levelNum}</div>
              <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>
                {levelInfo.levelNum < MAX_LEVEL
                  ? `${(xp||0).toLocaleString("pt-BR")} XP total · ${XP_PER_LEVEL - levelInfo.xpInLevel} XP para o próximo nível`
                  : "🏆 Nível máximo atingido — você superou o app!"}
              </div>
            </div>
          </div>

          <div style={{ background:"var(--bg3)", borderRadius:12, padding:"10px 12px", fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
            Cada nível exige <strong style={{color:"var(--text)"}}>1.000 XP</strong>. São 100 níveis no total — uma jornada real de transformação financeira.
          </div>

          {[
            { tier:"iniciante"  as const, emoji:"🌱", label:"Iniciante",  range:"NV.1 → NV.49",  xpRange:"1.000 – 49.000 XP", color:"#6c63ff",
              desc:"Fase do hábito. Foco em controlar gastos e criar consistência. Distribuição conservadora: 5% para investimentos. O hábito importa mais que o valor.",
              pcts:"Pagar-se 5% · Doar 5% · Investir 5% · Contas 70% · Sonho 10% · Abundar 5%",
              unlock:"Acesso completo + sistema de streak + perfil de risco no dashboard." },
            { tier:"investidor" as const, emoji:"📈", label:"Investidor", range:"NV.50 → NV.99", xpRange:"50.000 – 99.000 XP", color:"#00d68f",
              desc:"Disciplina comprovada. Sua distribuição muda automaticamente para maximizar patrimônio. Os juros compostos já trabalham por você.",
              pcts:"Pagar-se 10% · Doar 5% · Investir 15% · Contas 55% · Sonho 10% · Abundar 5%",
              unlock:"Nova distribuição de potes + dicas avançadas de investimento." },
            { tier:"avancado"  as const, emoji:"👑", label:"Avançado",   range:"NV.100",        xpRange:"99.000+ XP",          color:"#ffd700",
              desc:"Fim de jogo. Você alcançou o que menos de 1% das pessoas conseguem. 25% do salário investido todo mês. Você superou o app.",
              pcts:"Pagar-se 10% · Doar 10% · Investir 25% · Contas 45% · Sonho 5% · Abundar 5%",
              unlock:"🏆 Título TOP 1% + mensagem épica de conquista." },
          ].map((n,i)=>{
            const isCurrent = n.tier === levelInfo.tier;
            const isPast = (n.tier==="iniciante") || (n.tier==="investidor" && levelInfo.tier!=="iniciante");
            return (
              <div key={i} style={{ background:isCurrent?`${n.color}10`:"var(--bg3)", border:`1.5px solid ${isCurrent?n.color:isPast?"rgba(0,214,143,0.25)":"var(--border)"}`, borderRadius:14, padding:"12px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:24 }}>{n.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:800, fontSize:14, color:n.color }}>{n.label}</span>
                      <span style={{ fontSize:10, color:"var(--text2)", background:"var(--bg2)", padding:"2px 7px", borderRadius:6 }}>{n.range}</span>
                      {isCurrent && <span style={{ fontSize:10, background:n.color, color:"#000", padding:"2px 7px", borderRadius:6, fontWeight:800 }}>VOCÊ ESTÁ AQUI</span>}
                      {!isCurrent && isPast && <span style={{ fontSize:10, color:"var(--green)", fontWeight:700 }}>✅ Superado</span>}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text2)", marginTop:2 }}>{n.xpRange}</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:"var(--text2)", lineHeight:1.5, marginBottom:6 }}>{n.desc}</div>
                <div style={{ fontSize:11, color:n.color, background:`${n.color}10`, padding:"6px 10px", borderRadius:8, marginBottom:6 }}>📊 {n.pcts}</div>
                <div style={{ fontSize:11, color:"var(--text2)", fontStyle:"italic" }}>🔓 {n.unlock}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="saude" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ background:"var(--bg3)", borderRadius:12, padding:"10px 12px", fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
            A Saúde Financeira mede o equilíbrio entre sua receita total (salário + renda extra) e suas despesas (contas + cartão). Investimento não conta como despesa — é patrimônio sendo construído.
          </div>
          <div style={{ background:"rgba(108,99,255,0.07)", border:"1px solid rgba(108,99,255,0.2)", borderRadius:12, padding:"10px 12px", fontSize:12, color:"var(--text2)", lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:"#a78bfa", marginBottom:4 }}>📐 Como é calculada</div>
            <div>Receita = Salário Base + Renda Extra</div>
            <div>Despesas Reais = Contas + Cartão (sem Investir)</div>
            <div>Saldo = Receita − (Despesas Reais + Investimento)</div>
            <div style={{ marginTop:6, color:"var(--text)" }}>Contas pagas e streak diária também contribuem para o score.</div>
          </div>
          {SAUDE_BANDS.map((b,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", background:b.bg, borderRadius:10, border:`1px solid ${b.color}33` }}>
              <div style={{ minWidth:60, fontSize:11, fontWeight:700, color:b.color, flexShrink:0 }}>{b.range}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:b.color }}>{b.label}</div>
                <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
