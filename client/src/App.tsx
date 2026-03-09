import { useState, useEffect } from "react";

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

// ── CÁLCULO DE XP (AGORA FUNCIONANDO) ──────────────────────────────────────
const calcXpIncome  = (a: number) => Math.max(1, Math.round(a));           // 1 XP por real
const calcXpExpense = (a: number) => Math.max(1, Math.round(a * 0.1));     // 10% do valor
const XP_PAY_BILL = 15;

// ── SAÚDE FINANCEIRA ──────────────────────────────────────────────────────
function calcHealthScore(salary: number, totalExp: number, totalIncome: number, totalPaid: number, totalAll: number, streakDays: number): number {
  const receita = salary + totalIncome;
  if (receita <= 0) return 0;
  const balanceRatio = Math.max(0, (receita - totalAll) / receita);
  const scoreBalance = Math.min(50, Math.round(balanceRatio * 70));
  const scorePaid = totalAll > 0 ? Math.min(30, Math.round((totalPaid / totalAll) * 30)) : 20;
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

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function getStreakPhrase(d: number) { return d>=30?rnd(STREAK_PHRASES["30+"]):d>=25?rnd(STREAK_PHRASES["25-30"]):d>=14?rnd(STREAK_PHRASES["14-25"]):d>=7?rnd(STREAK_PHRASES["7-14"]):d>=3?rnd(STREAK_PHRASES["3-7"]):rnd(STREAK_PHRASES["1-3"]); }
function getStreakIcon(d: number) { return d>=30?"👑":d>=14?"💎":d>=7?"⚡":"🔥"; }
function getStreakXP(d: number) { const m:Record<number,number>={1:5,2:15,3:25,4:35,5:50,6:65,7:100,14:150,30:300}; return m[d]??65; }

// ── XP BAR (CORRIGIDO) ────────────────────────────────────────────────────
function XPLevel({ xp = 0, level = "iniciante", levelNum = 1 }: { xp?:number; level?:string; levelNum?:number }) {
  const xpSafe = xp || 0;  // Garante que é número
  const cur = xpSafe % 100, pct = Math.round(cur);
  const color = level === "avancado" ? "#ffd700" : "#6c63ff";
  return (
    <div style={{ background:"var(--bg3)", borderRadius:14, padding:"12px 16px", marginBottom:14, border:"1px solid var(--border)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:800, color, letterSpacing:1 }}>⚔️ {level==="avancado"?"AVANÇADO":"INICIANTE"} NV.{levelNum}</span>
        <span style={{ fontSize:11, color:"var(--text2)", fontVariantNumeric:"tabular-nums" }}>{cur}/100 XP · {pct}%</span>
      </div>
      <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width:`${pct}%` }}/></div>
      <div style={{ fontSize:10, color:"var(--text2)", marginTop:4 }}>Total: {xpSafe} XP acumulado</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<"login" | "register" | "dashboard">("login");
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCard, setCreditCard] = useState<CC[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── LOAD USER ON MOUNT ────────────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setPage("dashboard");
        loadData(u.id);
      } catch (e) {
        console.error("Erro ao carregar usuário salvo:", e);
      }
    }
  }, []);

  // ── LOAD DATA ─────────────────────────────────────────────────────────────
  async function loadData(userId: number) {
    try {
      const [expRes, ccRes, incRes] = await Promise.all([
        fetch(`${API}/users/${userId}/expenses`),
        fetch(`${API}/users/${userId}/creditcard`),
        fetch(`${API}/users/${userId}/income`)
      ]);

      if (!expRes.ok || !ccRes.ok || !incRes.ok) {
        throw new Error("Erro ao carregar dados");
      }

      const expData = await expRes.json();
      const ccData = await ccRes.json();
      const incData = await incRes.json();

      setExpenses(Array.isArray(expData) ? expData : []);
      setCreditCard(Array.isArray(ccData) ? ccData : []);
      setIncomes(Array.isArray(incData) ? incData : []);
    } catch (e: any) {
      console.error("Erro ao carregar dados:", e);
      setError("Erro ao carregar dados");
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao fazer login");
      }

      const data = await res.json();
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setPage("dashboard");
      loadData(data.user.id);
      setSuccess("Login realizado com sucesso!");
    } catch (e: any) {
      setError(e.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao registrar");
      }

      const data = await res.json();
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setPage("dashboard");
      loadData(data.user.id);
      setSuccess("Conta criada com sucesso!");
    } catch (e: any) {
      setError(e.message || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  }

  // ── ADD EXPENSE (COM XP) ──────────────────────────────────────────────────
  async function addExpense(categoryId: number, name: string, amount: string) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, name, amount: parseFloat(amount) })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao adicionar despesa");
      }

      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);

      // ✅ NOVO: Calcular e adicionar XP
      const xpGain = calcXpExpense(parseFloat(amount));
      const xpRes = await fetch(`${API}/users/${user.id}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpGain })
      });

      if (xpRes.ok) {
        const xpData = await xpRes.json();
        setUser(prev => prev ? { ...prev, xp: xpData.xp, levelNum: xpData.levelNum, level: xpData.level } : null);
        setSuccess(`Despesa adicionada! +${xpData.xpGained} XP 🎉`);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao adicionar despesa");
    }
  }

  // ── DELETE EXPENSE ────────────────────────────────────────────────────────
  async function deleteExpense(expenseId: number) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/expenses/${expenseId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Erro ao deletar despesa");
      }

      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
      setSuccess("Despesa deletada!");
    } catch (e: any) {
      setError(e.message || "Erro ao deletar despesa");
    }
  }

  // ── TOGGLE EXPENSE ────────────────────────────────────────────────────────
  async function toggleExpense(expenseId: number) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/expenses/${expenseId}/toggle`, {
        method: "PUT"
      });

      if (!res.ok) {
        throw new Error("Erro ao atualizar despesa");
      }

      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar despesa");
    }
  }

  // ── ADD CREDIT CARD ───────────────────────────────────────────────────────
  async function addCreditCard(description: string, amount: string, subcategory?: string) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/creditcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount: parseFloat(amount), subcategory })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao adicionar ao cartão");
      }

      const data = await res.json();
      setCreditCard(Array.isArray(data) ? data : []);

      // ✅ NOVO: Calcular e adicionar XP
      const xpGain = calcXpExpense(parseFloat(amount));
      const xpRes = await fetch(`${API}/users/${user.id}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpGain })
      });

      if (xpRes.ok) {
        const xpData = await xpRes.json();
        setUser(prev => prev ? { ...prev, xp: xpData.xp, levelNum: xpData.levelNum, level: xpData.level } : null);
        setSuccess(`Gasto no cartão adicionado! +${xpData.xpGained} XP 💳`);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao adicionar ao cartão");
    }
  }

  // ── DELETE CREDIT CARD ────────────────────────────────────────────────────
  async function deleteCreditCard(ccId: number) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/creditcard/${ccId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Erro ao deletar");
      }

      const data = await res.json();
      setCreditCard(Array.isArray(data) ? data : []);
      setSuccess("Gasto deletado!");
    } catch (e: any) {
      setError(e.message || "Erro ao deletar");
    }
  }

  // ── ADD INCOME ────────────────────────────────────────────────────────────
  async function addIncome(description: string, amount: string) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount: parseFloat(amount) })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao adicionar renda");
      }

      const data = await res.json();
      setIncomes(Array.isArray(data) ? data : []);

      // ✅ NOVO: Calcular e adicionar XP (1 XP por real)
      const xpGain = calcXpIncome(parseFloat(amount));
      const xpRes = await fetch(`${API}/users/${user.id}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpGain })
      });

      if (xpRes.ok) {
        const xpData = await xpRes.json();
        setUser(prev => prev ? { ...prev, xp: xpData.xp, levelNum: xpData.levelNum, level: xpData.level } : null);
        setSuccess(`Renda extra adicionada! +${xpData.xpGained} XP 💰`);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao adicionar renda");
    }
  }

  // ── DELETE INCOME ─────────────────────────────────────────────────────────
  async function deleteIncome(incomeId: number) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/income/${incomeId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Erro ao deletar");
      }

      const data = await res.json();
      setIncomes(Array.isArray(data) ? data : []);
      setSuccess("Renda deletada!");
    } catch (e: any) {
      setError(e.message || "Erro ao deletar");
    }
  }

  // ── CLAIM STREAK (NOVO!) ──────────────────────────────────────────────────
  async function claimStreak() {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API}/users/${user.id}/streak/checkin`, {
        method: "POST"
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erro ao reivindicar streak");
      }

      const data = await res.json();
      setUser(prev => prev ? {
        ...prev,
        xp: data.xp,
        levelNum: data.levelNum,
        level: data.level,
        streakDays: data.streakDays,
        lastCheckin: new Date().toISOString()
      } : null);

      setSuccess(`🔥 Streak de ${data.streakDays} dias! +${data.xpGained} XP`);
    } catch (e: any) {
      setError(e.message || "Erro ao reivindicar streak");
    }
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  function logout() {
    setUser(null);
    setExpenses([]);
    setCreditCard([]);
    setIncomes([]);
    localStorage.removeItem("user");
    setPage("login");
  }

  // ── RENDER LOGIN ──────────────────────────────────────────────────────────
  if (page === "login") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg1)" }}>
        <div style={{ width: "100%", maxWidth: 400, padding: 20 }}>
          <h1 style={{ textAlign: "center", marginBottom: 30, color: "var(--text1)" }}>MoneyGame</h1>
          {error && <div style={{ background: "rgba(255,77,106,0.1)", color: "#ff4d6a", padding: 10, borderRadius: 8, marginBottom: 15 }}>{error}</div>}
          {success && <div style={{ background: "rgba(0,214,143,0.1)", color: "#00d68f", padding: 10, borderRadius: 8, marginBottom: 15 }}>{success}</div>}
          <form onSubmit={handleLogin}>
            <input type="email" name="email" placeholder="Email" required style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }} />
            <input type="password" name="password" placeholder="Senha" required style={{ width: "100%", padding: 10, marginBottom: 20, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }} />
            <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#6c63ff", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 15, color: "var(--text2)" }}>
            Não tem conta? <a href="#" onClick={() => setPage("register")} style={{ color: "#6c63ff", cursor: "pointer" }}>Registre-se</a>
          </p>
        </div>
      </div>
    );
  }

  if (page === "register") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg1)" }}>
        <div style={{ width: "100%", maxWidth: 400, padding: 20 }}>
          <h1 style={{ textAlign: "center", marginBottom: 30, color: "var(--text1)" }}>Criar Conta</h1>
          {error && <div style={{ background: "rgba(255,77,106,0.1)", color: "#ff4d6a", padding: 10, borderRadius: 8, marginBottom: 15 }}>{error}</div>}
          <form onSubmit={handleRegister}>
            <input type="text" name="name" placeholder="Nome" required style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }} />
            <input type="email" name="email" placeholder="Email" required style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }} />
            <input type="password" name="password" placeholder="Senha (mín. 6 caracteres)" required style={{ width: "100%", padding: 10, marginBottom: 20, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text1)" }} />
            <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#6c63ff", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>
              {loading ? "Criando..." : "Criar Conta"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 15, color: "var(--text2)" }}>
            Já tem conta? <a href="#" onClick={() => setPage("login")} style={{ color: "#6c63ff", cursor: "pointer" }}>Entrar</a>
          </p>
        </div>
      </div>
    );
  }

  // ── RENDER DASHBOARD ──────────────────────────────────────────────────────
  if (!user) return null;

  const totalExp = num(expenses.reduce((a, e) => a + num(e.amount), 0));
  const totalCC = num(creditCard.reduce((a, c) => a + num(c.amount), 0));
  const totalIncome = num(incomes.reduce((a, i) => a + num(i.amount), 0));
  const totalPaid = num(expenses.filter(e => e.paid).reduce((a, e) => a + num(e.amount), 0));
  const totalAll = totalExp + totalCC;
  const salary = num(user.salaryBase);
  const saldoLivre = salary + totalIncome - totalAll;
  const health = calcHealthScore(salary, totalExp, totalIncome, totalPaid, totalAll, user.streakDays || 0);
  const healthBand = getHealthBand(health);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg1)", color: "var(--text1)", fontFamily: "'Figtree', sans-serif" }}>
      {/* HEADER */}
      <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: "bold" }}>💰 MoneyGame</h1>
          <p style={{ margin: "5px 0 0 0", fontSize: 12, color: "var(--text2)" }}>Olá, {user.name}!</p>
        </div>
        <button onClick={logout} style={{ padding: "8px 16px", borderRadius: 8, background: "#ff4d6a", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>
          Sair
        </button>
      </div>

      {/* ALERTS */}
      {error && <div style={{ background: "rgba(255,77,106,0.1)", color: "#ff4d6a", padding: 15, margin: 15, borderRadius: 8 }}>{error}</div>}
      {success && <div style={{ background: "rgba(0,214,143,0.1)", color: "#00d68f", padding: 15, margin: 15, borderRadius: 8 }}>{success}</div>}

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        {/* XP BAR */}
        <XPLevel xp={user.xp} level={user.level} levelNum={user.levelNum} />

        {/* STREAK */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>STREAK DIÁRIA</p>
            <p style={{ margin: "5px 0 0 0", fontSize: 20, fontWeight: "bold" }}>{getStreakIcon(user.streakDays || 0)} {user.streakDays || 0} dias</p>
            <p style={{ margin: "5px 0 0 0", fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>{getStreakPhrase(user.streakDays || 0)}</p>
          </div>
          <button onClick={claimStreak} style={{ padding: "10px 20px", borderRadius: 8, background: "#ff6b9d", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            Reivindicar +{getStreakXP(user.streakDays || 0)} XP
          </button>
        </div>

        {/* CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 15, marginBottom: 20 }}>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>SALÁRIO BASE</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 24, fontWeight: "bold", color: "#00d68f" }}>{fmt(salary)}</p>
          </div>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>TOTAL DESPESAS</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 24, fontWeight: "bold", color: "#ff6b9d" }}>{fmt(totalAll)}</p>
          </div>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>RENDA EXTRA</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 24, fontWeight: "bold", color: "#ffd700" }}>{fmt(totalIncome)}</p>
          </div>
          <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", borderColor: saldoLivre >= 0 ? "#00d68f" : "#ff4d6a" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>SALDO LIVRE</p>
            <p style={{ margin: "10px 0 0 0", fontSize: 24, fontWeight: "bold", color: saldoLivre >= 0 ? "#00d68f" : "#ff4d6a" }}>{fmt(saldoLivre)}</p>
          </div>
        </div>

        {/* HEALTH SCORE */}
        <div style={{ background: healthBand.bg, borderRadius: 14, padding: 16, marginBottom: 20, border: `2px solid ${healthBand.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 32 }}>💪</div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>SAÚDE FINANCEIRA</p>
              <p style={{ margin: "5px 0 0 0", fontSize: 20, fontWeight: "bold", color: healthBand.color }}>{healthBand.label} ({health}/100)</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>{healthBand.desc}</p>
        </div>

        {/* EXPENSES SECTION */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: "bold" }}>📋 Despesas</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 15 }}>
            {CATS.map(cat => (
              <div key={cat.id} style={{ background: "var(--bg1)", borderRadius: 8, padding: 10, cursor: "pointer", border: "1px solid var(--border)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text2)" }}>{cat.emoji} {cat.name}</p>
                <p style={{ margin: "5px 0 0 0", fontSize: 14, fontWeight: "bold", color: cat.color }}>
                  {fmt(expenses.filter(e => e.categoryId === cat.id).reduce((a, e) => a + num(e.amount), 0))}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addExpense(parseInt(fd.get("cat") as string), fd.get("name") as string, fd.get("amount") as string); (e.currentTarget as HTMLFormElement).reset(); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
            <select name="cat" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }}>
              {CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="text" name="name" placeholder="Descrição" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <input type="number" name="amount" placeholder="Valor" step="0.01" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, background: "#6c63ff", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>+</button>
          </form>
          <div style={{ marginTop: 15, maxHeight: 300, overflowY: "auto" }}>
            {expenses.map(exp => (
              <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => toggleExpense(exp.id)}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>{exp.name}</p>
                  <p style={{ margin: "3px 0 0 0", fontSize: 11, color: "var(--text2)" }}>{CATS.find(c => c.id === exp.categoryId)?.name}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: exp.paid ? "#00d68f" : "#ff6b9d" }}>{fmt(num(exp.amount))}</span>
                  <input type="checkbox" checked={exp.paid === 1} readOnly style={{ cursor: "pointer" }} />
                  <button onClick={(e) => { e.stopPropagation(); deleteExpense(exp.id); }} style={{ padding: "4px 8px", borderRadius: 4, background: "#ff4d6a", color: "white", border: "none", cursor: "pointer", fontSize: 11 }}>Deletar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CREDIT CARD SECTION */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: "bold" }}>💳 Cartão de Crédito</h2>
          <p style={{ margin: "0 0 15px 0", fontSize: 14, fontWeight: "bold", color: "#ff6b9d" }}>Total: {fmt(totalCC)}</p>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addCreditCard(fd.get("desc") as string, fd.get("amount") as string, fd.get("subcat") as string); (e.currentTarget as HTMLFormElement).reset(); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, marginBottom: 15 }}>
            <input type="text" name="desc" placeholder="Descrição" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <select name="subcat" style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }}>
              <option value="">Categoria</option>
              {CC_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" name="amount" placeholder="Valor" step="0.01" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, background: "#ff6b9d", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>+</button>
          </form>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {creditCard.map(cc => (
              <div key={cc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>{cc.description}</p>
                  <p style={{ margin: "3px 0 0 0", fontSize: 11, color: "var(--text2)" }}>{cc.subcategory || "Sem categoria"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: "bold" }}>{fmt(num(cc.amount))}</span>
                  <button onClick={() => deleteCreditCard(cc.id)} style={{ padding: "4px 8px", borderRadius: 4, background: "#ff4d6a", color: "white", border: "none", cursor: "pointer", fontSize: 11 }}>Deletar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* EXTRA INCOME SECTION */}
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: 16, fontWeight: "bold" }}>💰 Renda Extra</h2>
          <p style={{ margin: "0 0 15px 0", fontSize: 14, fontWeight: "bold", color: "#ffd700" }}>Total: {fmt(totalIncome)}</p>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addIncome(fd.get("desc") as string, fd.get("amount") as string); (e.currentTarget as HTMLFormElement).reset(); }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 15 }}>
            <input type="text" name="desc" placeholder="Descrição (ex: Uber)" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <input type="number" name="amount" placeholder="Valor" step="0.01" required style={{ padding: 8, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg1)", color: "var(--text1)" }} />
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, background: "#ffd700", color: "#000", border: "none", cursor: "pointer", fontWeight: "bold" }}>+</button>
          </form>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {incomes.map(inc => (
              <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: "bold" }}>{inc.description}</p>
                  <p style={{ margin: "3px 0 0 0", fontSize: 11, color: "var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: "bold", color: "#ffd700" }}>+{fmt(num(inc.amount))}</span>
                  <button onClick={() => deleteIncome(inc.id)} style={{ padding: "4px 8px", borderRadius: 4, background: "#ff4d6a", color: "white", border: "none", cursor: "pointer", fontSize: 11 }}>Deletar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
