import React, { useState, useEffect } from "react";
import "./App.css";

interface User {
  id: number;
  name: string;
  email: string;
  xp: number;
  level: string;
  levelNum: number;
  streakDays: number;
}

interface Expense {
  id: number;
  categoryId: number;
  name: string;
  amount: number;
  paid: number;
}

interface CreditCardExpense {
  id: number;
  description: string;
  amount: number;
  subcategory?: string;
}

interface Income {
  id: number;
  description: string;
  amount: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState<"dashboard" | "expenses" | "creditcard" | "income">("dashboard");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCard, setCreditCard] = useState<CreditCardExpense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);

  const [newExpense, setNewExpense] = useState({ categoryId: 1, name: "", amount: "" });
  const [newCreditCard, setNewCreditCard] = useState({ description: "", amount: "", subcategory: "" });
  const [newIncome, setNewIncome] = useState({ description: "", amount: "" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");

  // ── LOAD USER DATA ────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadData(parsedUser.id);
    }
    setLoading(false);
  }, []);

  // ── LOAD DATA ─────────────────────────────────────────────────────────────
  const loadData = async (userId: number) => {
    try {
      const [expRes, ccRes, incRes] = await Promise.all([
        fetch(`/api/users/${userId}/expenses`),
        fetch(`/api/users/${userId}/creditcard`),
        fetch(`/api/users/${userId}/income`),
      ]);

      if (expRes.ok) setExpenses(await expRes.json());
      if (ccRes.ok) setCreditCard(await ccRes.json());
      if (incRes.ok) setIncome(await incRes.json());
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // ── LOGIN / REGISTER ──────────────────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setMessage("Preencha todos os campos");
      return;
    }

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Erro na autenticação");
        return;
      }

      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setEmail("");
      setPassword("");
      setName("");
      setMessage("");
      loadData(data.user.id);
    } catch (error) {
      setMessage("Erro ao conectar com o servidor");
      console.error(error);
    }
  };

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setExpenses([]);
    setCreditCard([]);
    setIncome([]);
    setMessage("");
  };

  // ── ADD EXPENSE ───────────────────────────────────────────────────────────
  const addExpense = async () => {
    if (!newExpense.name || !newExpense.amount) {
      setMessage("Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user?.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: parseInt(newExpense.categoryId.toString()),
          name: newExpense.name,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setNewExpense({ categoryId: 1, name: "", amount: "" });

        // Add XP
        const xpGain = Math.max(1, Math.round(parseFloat(newExpense.amount) * 0.1));
        addXP(xpGain);

        setMessage("✅ Despesa adicionada!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao adicionar despesa");
      console.error(error);
    }
  };

  // ── DELETE EXPENSE ────────────────────────────────────────────────────────
  const deleteExpense = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${user?.id}/expenses/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setMessage("✅ Despesa deletada!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao deletar despesa");
      console.error(error);
    }
  };

  // ── ADD CREDIT CARD ───────────────────────────────────────────────────────
  const addCreditCard = async () => {
    if (!newCreditCard.description || !newCreditCard.amount) {
      setMessage("Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user?.id}/creditcard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newCreditCard.description,
          amount: parseFloat(newCreditCard.amount),
          subcategory: newCreditCard.subcategory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreditCard(data);
        setNewCreditCard({ description: "", amount: "", subcategory: "" });

        // Add XP
        const xpGain = Math.max(1, Math.round(parseFloat(newCreditCard.amount) * 0.1));
        addXP(xpGain);

        setMessage("✅ Cartão atualizado!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao adicionar ao cartão");
      console.error(error);
    }
  };

  // ── DELETE CREDIT CARD ────────────────────────────────────────────────────
  const deleteCreditCard = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${user?.id}/creditcard/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setCreditCard(data);
        setMessage("✅ Item deletado!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao deletar");
      console.error(error);
    }
  };

  // ── ADD INCOME ────────────────────────────────────────────────────────────
  const addIncome = async () => {
    if (!newIncome.description || !newIncome.amount) {
      setMessage("Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user?.id}/income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newIncome.description,
          amount: parseFloat(newIncome.amount),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIncome(data);
        setNewIncome({ description: "", amount: "" });

        // Add XP
        const xpGain = Math.max(1, Math.round(parseFloat(newIncome.amount)));
        addXP(xpGain);

        setMessage("✅ Renda adicionada!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao adicionar renda");
      console.error(error);
    }
  };

  // ── DELETE INCOME ─────────────────────────────────────────────────────────
  const deleteIncome = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${user?.id}/income/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setIncome(data);
        setMessage("✅ Renda deletada!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage("Erro ao deletar renda");
      console.error(error);
    }
  };

  // ── ADD XP ────────────────────────────────────────────────────────────────
  const addXP = async (xpGain: number) => {
    try {
      const res = await fetch(`/api/users/${user?.id}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpGain }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser((prev) => (prev ? { ...prev, xp: data.xp, level: data.level, levelNum: data.levelNum } : null));
      }
    } catch (error) {
      console.error("Error adding XP:", error);
    }
  };

  // ── CLAIM STREAK ──────────────────────────────────────────────────────────
  const claimStreak = async () => {
    try {
      const res = await fetch(`/api/users/${user?.id}/streak/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Erro ao reivindicar streak");
        return;
      }

      setUser((prev) =>
        prev ? { ...prev, streakDays: data.streakDays, xp: data.xp, level: data.level, levelNum: data.levelNum } : null
      );

      setMessage(`🔥 +${data.xpGained} XP! Streak: ${data.streakDays} dias!`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Erro ao reivindicar streak");
      console.error(error);
    }
  };

  // ── CALCULATIONS ──────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCreditCard = creditCard.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const baseSalary = 2300;
  const totalIncome_all = baseSalary + totalIncome;
  const totalExpenses_all = totalExpenses + totalCreditCard;
  const balance = totalIncome_all - totalExpenses_all;

  const xpForNextLevel = (user?.levelNum || 1) * 100;
  const currentXp = user?.xp || 0;
  const xpProgress = (currentXp % 100) / 100;

  // ── RENDER LOGIN ──────────────────────────────────────────────────────────
  if (!user) {
    if (loading) return <div className="login-container"><div className="login-box">Carregando...</div></div>;

    return (
      <div className="login-container">
        <div className="login-box">
          <h1>💰 FinControl</h1>
          <form onSubmit={handleAuth}>
            {isRegister && (
              <input
                type="text"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">{isRegister ? "Registrar" : "Entrar"}</button>
          </form>
          {message && <div className="message">{message}</div>}
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button
              onClick={() => setIsRegister(!isRegister)}
              style={{ background: "transparent", color: "#3b82f6", border: "none", cursor: "pointer" }}
            >
              {isRegister ? "Já tem conta? Entrar" : "Criar nova conta"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER APP ────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {message && <div className="message-banner">{message}</div>}

      <div className="header">
        <h1>💰 FinControl</h1>
        <div className="user-info">
          <span>Olá, {user.name}!</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </div>

      <div className="container">
        <nav className="nav">
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>
            📊 Dashboard
          </button>
          <button className={page === "expenses" ? "active" : ""} onClick={() => setPage("expenses")}>
            💸 Despesas
          </button>
          <button className={page === "creditcard" ? "active" : ""} onClick={() => setPage("creditcard")}>
            💳 Cartão
          </button>
          <button className={page === "income" ? "active" : ""} onClick={() => setPage("income")}>
            💵 Renda
          </button>
        </nav>

        <div className="content">
          {page === "dashboard" && (
            <div className="dashboard">
              <div className="xp-bar">
                <div className="xp-label">
                  <span>
                    {user.level === "avancado" ? "🚀 AVANÇADO" : "🎮 INICIANTE"} - Nível {user.levelNum}
                  </span>
                  <span>{currentXp} XP</span>
                </div>
                <div className="xp-progress">
                  <div className="xp-fill" style={{ width: `${xpProgress * 100}%` }}></div>
                </div>
                <div className="xp-text">
                  {currentXp % 100} / 100 XP para o próximo nível
                </div>
              </div>

              <div className="stats">
                <div className="stat-card salary">
                  <h3>💼 Salário Base</h3>
                  <p>R$ {baseSalary.toFixed(2)}</p>
                </div>

                <div className="stat-card expenses">
                  <h3>💸 Total Despesas</h3>
                  <p>R$ {totalExpenses_all.toFixed(2)}</p>
                </div>

                <div className="stat-card income">
                  <h3>💵 Renda Extra</h3>
                  <p>R$ {totalIncome.toFixed(2)}</p>
                </div>

                <div className={`stat-card balance ${balance >= 0 ? "positive" : "negative"}`}>
                  <h3>💰 Saldo</h3>
                  <p>R$ {balance.toFixed(2)}</p>
                </div>

                <div className="stat-card streak">
                  <h3>🔥 Streak</h3>
                  <p>{user.streakDays} dias</p>
                  <button onClick={claimStreak}>Reivindicar</button>
                </div>
              </div>
            </div>
          )}

          {page === "expenses" && (
            <div>
              <h2>💸 Despesas</h2>
              <div className="form">
                <select
                  value={newExpense.categoryId}
                  onChange={(e) => setNewExpense({ ...newExpense, categoryId: parseInt(e.target.value) })}
                >
                  <option value={1}>Pagar-se</option>
                  <option value={2}>Doar</option>
                  <option value={3}>Investir</option>
                  <option value={4}>Contas</option>
                  <option value={5}>Sonho</option>
                  <option value={6}>Abundar</option>
                </select>
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newExpense.name}
                  onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                />
                <button onClick={addExpense}>Adicionar</button>
              </div>

              <div className="list">
                {expenses.map((exp) => (
                  <div key={exp.id} className="item">
                    <span>
                      {exp.name} - R$ {exp.amount.toFixed(2)}
                    </span>
                    <button onClick={() => deleteExpense(exp.id)}>❌</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "creditcard" && (
            <div>
              <h2>💳 Cartão de Crédito</h2>
              <div className="form">
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newCreditCard.description}
                  onChange={(e) => setNewCreditCard({ ...newCreditCard, description: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newCreditCard.amount}
                  onChange={(e) => setNewCreditCard({ ...newCreditCard, amount: e.target.value })}
                />
                <select
                  value={newCreditCard.subcategory}
                  onChange={(e) => setNewCreditCard({ ...newCreditCard, subcategory: e.target.value })}
                >
                  <option value="">Selecione categoria</option>
                  <option value="Comida">Comida</option>
                  <option value="Roupas">Roupas</option>
                  <option value="Streaming">Streaming</option>
                  <option value="Outros">Outros</option>
                </select>
                <button onClick={addCreditCard}>Adicionar</button>
              </div>

              <div className="list">
                {creditCard.map((cc) => (
                  <div key={cc.id} className="item">
                    <span>
                      {cc.description} ({cc.subcategory || "Sem categoria"}) - R$ {cc.amount.toFixed(2)}
                    </span>
                    <button onClick={() => deleteCreditCard(cc.id)}>❌</button>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "2rem", padding: "1rem", background: "#1e293b", borderRadius: "8px" }}>
                <h3>Total Cartão: R$ {totalCreditCard.toFixed(2)}</h3>
              </div>
            </div>
          )}

          {page === "income" && (
            <div>
              <h2>💵 Renda Extra</h2>
              <div className="form">
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newIncome.description}
                  onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Valor"
                  value={newIncome.amount}
                  onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                />
                <button onClick={addIncome}>Adicionar</button>
              </div>

              <div className="list">
                {income.map((inc) => (
                  <div key={inc.id} className="item">
                    <span>
                      {inc.description} - R$ {inc.amount.toFixed(2)}
                    </span>
                    <button onClick={() => deleteIncome(inc.id)}>❌</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
