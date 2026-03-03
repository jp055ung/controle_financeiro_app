import { useState, useEffect, useCallback } from "react";

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const num = (s: any) => parseFloat(String(s || 0));

type User = { id: number; name: string; email: string; salaryBase?: string; reserveMeta?: string };
type Expense = { id: number; categoryId: number; name: string; amount: string; subcategory?: string; paid: number; dueDate?: string };
type CreditCard = { id: number; description: string; amount: string; subcategory?: string };
type Income = { id: number; description: string; amount: string; date: string };

const CATEGORIES = [
  { id: 1, name: "Pagar-se", emoji: "💆", color: "#6366f1" },
  { id: 2, name: "Doar/Ajudar", emoji: "💝", color: "#ec4899" },
  { id: 3, name: "Investir", emoji: "💰", color: "#10b981" },
  { id: 4, name: "Contas", emoji: "📋", color: "#f59e0b" },
  { id: 5, name: "Objetivo Atual", emoji: "🎯", color: "#8b5cf6" },
  { id: 6, name: "Sonho", emoji: "✨", color: "#06b6d4" },
  { id: 7, name: "Abundar", emoji: "🌟", color: "#f97316" },
  { id: 8, name: "Gastos Variáveis", emoji: "🛒", color: "#ef4444" },
];

const CC_CATS = ["Comida","Roupas","Gasolina","Transporte","Saúde","Streaming","Outros"];

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); return; }
      onLogin(data.user);
    } catch { setError("Erro de conexão"); } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💰</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FinControl</h1>
          <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 14 }}>Controle financeiro inteligente</p>
        </div>
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["login","register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, fontWeight: 600, fontSize: 13,
                  background: mode === m ? "var(--primary)" : "var(--bg3)",
                  color: mode === m ? "white" : "var(--text2)", border: "1px solid var(--border)" }}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "register" && <input placeholder="Seu nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />}
            <input type="email" placeholder="E-mail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input type="password" placeholder="Senha" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && submit()} />
            {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>}
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("fc_user") || "null"); } catch { return null; }
  });
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCard, setCreditCard] = useState<CreditCard[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [salary, setSalary] = useState(2300);
  const [reserve, setReserve] = useState(500);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCC, setShowAddCC] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const login = (u: User) => {
    sessionStorage.setItem("fc_user", JSON.stringify(u));
    setUser(u);
    if (u.salaryBase) setSalary(num(u.salaryBase));
    if (u.reserveMeta) setReserve(num(u.reserveMeta));
  };

  const logout = () => { sessionStorage.removeItem("fc_user"); setUser(null); };

  const load = useCallback(async () => {
    if (!user) return;
    const [e, cc, inc] = await Promise.all([
      fetch(`${API}/users/${user.id}/expenses`).then(r => r.json()),
      fetch(`${API}/users/${user.id}/credit-card`).then(r => r.json()),
      fetch(`${API}/users/${user.id}/extra-income`).then(r => r.json()),
    ]);
    setExpenses(Array.isArray(e) ? e : []);
    setCreditCard(Array.isArray(cc) ? cc : []);
    setIncomes(Array.isArray(inc) ? inc : []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return <Auth onLogin={login} />;

  // Calculations
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalCC = creditCard.reduce((s, c) => s + num(c.amount), 0);
  const totalIncome = incomes.reduce((s, i) => s + num(i.amount), 0);
  const totalPaid = expenses.filter(e => e.paid).reduce((s, e) => s + num(e.amount), 0);
  const totalPending = totalExpenses - totalPaid;
  const totalAll = totalExpenses + totalCC;
  const balance = salary + totalIncome - totalAll;
  const extraNeeded = Math.max(0, totalAll - salary);

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    items: expenses.filter(e => e.categoryId === cat.id),
    total: expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + num(e.amount), 0),
  }));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 12px", position: "fixed", top: 0, bottom: 0 }}>
        <div style={{ padding: "0 8px", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>💰 FinControl</div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Olá, {user.name?.split(" ")[0]}!</div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: "dashboard", icon: "📊", label: "Dashboard" },
            { id: "expenses", icon: "💸", label: "Despesas" },
            { id: "credit", icon: "💳", label: "Cartão" },
            { id: "income", icon: "💵", label: "Renda Extra" },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 500, textAlign: "left",
                background: tab === item.id ? "rgba(99,102,241,0.15)" : "transparent",
                color: tab === item.id ? "var(--primary-light)" : "var(--text2)",
                border: tab === item.id ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent" }}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setShowSettings(true)} className="btn-ghost" style={{ fontSize: 12, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
            ⚙️ Configurações
          </button>
          <button onClick={logout} className="btn-ghost" style={{ fontSize: 12, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", maxWidth: "calc(100vw - 220px)" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Dashboard <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 400 }}>Visão geral do mês</span></h2>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Salário Base", value: fmt(salary), color: "var(--primary)", icon: "💼" },
                { label: "Total Despesas", value: fmt(totalAll), color: "var(--red)", icon: "💸" },
                { label: "Renda Extra", value: fmt(totalIncome), color: "var(--green)", icon: "💵", sub: `${Math.round(totalIncome / Math.max(extraNeeded, 1) * 100)}% da meta` },
                { label: "Saldo Livre", value: fmt(balance), color: balance >= 0 ? "var(--green)" : "var(--red)", icon: balance >= 0 ? "✅" : "⚠️" },
              ].map((k, i) => (
                <div key={i} className="card" style={{ borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{k.icon}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Status pagamento + Renda necessária */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>📊 Status de Pagamento</h3>
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ color: "var(--green)", fontSize: 20, fontWeight: 800 }}>{fmt(totalPaid)}</div>
                    <div style={{ color: "var(--text2)", fontSize: 11, marginTop: 2 }}>Pago</div>
                  </div>
                  <div style={{ flex: 1, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                    <div style={{ color: "var(--yellow)", fontSize: 20, fontWeight: 800 }}>{fmt(totalPending)}</div>
                    <div style={{ color: "var(--text2)", fontSize: 11, marginTop: 2 }}>Pendente</div>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(totalExpenses > 0 ? totalPaid / totalExpenses * 100 : 0, 100)}%`, background: "var(--green)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 6 }}>
                  {totalExpenses > 0 ? Math.round(totalPaid / totalExpenses * 100) : 0}% das despesas pagas
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>🎯 Meta de Renda Extra</h3>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>
                    <span>Necessário: {fmt(extraNeeded)}</span>
                    <span>Ganhou: {fmt(totalIncome)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(extraNeeded > 0 ? totalIncome / extraNeeded * 100 : 100, 100)}%`, background: "linear-gradient(90deg,var(--primary),var(--purple))" }} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", marginTop: 12 }}>
                  {extraNeeded > 0 ? Math.round(totalIncome / extraNeeded * 100) : 100}%
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>da meta alcançada</div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 8, fontSize: 12, color: "var(--text2)" }}>
                  {balance >= 0 ? `✅ Saldo positivo de ${fmt(balance)}` : `⚠️ Faltam ${fmt(Math.abs(balance))} para equilibrar`}
                </div>
              </div>
            </div>

            {/* Categorias resumo */}
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>📂 Distribuição por Categoria</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {byCategory.filter(c => c.total > 0 || c.id <= 4).map(cat => (
                  <div key={cat.id} style={{ padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{cat.emoji}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500 }}>{cat.name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: cat.total > 0 ? "var(--text)" : "var(--text2)", marginTop: 2 }}>{fmt(cat.total)}</div>
                    <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2 }}>{cat.items.length} item(s)</div>
                  </div>
                ))}
              </div>
              {totalCC > 0 && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>💳 Cartão de Crédito</span>
                  <span style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(totalCC)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab === "expenses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>💸 Despesas</h2>
              <button className="btn-primary" onClick={() => setShowAddExpense(true)}>+ Adicionar</button>
            </div>
            {byCategory.map(cat => (
              <div key={cat.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cat.items.length > 0 ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text2)", background: "var(--bg3)", padding: "2px 8px", borderRadius: 20 }}>{cat.items.length}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 700, color: cat.total > 0 ? "var(--text)" : "var(--text2)" }}>{fmt(cat.total)}</span>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>
                      {cat.items.filter(i => i.paid).length}/{cat.items.length} pago(s)
                    </div>
                  </div>
                </div>
                {cat.items.map(exp => (
                  <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg3)", borderRadius: 8, marginBottom: 6, border: "1px solid var(--border)" }}>
                    <input type="checkbox" checked={!!exp.paid} onChange={async () => {
                      await fetch(`${API}/expenses/${exp.id}/paid`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid: !exp.paid }) });
                      load();
                    }} style={{ width: 16, height: 16, accentColor: "var(--primary)", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, textDecoration: exp.paid ? "line-through" : "none", color: exp.paid ? "var(--text2)" : "var(--text)" }}>{exp.name}</div>
                      {exp.subcategory && <div style={{ fontSize: 11, color: "var(--text2)" }}>{exp.subcategory}</div>}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: exp.paid ? "var(--green)" : "var(--yellow)" }}>{fmt(num(exp.amount))}</span>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: exp.paid ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: exp.paid ? "var(--green)" : "var(--yellow)" }}>
                      {exp.paid ? "Pago" : "Pendente"}
                    </span>
                    <button className="btn-danger" onClick={async () => { await fetch(`${API}/expenses/${exp.id}`, { method: "DELETE" }); load(); }}>🗑</button>
                  </div>
                ))}
                {cat.items.length === 0 && <div style={{ fontSize: 12, color: "var(--text2)", padding: "4px 0" }}>Nenhuma despesa nesta categoria</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── CREDIT CARD ── */}
        {tab === "credit" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>💳 Cartão de Crédito</h2>
              <button className="btn-primary" onClick={() => setShowAddCC(true)}>+ Adicionar</button>
            </div>
            <div className="card" style={{ marginBottom: 16, borderTop: "3px solid var(--red)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Total da Fatura</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--red)", marginTop: 4 }}>{fmt(totalCC)}</div>
                </div>
                <div style={{ fontSize: 40 }}>💳</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {creditCard.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Nenhum gasto no cartão ainda</div>}
              {creditCard.map(cc => (
                <div key={cc.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{cc.description}</div>
                    {cc.subcategory && <div style={{ fontSize: 12, color: "var(--text2)" }}>{cc.subcategory}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--red)" }}>{fmt(num(cc.amount))}</span>
                  <button className="btn-danger" onClick={async () => { await fetch(`${API}/credit-card/${cc.id}`, { method: "DELETE" }); load(); }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INCOME ── */}
        {tab === "income" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>💵 Renda Extra</h2>
              <button className="btn-primary" onClick={() => setShowAddIncome(true)}>+ Registrar</button>
            </div>
            <div className="card" style={{ marginBottom: 16, borderTop: "3px solid var(--green)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Ganho</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)", marginTop: 4 }}>{fmt(totalIncome)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>Meta necessária</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--yellow)" }}>{fmt(extraNeeded)}</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${Math.min(extraNeeded > 0 ? totalIncome / extraNeeded * 100 : 100, 100)}%`, background: "linear-gradient(90deg,var(--green),var(--primary))" }} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {incomes.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--text2)", padding: 40 }}>Nenhuma renda extra registrada</div>}
              {incomes.map(inc => (
                <div key={inc.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{inc.description}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>{new Date(inc.date).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--green)" }}>+{fmt(num(inc.amount))}</span>
                  <button className="btn-danger" onClick={async () => { await fetch(`${API}/extra-income/${inc.id}`, { method: "DELETE" }); load(); }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {showAddExpense && <AddExpenseModal userId={user.id} onClose={() => { setShowAddExpense(false); load(); }} />}
      {showAddCC && <AddCCModal userId={user.id} onClose={() => { setShowAddCC(false); load(); }} />}
      {showAddIncome && <AddIncomeModal userId={user.id} onClose={() => { setShowAddIncome(false); load(); }} />}
      {showSettings && <SettingsModal user={user} salary={salary} reserve={reserve} onSave={(s, r) => { setSalary(s); setReserve(r); setShowSettings(false); }} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ─── MODALS ─────────────────────────────────────────────────────────────────
function AddExpenseModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [form, setForm] = useState({ categoryId: 1, name: "", amount: "", subcategory: "" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/expenses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>💸 Adicionar Despesa</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: Number(e.target.value) }))}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <input placeholder="Nome da despesa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input placeholder="Subcategoria (opcional)" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} />
          <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCCModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [form, setForm] = useState({ description: "", amount: "", subcategory: CC_CATS[0] });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/credit-card`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>💳 Gasto no Cartão</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <select value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
            {CC_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddIncomeModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [form, setForm] = useState({ description: "", amount: "" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.description || !form.amount) return;
    setLoading(true);
    await fetch(`${API}/users/${userId}/extra-income`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>💵 Registrar Renda Extra</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Descrição (ex: Freelance, Venda...)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <input type="number" placeholder="Valor (R$)" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Salvando..." : "Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ user, salary, reserve, onSave, onClose }: { user: User; salary: number; reserve: number; onSave: (s: number, r: number) => void; onClose: () => void }) {
  const [s, setS] = useState(String(salary));
  const [r, setR] = useState(String(reserve));
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    await fetch(`${API}/users/${user.id}/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salaryBase: s, reserveMeta: r }),
    });
    onSave(parseFloat(s), parseFloat(r));
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>⚙️ Configurações</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, display: "block", marginBottom: 6 }}>SALÁRIO BASE (R$)</label>
            <input type="number" value={s} onChange={e => setS(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, display: "block", marginBottom: 6 }}>META DE RESERVA (R$)</label>
            <input type="number" value={r} onChange={e => setR(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
