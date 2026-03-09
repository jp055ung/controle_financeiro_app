import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist/client"));

let pool: mysql.Pool | null = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

// ── AUTO-MIGRAÇÃO NA INICIALIZAÇÃO ────────────────────────────────────────────
// Roda uma vez ao subir o servidor. Cria tabelas e colunas que faltam.
async function runMigrations() {
  const p = getPool();
  if (!p) { console.log("⚠️  Sem DATABASE_URL — migrações puladas"); return; }

  console.log("🔄 Rodando migrações...");

  // Tabelas
  await p.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255), email VARCHAR(320) UNIQUE,
    password VARCHAR(255), salaryBase DECIMAL(10,2) DEFAULT 0,
    level VARCHAR(20) DEFAULT 'iniciante', levelNum INT DEFAULT 1,
    xp INT DEFAULT 0, streakDays INT DEFAULT 0, lastCheckin TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, categoryId INT NOT NULL,
    name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL,
    subcategory VARCHAR(100), paid INT DEFAULT 0, dueDate TIMESTAMP NULL,
    recurring INT DEFAULT 0, recurringMonths INT NULL, recurringGoal DECIMAL(10,2) NULL,
    createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100),
    createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW(),
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS monthArchive (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, month VARCHAR(7) NOT NULL,
    expensesJson TEXT, creditCardJson TEXT, incomesJson TEXT,
    createdAt TIMESTAMP DEFAULT NOW(),
    UNIQUE KEY user_month (userId, month)
  )`);

  // Colunas que podem estar faltando em bancos antigos
  const alters = [
    "ALTER TABLE users ADD COLUMN streakDays INT DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lastCheckin TIMESTAMP NULL",
    "ALTER TABLE users ADD COLUMN salaryBase DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN recurring INT DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN recurringMonths INT NULL",
    "ALTER TABLE expenses ADD COLUMN recurringGoal DECIMAL(10,2) NULL",
    "ALTER TABLE expenses ADD COLUMN dueDate TIMESTAMP NULL",
    "ALTER TABLE expenses ADD COLUMN subcategory VARCHAR(100)",
    "ALTER TABLE creditCardExpenses ADD COLUMN subcategory VARCHAR(100)",
  ];
  for (const sql of alters) {
    try { await p.execute(sql); } catch {} // ignora se já existe
  }

  console.log("✅ Migrações concluídas");
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [ex] = await p.execute("SELECT id FROM users WHERE email=?", [email]) as any;
    if (ex.length > 0) return res.status(400).json({ error: "Email ja cadastrado" });
    await p.execute("INSERT INTO users (name,email,password,salaryBase,xp,streakDays) VALUES (?,?,?,0,0,0)", [name, email, password]);
    const [rows] = await p.execute("SELECT * FROM users WHERE email=?", [email]) as any;
    const u = rows[0];
    res.json({ user: { id:u.id, name:u.name, email:u.email, salaryBase:0, xp:0, level:'iniciante', levelNum:1, streakDays:0, isNewUser:true } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT * FROM users WHERE email=? AND password=?", [email, password]) as any;
    if (!rows.length) return res.status(401).json({ error: "Credenciais invalidas" });
    const u = rows[0];
    res.json({ user: { id:u.id, name:u.name, email:u.email, salaryBase:u.salaryBase||0, xp:u.xp||0, level:u.level||'iniciante', levelNum:u.levelNum||1, streakDays:u.streakDays||0, lastCheckin:u.lastCheckin } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auth/me/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT id,name,email,salaryBase,xp,levelNum,level,streakDays,lastCheckin FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const salary = parseFloat(req.body.salaryBase);
    if (isNaN(salary)) return res.status(400).json({ error: "salaryBase invalido" });
    await p.execute("UPDATE users SET salaryBase=? WHERE id=?", [salary, req.params.id]);
    const [rows] = await p.execute("SELECT salaryBase FROM users WHERE id=?", [req.params.id]) as any;
    res.json({ success:true, salaryBase: rows[0]?.salaryBase ?? salary });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── XP ────────────────────────────────────────────────────────────────────────
app.post("/api/users/:id/xp", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const xpGain = parseFloat(req.body.xpGain);
    if (isNaN(xpGain) || xpGain <= 0) return res.status(400).json({ error: "xpGain invalido" });
    const [rows] = await p.execute("SELECT xp, level FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const newXp = (rows[0].xp || 0) + Math.round(xpGain);
    const newLevelNum = Math.min(Math.floor(newXp / 100) + 1, 50);
    await p.execute("UPDATE users SET xp=?, levelNum=? WHERE id=?", [newXp, newLevelNum, req.params.id]);
    res.json({ xp:newXp, levelNum:newLevelNum, level:rows[0].level||'iniciante', xpGained:Math.round(xpGain) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STREAK ────────────────────────────────────────────────────────────────────
// Regra: 1 checkin por dia (00:00–23:59 horário do servidor).
// Streak quebra se pular um dia. XP: {1:5,2:15,3:25,4:35,5:50,6:65,7:100,14:150,30:300,outros:65}
app.get("/api/users/:id/streak", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT streakDays, lastCheckin FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const { streakDays, lastCheckin } = rows[0];
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let claimedToday = false;
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcMidnight = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      claimedToday = lcMidnight.getTime() === todayMidnight.getTime();
    }
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 86400000);
    const msLeft = tomorrowMidnight.getTime() - now.getTime();
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    res.json({ streakDays: streakDays || 0, claimedToday, expiresIn: `${h}h ${m}m` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:id/streak/checkin", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT xp, level, streakDays, lastCheckin FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const { xp, level, streakDays, lastCheckin } = rows[0];

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Já fez hoje?
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcMidnight = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      if (lcMidnight.getTime() === todayMidnight.getTime()) {
        return res.status(400).json({ error: "Checkin ja realizado hoje" });
      }
    }

    // Streak quebrou? (último checkin foi antes de ontem)
    let streakBroken = false;
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcMidnight = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      const yesterdayMidnight = new Date(todayMidnight.getTime() - 86400000);
      streakBroken = lcMidnight.getTime() < yesterdayMidnight.getTime();
    }

    const newStreak = streakBroken ? 1 : (streakDays || 0) + 1;
    const xpMap: Record<number,number> = {1:5,2:15,3:25,4:35,5:50,6:65,7:100,14:150,30:300};
    const xpGain = xpMap[newStreak] !== undefined ? xpMap[newStreak] : 65;
    const newXp = (xp || 0) + xpGain;
    const newLevelNum = Math.min(Math.floor(newXp / 100) + 1, 50);

    await p.execute(
      "UPDATE users SET streakDays=?, lastCheckin=NOW(), xp=?, levelNum=? WHERE id=?",
      [newStreak, newXp, newLevelNum, req.params.id]
    );
    res.json({ streakDays:newStreak, xpGained:xpGain, xp:newXp, levelNum:newLevelNum, level:level||'iniciante', streakBroken });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM expenses WHERE userId=? ORDER BY categoryId, createdAt", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { categoryId, name, amount, subcategory, dueDate, recurring, recurringMonths, recurringGoal } = req.body;

    const catId = parseInt(categoryId);
    const amt = parseFloat(amount);
    if (isNaN(catId) || catId <= 0) return res.status(400).json({ error: "categoryId invalido" });
    if (!name || String(name).trim() === '') return res.status(400).json({ error: "name obrigatorio" });
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: `amount invalido: ${amount}` });

    const recur = (recurring === 1 || recurring === true || recurring === '1') ? 1 : 0;
    const recMonths = recurringMonths ? parseInt(recurringMonths) : null;
    const recGoal = recurringGoal ? parseFloat(recurringGoal) : null;
    let due: Date | null = null;
    if (dueDate) { try { due = new Date(dueDate); } catch {} }

    await p.execute(
      "INSERT INTO expenses (userId,categoryId,name,amount,subcategory,dueDate,paid,recurring,recurringMonths,recurringGoal) VALUES (?,?,?,?,?,?,0,?,?,?)",
      [req.params.userId, catId, name.trim(), amt, subcategory||null, due, recur, recMonths, recGoal]
    );
    const [rows] = await p.execute("SELECT * FROM expenses WHERE userId=? ORDER BY categoryId, createdAt", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) {
    console.error("POST /expenses error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/expenses/:id/paid", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("UPDATE expenses SET paid=? WHERE id=?", [req.body.paid ? 1 : 0, req.params.id]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM expenses WHERE id=?", [req.params.id]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── CREDIT CARD ───────────────────────────────────────────────────────────────
app.get("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount invalido" });
    await p.execute("INSERT INTO creditCardExpenses (userId,description,amount,subcategory) VALUES (?,?,?,?)",
      [req.params.userId, req.body.description, amt, req.body.subcategory||null]);
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM creditCardExpenses WHERE id=?", [req.params.id]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── EXTRA INCOME ──────────────────────────────────────────────────────────────
app.get("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const amt = parseFloat(req.body.amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount invalido" });
    await p.execute("INSERT INTO extraIncomes (userId,description,amount,date) VALUES (?,?,?,NOW())",
      [req.params.userId, req.body.description, amt]);
    const [rows] = await p.execute("SELECT * FROM extraIncomes WHERE userId=?", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/extra-income/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM extraIncomes WHERE id=?", [req.params.id]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── RESET MENSAL ──────────────────────────────────────────────────────────────
app.post("/api/users/:userId/reset-month", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const uid = req.params.userId;
    const month = new Date().toISOString().slice(0, 7); // "2026-03"

    // Busca dados antes de deletar
    const [expRows] = await p.execute("SELECT name, CAST(amount AS CHAR) as amount, categoryId, paid FROM expenses WHERE userId=?", [uid]) as any;
    const [ccRows]  = await p.execute("SELECT description, CAST(amount AS CHAR) as amount FROM creditCardExpenses WHERE userId=?", [uid]) as any;
    const [incRows] = await p.execute("SELECT description, CAST(amount AS CHAR) as amount FROM extraIncomes WHERE userId=?", [uid]) as any;

    // Arquiva (TEXT puro — sem JSON type para compatibilidade)
    await p.execute(
      `INSERT INTO monthArchive (userId, month, expensesJson, creditCardJson, incomesJson)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expensesJson=VALUES(expensesJson),
         creditCardJson=VALUES(creditCardJson),
         incomesJson=VALUES(incomesJson)`,
      [uid, month, JSON.stringify(expRows||[]), JSON.stringify(ccRows||[]), JSON.stringify(incRows||[])]
    );

    // Limpa — SEM tocar xp/levelNum/streakDays
    await p.execute("DELETE FROM expenses WHERE userId=? AND (recurring=0 OR recurring IS NULL)", [uid]);
    await p.execute("DELETE FROM creditCardExpenses WHERE userId=?", [uid]);
    await p.execute("DELETE FROM extraIncomes WHERE userId=?", [uid]);
    await p.execute("UPDATE expenses SET paid=0 WHERE userId=? AND recurring=1", [uid]);

    const [uRows] = await p.execute("SELECT xp, levelNum, level, salaryBase FROM users WHERE id=?", [uid]) as any;
    res.json({ success:true, month, user: uRows[0]||{} });
  } catch (e: any) {
    console.error("reset-month error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/history", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      "SELECT month, expensesJson, creditCardJson, incomesJson FROM monthArchive WHERE userId=? ORDER BY month DESC LIMIT 12",
      [req.params.userId]
    ) as any;
    const history = rows.map((row: any) => {
      try {
        const exp = JSON.parse(row.expensesJson || '[]');
        const cc  = JSON.parse(row.creditCardJson || '[]');
        const inc = JSON.parse(row.incomesJson || '[]');
        const totalExp = exp.reduce((s: number, e: any) => s + parseFloat(e.amount||0), 0);
        const totalCC  = cc.reduce((s: number, c: any) => s + parseFloat(c.amount||0), 0);
        const totalInc = inc.reduce((s: number, i: any) => s + parseFloat(i.amount||0), 0);
        return { month:row.month, totalExpenses:totalExp+totalCC, totalIncome:totalInc, balance:totalInc-totalExp-totalCC, items:exp.length+cc.length };
      } catch { return { month:row.month, totalExpenses:0, totalIncome:0, balance:0, items:0 }; }
    });
    res.json(history);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── INIT-DB MANUAL (mantido como fallback) ────────────────────────────────────
app.get("/api/admin/init-db", async (_req, res) => {
  try { await runMigrations(); res.json({ success:true, message:"Banco OK!" }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("*", (_req, res) => { res.sendFile("index.html", { root: "dist/client" }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🪙 MoneyGame porta ${PORT}`);
  await runMigrations(); // ← migra automaticamente ao subir
});
