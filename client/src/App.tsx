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
  createdAt: string;
}

interface CreditCardExpense {
  id: number;
  description: string;
  amount: number;
  subcategory: string;
  createdAt: string;
}

interface ExtraIncome {
  id: number;
  description: string;
  amount: number;
  date: string;
}

const CATEGORIES = [
  { id: 1, name: "Pagar-se", emoji: "💅" },
  { id: 2, name: "Doar/Ajudar", emoji: "🤝" },
  { id: 3, name: "Investir", emoji: "📈" },
  { id: 4, name: "Contas", emoji: "📋" },
  { id: 5, name: "Objetivo Atual", emoji: "🎯" },
  { id: 6, name: "Sonho", emoji: "🏠" },
  { id: 7, name: "Abundar", emoji: "✨" },
];

const SUBCATEGORIES = [
  "Comida",
  "Roupas",
  "Gasolina",
  "Transporte",
  "Saúde",
  "Streaming",
  "Outros",
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCard, setCreditCard] = useState<CreditCardExpense[]>([]);
  const [income, setIncome] = useState<ExtraIncome[]>([]);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [message, setMessage] = useState("");
  const [newExpense, setNewExpense] = useState({
    categoryId: 1,
    name: "",
    amount: "",
  });
  const [newCreditCard, setNewCreditCard] = useState({
    description: "",
    amount: "",
    subcategory: "Outros",
  });
  const [newIncome, setNewIncome] = useState({ description: "", amount: "" });

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
        setMessage("✅ Login realizado com sucesso!");
        loadData(data.user.id);
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (error) {
      setMessage("❌ Erro ao fazer login");
    }
  };

  // ── LOAD DATA ──────────────────────────────────────────────────────────
  const loadData = async (userId: number) => {
    try {
      const [expRes, ccRes, incRes] = await Promise.all([
        fetch(`/api/users/${userId}/expenses`),
        fetch(`/api/users/${userId}/creditcard`),
        fetch(`/api/users/${userId}/income`),
      ]);

      const [expData, ccData, incData] = await Promise.all([
        expRes.json(),
        ccRes.json(),
        incRes.json(),
      ]);

      setExpenses(expData);
      setCreditCard(ccData);
      setIncome(incData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  // ── ADD EXPENSE ────────────────────────────────────────────────────────
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newExpense.name || !newExpense.amount) {
      setMessage("❌ Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: newExpense.categoryId,
          name: newExpense.name,
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setNewExpense({ categoryId: 1, name: "", amount: "" });
        setMessage("✅ Despesa adicionada!");
        addXP(user.id, 10);
      } else {
        setMessage("❌ Erro ao adicionar despesa");
      }
    } catch (error) {
      setMessage("❌ Erro ao adicionar despesa");
    }
  };

  // ── ADD CREDIT CARD ────────────────────────────────────────────────────
  const handleAddCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCreditCard.description || !newCreditCard.amount) {
      setMessage("❌ Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}/creditcard`, {
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
        setNewCreditCard({ description: "", amount: "", subcategory: "Outros" });
        setMessage("✅ Adicionado ao cartão!");
        addXP(user.id, 10);
      } else {
        setMessage("❌ Erro ao adicionar ao cartão");
      }
    } catch (error) {
      setMessage("❌ Erro ao adicionar ao cartão");
    }
  };

  // ── ADD INCOME ─────────────────────────────────────────────────────────
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newIncome.description || !newIncome.amount) {
      setMessage("❌ Preencha todos os campos");
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}/income`, {
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
        setMessage("✅ Renda adicionada!");
        addXP(user.id, Math.round(parseFloat(newIncome.amount)));
      } else {
        setMessage("❌ Erro ao adicionar renda");
      }
    } catch (error) {
      setMessage("❌ Erro ao adicionar renda");
    }
  };

  // ── DELETE EXPENSE ─────────────────────────────────────────────────────
  const handleDeleteExpense = async (expenseId: number) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
        setMessage("✅ Despesa deletada!");
      }
    } catch (error) {
      setMessage("❌ Erro ao deletar despesa");
    }
  };

  // ── DELETE CREDIT CARD ─────────────────────────────────────────────────
  const handleDeleteCreditCard = async (ccId: number) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/creditcard/${ccId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setCreditCard(data);
        setMessage("✅ Deletado do cartão!");
      }
    } catch (error) {
      setMessage("❌ Erro ao deletar");
    }
  };

  // ── DELETE INCOME ──────────────────────────────────────────────────────
  const handleDeleteIncome = async (incomeId: number) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/income/${incomeId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setIncome(data);
        setMessage("✅ Renda deletada!");
      }
    } catch (error) {
      setMessage("❌ Erro ao deletar");
    }
  };

  // ── ADD XP ─────────────────────────────────────────────────────────────
  const addXP = async (userId: number, xpGain: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpGain }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser((prev) =>
          prev
            ? {
                ...prev,
                xp: data.xp,
                level: data.level,
                levelNum: data.levelNum,
              }
            : null
        );
      }
    } catch (error) {
      console.error("Erro ao adicionar XP:", error);
    }
  };

  // ── CLAIM STREAK ───────────────────────────────────────────────────────
  const handleClaimStreak = async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/users/${user.id}/streak/checkin`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                streakDays: data.streakDays,
                xp: data.xp,
                level: data.level,
                levelNum: data.levelNum,
              }
            : null
        );
        setMessage(`✅ Streak reivindicado! +${data.xpGained} XP`);
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (error) {
      setMessage("❌ Erro ao reivindicar streak");
    }
  };

  // ── LOGOUT ─────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
    setExpenses([]);
    setCreditCard([]);
    setIncome([]);
    setMessage("✅ Logout realizado");
  };

  // ── LOAD USER FROM STORAGE ────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUser(user);
      loadData(user.id);
    }
  }, []);

  // ── CLEAR MESSAGE ──────────────────────────────────────────────────────
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ── RENDER ─────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🎮 FinControl</h1>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Senha"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
            <button type="submit">Entrar</button>
          </form>
          {message && <p className="message">{message}</p>}
        </div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCreditCard = creditCard.reduce((sum, c) => sum + c.amount, 0);
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const salaryBase = 2300;
  const balance = salaryBase + totalIncome - totalExpenses - totalCreditCard;
  const xpProgress = (user.xp % 100) / 100;

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 FinControl</h1>
        <div className="user-info">
          <span>{user.name}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>

      {message && <div className="message-banner">{message}</div>}

      <div className="container">
        <nav className="nav">
          <button
            className={currentTab === "dashboard" ? "active" : ""}
            onClick={() => setCurrentTab("dashboard")}
          >
            📊 Dashboard
          </button>
          <button
            className={currentTab === "expenses" ? "active" : ""}
            onClick={() => setCurrentTab("expenses")}
          >
            📋 Despesas
          </button>
          <button
            className={currentTab === "creditcard" ? "active" : ""}
            onClick={() => setCurrentTab("creditcard")}
          >
            💳 Cartão
          </button>
          <button
            className={currentTab === "income" ? "active" : ""}
            onClick={() => setCurrentTab("income")}
          >
            💰 Renda
          </button>
        </nav>

        <main className="content">
          {/* ── DASHBOARD ─────────────────────────────────────────────── */}
          {currentTab === "dashboard" && (
            <div className="dashboard">
              <div className="xp-bar">
                <div className="xp-label">
                  <span>{user.level.toUpperCase()}</span>
                  <span>Nível {user.levelNum}</span>
                </div>
                <div className="xp-progress">
                  <div
                    className="xp-fill"
                    style={{ width: `${xpProgress * 100}%` }}
                  ></div>
                </div>
                <div className="xp-text">
                  {user.xp} XP ({user.xp % 100}/100)
                </div>
              </div>

              <div className="stats">
                <div className="stat-card salary">
                  <h3>💵 Salário Base</h3>
                  <p>R$ {salaryBase.toFixed(2)}</p>
                </div>
                <div className="stat-card expenses">
                  <h3>📊 Despesas</h3>
                  <p>R$ {totalExpenses.toFixed(2)}</p>
                </div>
                <div className="stat-card creditcard">
                  <h3>💳 Cartão</h3>
                  <p>R$ {totalCreditCard.toFixed(2)}</p>
                </div>
                <div className="stat-card income">
                  <h3>💰 Renda Extra</h3>
                  <p>R$ {totalIncome.toFixed(2)}</p>
                </div>
                <div className={`stat-card balance ${balance >= 0 ? "positive" : "negative"}`}>
                  <h3>💎 Saldo</h3>
                  <p>R$ {balance.toFixed(2)}</p>
                </div>
                <div className="stat-card streak">
                  <h3>🔥 Streak</h3>
                  <p>{user.streakDays} dias</p>
                  <button onClick={handleClaimStreak}>Reivindicar</button>
                </div>
              </div>
            </div>
          )}

          {/* ── EXPENSES ───────────────────────────────────────────────── */}
          {currentTab === "expenses" && (
            <div className="expenses">
              <form onSubmit={handleAddExpense} className="form">
                <select
                  value={newExpense.categoryId}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      categoryId: parseInt(e.target.value),
                    })
                  }
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newExpense.name}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, name: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Valor"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, amount: e.target.value })
                  }
                />
                <button type="submit">Adicionar</button>
              </form>

              <div className="list">
                {expenses.map((exp) => (
                  <div key={exp.id} className="item">
                    <span>
                      {CATEGORIES.find((c) => c.id === exp.categoryId)?.emoji}{" "}
                      {exp.name} - R$ {exp.amount.toFixed(2)}
                    </span>
                    <button onClick={() => handleDeleteExpense(exp.id)}>
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CREDIT CARD ────────────────────────────────────────────── */}
          {currentTab === "creditcard" && (
            <div className="creditcard">
              <form onSubmit={handleAddCreditCard} className="form">
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newCreditCard.description}
                  onChange={(e) =>
                    setNewCreditCard({
                      ...newCreditCard,
                      description: e.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Valor"
                  step="0.01"
                  value={newCreditCard.amount}
                  onChange={(e) =>
                    setNewCreditCard({
                      ...newCreditCard,
                      amount: e.target.value,
                    })
                  }
                />
                <select
                  value={newCreditCard.subcategory}
                  onChange={(e) =>
                    setNewCreditCard({
                      ...newCreditCard,
                      subcategory: e.target.value,
                    })
                  }
                >
                  {SUBCATEGORIES.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
                <button type="submit">Adicionar</button>
              </form>

              <div className="list">
                {creditCard.map((cc) => (
                  <div key={cc.id} className="item">
                    <span>
                      💳 {cc.description} ({cc.subcategory}) - R${" "}
                      {cc.amount.toFixed(2)}
                    </span>
                    <button onClick={() => handleDeleteCreditCard(cc.id)}>
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INCOME ────────────────────────────────────────────────── */}
          {currentTab === "income" && (
            <div className="income">
              <form onSubmit={handleAddIncome} className="form">
                <input
                  type="text"
                  placeholder="Descrição"
                  value={newIncome.description}
                  onChange={(e) =>
                    setNewIncome({ ...newIncome, description: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Valor"
                  step="0.01"
                  value={newIncome.amount}
                  onChange={(e) =>
                    setNewIncome({ ...newIncome, amount: e.target.value })
                  }
                />
                <button type="submit">Adicionar</button>
              </form>

              <div className="list">
                {income.map((inc) => (
                  <div key={inc.id} className="item">
                    <span>
                      💰 {inc.description} - R$ {inc.amount.toFixed(2)}
                    </span>
                    <button onClick={() => handleDeleteIncome(inc.id)}>
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
