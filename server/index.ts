import express from "express";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../client/dist")));

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

// ── INITIALIZE DATABASE ───────────────────────────────────────────────────
async function initDB() {
  try {
    const connection = await pool.getConnection();

    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        xp INT DEFAULT 0,
        level VARCHAR(20) DEFAULT 'iniciante',
        levelNum INT DEFAULT 1,
        streakDays INT DEFAULT 0,
        lastCheckin DATE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Expenses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        categoryId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        paid INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (userId)
      )
    `);

    // Credit card expenses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS creditCardExpenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        subcategory VARCHAR(100),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (userId)
      )
    `);

    // Extra incomes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS extraIncomes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        date DATE DEFAULT CURDATE(),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (userId)
      )
    `);

    connection.release();
    console.log("✅ Database initialized successfully");
  } catch (error: any) {
    if (!error.message.includes("already exists")) {
      console.error("❌ Database initialization error:", error.message);
    }
  }
}

initDB();

// ── VALIDATION FUNCTIONS ──────────────────────────────────────────────────
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 4;
}

// ── AUTH ENDPOINTS ────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
    }

    const connection = await pool.getConnection();

    try {
      // Check if user exists
      const [users]: any = await connection.execute("SELECT id FROM users WHERE email = ?", [email]);

      if (users.length > 0) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      await connection.execute(
        "INSERT INTO users (name, email, password, xp, level, levelNum, streakDays) VALUES (?, ?, ?, 0, 'iniciante', 1, 0)",
        [name, email, hashedPassword]
      );

      // Get created user
      const [newUsers]: any = await connection.execute("SELECT id, name, email, xp, level, levelNum, streakDays FROM users WHERE email = ?", [email]);

      res.json({ user: newUsers[0], message: "Usuário criado com sucesso" });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const connection = await pool.getConnection();

    try {
      const [users]: any = await connection.execute(
        "SELECT id, name, email, password, xp, level, levelNum, streakDays FROM users WHERE email = ?",
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      const user = users[0];
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        xp: user.xp || 0,
        level: user.level || "iniciante",
        levelNum: user.levelNum || 1,
        streakDays: user.streakDays || 0,
      };

      res.json({ user: userData });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

// ── EXPENSES ENDPOINTS ────────────────────────────────────────────────────

app.get("/api/users/:userId/expenses", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();

    const [expenses]: any = await connection.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

    connection.release();
    res.json(expenses || []);
  } catch (error: any) {
    console.error("Get expenses error:", error);
    res.status(500).json({ error: "Erro ao buscar despesas" });
  }
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const { userId } = req.params;
    const { categoryId, name, amount } = req.body;

    if (!categoryId || !name || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        "INSERT INTO expenses (userId, categoryId, name, amount, paid, createdAt) VALUES (?, ?, ?, ?, 0, NOW())",
        [userId, categoryId, name, parseFloat(amount)]
      );

      const [expenses]: any = await connection.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(expenses);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Add expense error:", error);
    res.status(500).json({ error: "Erro ao adicionar despesa" });
  }
});

app.delete("/api/users/:userId/expenses/:expenseId", async (req, res) => {
  try {
    const { userId, expenseId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute("DELETE FROM expenses WHERE id = ? AND userId = ?", [expenseId, userId]);

      const [expenses]: any = await connection.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(expenses);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Delete expense error:", error);
    res.status(500).json({ error: "Erro ao deletar despesa" });
  }
});

app.put("/api/users/:userId/expenses/:expenseId/toggle", async (req, res) => {
  try {
    const { userId, expenseId } = req.params;
    const connection = await pool.getConnection();

    try {
      const [expenses]: any = await connection.execute("SELECT paid FROM expenses WHERE id = ? AND userId = ?", [expenseId, userId]);

      if (expenses.length === 0) {
        return res.status(404).json({ error: "Despesa não encontrada" });
      }

      const newPaid = expenses[0].paid === 1 ? 0 : 1;
      await connection.execute("UPDATE expenses SET paid = ? WHERE id = ? AND userId = ?", [newPaid, expenseId, userId]);

      const [updatedExpenses]: any = await connection.execute("SELECT * FROM expenses WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(updatedExpenses);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Toggle expense error:", error);
    res.status(500).json({ error: "Erro ao atualizar despesa" });
  }
});

// ── CREDIT CARD ENDPOINTS ─────────────────────────────────────────────────

app.get("/api/users/:userId/creditcard", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();

    const [creditcard]: any = await connection.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

    connection.release();
    res.json(creditcard || []);
  } catch (error: any) {
    console.error("Get credit card error:", error);
    res.status(500).json({ error: "Erro ao buscar cartão" });
  }
});

app.post("/api/users/:userId/creditcard", async (req, res) => {
  try {
    const { userId } = req.params;
    const { description, amount, subcategory } = req.body;

    if (!description || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute(
        "INSERT INTO creditCardExpenses (userId, description, amount, subcategory, createdAt) VALUES (?, ?, ?, ?, NOW())",
        [userId, description, parseFloat(amount), subcategory || null]
      );

      const [creditcard]: any = await connection.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(creditcard);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Add credit card error:", error);
    res.status(500).json({ error: "Erro ao adicionar ao cartão" });
  }
});

app.delete("/api/users/:userId/creditcard/:ccId", async (req, res) => {
  try {
    const { userId, ccId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute("DELETE FROM creditCardExpenses WHERE id = ? AND userId = ?", [ccId, userId]);

      const [creditcard]: any = await connection.execute("SELECT * FROM creditCardExpenses WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(creditcard);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Delete credit card error:", error);
    res.status(500).json({ error: "Erro ao deletar" });
  }
});

// ── INCOME ENDPOINTS ──────────────────────────────────────────────────────

app.get("/api/users/:userId/income", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();

    const [income]: any = await connection.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

    connection.release();
    res.json(income || []);
  } catch (error: any) {
    console.error("Get income error:", error);
    res.status(500).json({ error: "Erro ao buscar renda" });
  }
});

app.post("/api/users/:userId/income", async (req, res) => {
  try {
    const { userId } = req.params;
    const { description, amount } = req.body;

    if (!description || !amount || amount <= 0) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const connection = await pool.getConnection();

    try {
      await connection.execute("INSERT INTO extraIncomes (userId, description, amount, date) VALUES (?, ?, ?, CURDATE())", [
        userId,
        description,
        parseFloat(amount),
      ]);

      const [income]: any = await connection.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(income);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Add income error:", error);
    res.status(500).json({ error: "Erro ao adicionar renda" });
  }
});

app.delete("/api/users/:userId/income/:incomeId", async (req, res) => {
  try {
    const { userId, incomeId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.execute("DELETE FROM extraIncomes WHERE id = ? AND userId = ?", [incomeId, userId]);

      const [income]: any = await connection.execute("SELECT * FROM extraIncomes WHERE userId = ? ORDER BY id DESC", [userId]);

      res.json(income);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Delete income error:", error);
    res.status(500).json({ error: "Erro ao deletar renda" });
  }
});

// ── XP ENDPOINTS ──────────────────────────────────────────────────────────

app.post("/api/users/:userId/xp", async (req, res) => {
  try {
    const { userId } = req.params;
    const { xpGain } = req.body;

    if (!xpGain || xpGain <= 0) {
      return res.status(400).json({ error: "XP inválido" });
    }

    const connection = await pool.getConnection();

    try {
      const [users]: any = await connection.execute("SELECT xp, levelNum FROM users WHERE id = ?", [userId]);

      if (users.length === 0) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const user = users[0];
      const newXp = (user.xp || 0) + xpGain;
      const newLevelNum = Math.floor(newXp / 100) + 1;
      const level = newLevelNum > 5 ? "avancado" : "iniciante";

      await connection.execute("UPDATE users SET xp = ?, levelNum = ?, level = ? WHERE id = ?", [newXp, newLevelNum, level, userId]);

      res.json({ xp: newXp, level, levelNum: newLevelNum });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Add XP error:", error);
    res.status(500).json({ error: "Erro ao adicionar XP" });
  }
});

// ── STREAK ENDPOINTS ──────────────────────────────────────────────────────

app.post("/api/users/:userId/streak/checkin", async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();

    try {
      const [users]: any = await connection.execute("SELECT streakDays, lastCheckin, xp, levelNum FROM users WHERE id = ?", [userId]);

      if (users.length === 0) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const user = users[0];
      const today = new Date().toISOString().split("T")[0];
      const lastCheckin = user.lastCheckin ? new Date(user.lastCheckin).toISOString().split("T")[0] : null;

      if (lastCheckin === today) {
        return res.status(400).json({ error: "Você já reivindicou o streak hoje" });
      }

      const xpGain = 50;
      const newXp = (user.xp || 0) + xpGain;
      const newLevelNum = Math.floor(newXp / 100) + 1;
      const level = newLevelNum > 5 ? "avancado" : "iniciante";
      const newStreakDays = (user.streakDays || 0) + 1;

      await connection.execute(
        "UPDATE users SET streakDays = ?, lastCheckin = ?, xp = ?, levelNum = ?, level = ? WHERE id = ?",
        [newStreakDays, today, newXp, newLevelNum, level, userId]
      );

      res.json({ streakDays: newStreakDays, xp: newXp, level, levelNum: newLevelNum, xpGained: xpGain });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Claim streak error:", error);
    res.status(500).json({ error: "Erro ao reivindicar streak" });
  }
});

// ── FALLBACK ROUTE ────────────────────────────────────────────────────────

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

// ── START SERVER ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
