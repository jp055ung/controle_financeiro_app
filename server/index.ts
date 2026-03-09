import express, { Request, Response } from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// ── DATABASE CONNECTION ───────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "controle_financeiro",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ── VALIDATION FUNCTIONS ──────────────────────────────────────────────────
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 6;
}

// ── XP CALCULATION ────────────────────────────────────────────────────────
const calcXpExpense = (a: number) => Math.max(1, Math.round(a * 0.1));
const calcXpIncome = (a: number) => Math.max(1, Math.round(a));
const XP_PAY_BILL = 15;

// ── LEVEL CALCULATION ────────────────────────────────────────────────────
function calcLevel(xp: number): { levelNum: number; level: string } {
  const levelNum = Math.floor(xp / 100) + 1;
  const level = levelNum >= 5 ? "avancado" : "iniciante";
  return { levelNum, level };
}

// ── STREAK CALCULATION ────────────────────────────────────────────────────
function getStreakXP(days: number): number {
  const map: Record<number, number> = { 1: 5, 2: 15, 3: 25, 4: 35, 5: 50, 6: 65, 7: 100, 14: 150, 30: 300 };
  return map[days] ?? 65;
}

// ── AUTH ENDPOINTS ────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    // Validations
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Nome deve ter pelo menos 2 caracteres" });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    const conn = await pool.getConnection();

    // Check if user exists
    const [rows] = await conn.execute("SELECT id FROM users WHERE email = ?", [email]);
    if ((rows as any[]).length > 0) {
      conn.release();
      return res.status(400).json({ error: "Email já registrado" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await conn.execute(
      "INSERT INTO users (name, email, password, xp, level, levelNum, streakDays, lastCheckin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, 0, "iniciante", 1, 0, new Date()]
    );

    // Get user
    const [userRows] = await conn.execute("SELECT id, name, email, xp, level, levelNum, streakDays FROM users WHERE email = ?", [email]);
    const user = (userRows as any[])[0];

    conn.release();

    res.json({ user });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT id, name, email, password, xp, level, levelNum, streakDays FROM users WHERE email = ?", [email]);
    const user = (rows as any[])[0];

    if (!user) {
      conn.release();
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      conn.release();
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    conn.release();

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

// ── EXPENSE ENDPOINTS ─────────────────────────────────────────────────────

app.get("/api/users/:userId/expenses", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Get expenses error:", error);
    res.status(500).json({ error: "Erro ao buscar despesas" });
  }
});

app.post("/api/users/:userId/expenses", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { categoryId, name, amount } = req.body;

    if (!categoryId || !name || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      "INSERT INTO expenses (userId, categoryId, name, amount, paid, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [userId, categoryId, name, amount, 0, new Date()]
    );

    const [rows] = await conn.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Add expense error:", error);
    res.status(500).json({ error: "Erro ao adicionar despesa" });
  }
});

app.delete("/api/users/:userId/expenses/:expenseId", async (req: Request, res: Response) => {
  try {
    const { userId, expenseId } = req.params;
    const conn = await pool.getConnection();

    await conn.execute("DELETE FROM expenses WHERE id = ? AND userId = ?", [expenseId, userId]);

    const [rows] = await conn.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: "Erro ao deletar despesa" });
  }
});

app.put("/api/users/:userId/expenses/:expenseId/toggle", async (req: Request, res: Response) => {
  try {
    const { userId, expenseId } = req.params;
    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT paid FROM expenses WHERE id = ? AND userId = ?", [expenseId, userId]);
    const expense = (rows as any[])[0];

    if (!expense) {
      conn.release();
      return res.status(404).json({ error: "Despesa não encontrada" });
    }

    const newPaid = expense.paid === 1 ? 0 : 1;
    await conn.execute("UPDATE expenses SET paid = ? WHERE id = ? AND userId = ?", [newPaid, expenseId, userId]);

    const [updatedRows] = await conn.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(updatedRows);
  } catch (error: any) {
    console.error("Toggle expense error:", error);
    res.status(500).json({ error: "Erro ao atualizar despesa" });
  }
});

// ── CREDIT CARD ENDPOINTS ─────────────────────────────────────────────────

app.get("/api/users/:userId/creditcard", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Get credit card error:", error);
    res.status(500).json({ error: "Erro ao buscar cartão" });
  }
});

app.post("/api/users/:userId/creditcard", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { description, amount, subcategory } = req.body;

    if (!description || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      "INSERT INTO creditCardExpenses (userId, description, amount, subcategory, createdAt) VALUES (?, ?, ?, ?, ?)",
      [userId, description, amount, subcategory || null, new Date()]
    );

    const [rows] = await conn.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Add credit card error:", error);
    res.status(500).json({ error: "Erro ao adicionar ao cartão" });
  }
});

app.delete("/api/users/:userId/creditcard/:ccId", async (req: Request, res: Response) => {
  try {
    const { userId, ccId } = req.params;
    const conn = await pool.getConnection();

    await conn.execute("DELETE FROM creditCardExpenses WHERE id = ? AND userId = ?", [ccId, userId]);

    const [rows] = await conn.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Delete credit card error:", error);
    res.status(500).json({ error: "Erro ao deletar" });
  }
});

// ── INCOME ENDPOINTS ──────────────────────────────────────────────────────

app.get("/api/users/:userId/income", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Get income error:", error);
    res.status(500).json({ error: "Erro ao buscar renda" });
  }
});

app.post("/api/users/:userId/income", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { description, amount } = req.body;

    if (!description || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      "INSERT INTO extraIncomes (userId, description, amount, date) VALUES (?, ?, ?, ?)",
      [userId, description, amount, new Date()]
    );

    const [rows] = await conn.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Add income error:", error);
    res.status(500).json({ error: "Erro ao adicionar renda" });
  }
});

app.delete("/api/users/:userId/income/:incomeId", async (req: Request, res: Response) => {
  try {
    const { userId, incomeId } = req.params;
    const conn = await pool.getConnection();

    await conn.execute("DELETE FROM extraIncomes WHERE id = ? AND userId = ?", [incomeId, userId]);

    const [rows] = await conn.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

    conn.release();
    res.json(rows);
  } catch (error: any) {
    console.error("Delete income error:", error);
    res.status(500).json({ error: "Erro ao deletar" });
  }
});

// ── XP ENDPOINTS ──────────────────────────────────────────────────────────

app.post("/api/users/:userId/xp", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { xpGain } = req.body;

    if (!xpGain || xpGain <= 0) {
      return res.status(400).json({ error: "XP inválido" });
    }

    const conn = await pool.getConnection();

    // Get current XP
    const [rows] = await conn.execute("SELECT xp FROM users WHERE id = ?", [userId]);
    const user = (rows as any[])[0];

    if (!user) {
      conn.release();
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const newXp = (user.xp || 0) + xpGain;
    const { levelNum, level } = calcLevel(newXp);

    // Update user
    await conn.execute("UPDATE users SET xp = ?, level = ?, levelNum = ? WHERE id = ?", [newXp, level, levelNum, userId]);

    conn.release();

    res.json({ xp: newXp, level, levelNum, xpGained: xpGain });
  } catch (error: any) {
    console.error("Add XP error:", error);
    res.status(500).json({ error: "Erro ao adicionar XP" });
  }
});

// ── STREAK ENDPOINTS ──────────────────────────────────────────────────────

app.post("/api/users/:userId/streak/checkin", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const conn = await pool.getConnection();

    const [rows] = await conn.execute("SELECT streakDays, lastCheckin, xp FROM users WHERE id = ?", [userId]);
    const user = (rows as any[])[0];

    if (!user) {
      conn.release();
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCheckin = user.lastCheckin ? new Date(user.lastCheckin) : null;
    if (lastCheckin) {
      lastCheckin.setHours(0, 0, 0, 0);
    }

    // Check if already checked in today
    if (lastCheckin && lastCheckin.getTime() === today.getTime()) {
      conn.release();
      return res.status(400).json({ error: "Você já reivindicou o streak hoje" });
    }

    // Check if streak should reset
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreakDays = user.streakDays || 0;
    if (lastCheckin && lastCheckin.getTime() !== yesterday.getTime()) {
      newStreakDays = 1; // Reset streak
    } else {
      newStreakDays += 1; // Continue streak
    }

    // Calculate XP for streak
    const xpGain = getStreakXP(newStreakDays);
    const newXp = (user.xp || 0) + xpGain;
    const { levelNum, level } = calcLevel(newXp);

    // Update user
    await conn.execute(
      "UPDATE users SET streakDays = ?, lastCheckin = ?, xp = ?, level = ?, levelNum = ? WHERE id = ?",
      [newStreakDays, today, newXp, level, levelNum, userId]
    );

    conn.release();

    res.json({ streakDays: newStreakDays, xp: newXp, level, levelNum, xpGained: xpGain });
  } catch (error: any) {
    console.error("Checkin error:", error);
    res.status(500).json({ error: "Erro ao reivindicar streak" });
  }
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ── START SERVER ──────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
