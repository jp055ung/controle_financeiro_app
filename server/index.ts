import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import "dotenv/config";
import path from "path";
import crypto from "crypto";

// Hash simples SHA-256 com salt (sem dependência extra — bcrypt não está no package.json)
// Para migrar para bcrypt, instale: npm install bcrypt @types/bcrypt
function hashPassword(password: string): string {
  const salt = "mg_salt_2026"; // salt fixo — para produção real use bcrypt com salt dinâmico
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}
function verifyPassword(password: string, hash: string): boolean {
  // Compatibilidade retroativa: aceita senha em texto puro (migrações antigas) OU hash
  if (hash === password) return true; // senha antiga em texto puro — ainda funciona no login
  return hashPassword(password) === hash;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "dist", "client")));

let pool: mysql.Pool | null = null;
function getPool() {
  if (!pool && process.env.DATABASE_URL) pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

// ── MIGRAÇÕES AUTOMÁTICAS ─────────────────────────────────────────────────────
async function runMigrations() {
  const p = getPool();
  if (!p) { console.log("⚠️  Sem DATABASE_URL"); return; }
  console.log("🔄 Migrações...");

  await p.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255), email VARCHAR(320) UNIQUE, password VARCHAR(255),
    salaryBase DECIMAL(10,2) DEFAULT 0,
    level VARCHAR(20) DEFAULT 'iniciante', levelNum INT DEFAULT 1,
    xp INT DEFAULT 0, streakDays INT DEFAULT 0, lastCheckin TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, categoryId INT NOT NULL,
    name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL,
    subcategory VARCHAR(100), paid INT DEFAULT 0, dueDate TIMESTAMP NULL,
    recurring INT DEFAULT 0, recurringMonths INT NULL, recurringGoal DECIMAL(10,2) NULL,
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, paid INT DEFAULT 0, subcategory VARCHAR(100),
    createdAt TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW()
  )`);

  await p.execute(`CREATE TABLE IF NOT EXISTS monthArchive (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL, month VARCHAR(7) NOT NULL,
    expensesJson TEXT, creditCardJson TEXT, incomesJson TEXT,
    totalExpenses DECIMAL(10,2) DEFAULT 0, totalIncome DECIMAL(10,2) DEFAULT 0,
    totalSalary DECIMAL(10,2) DEFAULT 0, totalExtraIncome DECIMAL(10,2) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT NOW(),
    UNIQUE KEY user_month (userId, month)
  )`);

  // Adiciona colunas faltantes em bancos antigos
  const alters = [
    "ALTER TABLE users ADD COLUMN xp INT DEFAULT 0",
    "ALTER TABLE users ADD COLUMN streakDays INT DEFAULT 0",
    "ALTER TABLE users ADD COLUMN lastCheckin TIMESTAMP NULL",
    "ALTER TABLE users ADD COLUMN salaryBase DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE users ADD COLUMN level VARCHAR(20) DEFAULT 'iniciante'",
    "ALTER TABLE users ADD COLUMN levelNum INT DEFAULT 1",
    "ALTER TABLE expenses ADD COLUMN recurring INT DEFAULT 0",
    "ALTER TABLE expenses ADD COLUMN recurringMonths INT NULL",
    "ALTER TABLE expenses ADD COLUMN recurringGoal DECIMAL(10,2) NULL",
    "ALTER TABLE expenses ADD COLUMN dueDate TIMESTAMP NULL",
    "ALTER TABLE expenses ADD COLUMN subcategory VARCHAR(100)",
    "ALTER TABLE creditCardExpenses ADD COLUMN paid INT DEFAULT 0",
    "ALTER TABLE creditCardExpenses ADD COLUMN subcategory VARCHAR(100)",
    "ALTER TABLE creditCardExpenses ADD COLUMN totalAmount DECIMAL(10,2) NULL",
    "ALTER TABLE creditCardExpenses ADD COLUMN installments INT DEFAULT 1",
    "ALTER TABLE creditCardExpenses ADD COLUMN installmentCurrent INT DEFAULT 1",
    "ALTER TABLE creditCardExpenses ADD COLUMN dueDay INT NULL",
    "ALTER TABLE monthArchive ADD COLUMN totalExpenses DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE monthArchive ADD COLUMN totalIncome DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE monthArchive ADD COLUMN totalSalary DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE monthArchive ADD COLUMN totalExtraIncome DECIMAL(10,2) DEFAULT 0",
  ];
  for (const sql of alters) { try { await p.execute(sql); } catch {} }
  console.log("✅ Migrações OK");
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: "Preencha todos os campos" });
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [ex] = await p.execute("SELECT id FROM users WHERE email=?", [email]) as any;
    if (ex.length > 0) return res.status(400).json({ error: "Email ja cadastrado" });
    const hashedPw = hashPassword(password);
    await p.execute("INSERT INTO users (name,email,password,salaryBase,xp,streakDays,levelNum,level) VALUES (?,?,?,0,0,0,1,'iniciante')", [name, email, hashedPw]);
    const [rows] = await p.execute("SELECT * FROM users WHERE email=?", [email]) as any;
    const u = rows[0];
    res.json({ user: { id:u.id, name:u.name, email:u.email, salaryBase:0, xp:0, level:'iniciante', levelNum:1, streakDays:0, isNewUser:true } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT * FROM users WHERE email=?", [email]) as any;
    if (!rows.length) return res.status(401).json({ error: "Credenciais invalidas" });
    const u = rows[0];
    if (!verifyPassword(password, u.password)) return res.status(401).json({ error: "Credenciais invalidas" });
    // Migração automática: se senha ainda está em texto puro, atualiza para hash
    if (u.password === password) {
      await p.execute("UPDATE users SET password=? WHERE id=?", [hashPassword(password), u.id]);
    }
    res.json({ user: { id:u.id, name:u.name, email:u.email, salaryBase:u.salaryBase||0, xp:u.xp||0, level:u.level||'iniciante', levelNum:u.levelNum||1, streakDays:u.streakDays||0, lastCheckin:u.lastCheckin||null } });
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

// ── RESET DE SENHA (esqueci minha senha → redefine para 0000) ─────────────────
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "E-mail obrigatório" });
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT id FROM users WHERE email=?", [email.trim()]) as any;
    if (!rows.length) return res.status(404).json({ error: "E-mail não encontrado" });
    await p.execute("UPDATE users SET password=? WHERE email=?", [hashPassword("0000"), email.trim()]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


app.put("/api/users/:id/password", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Preencha todos os campos" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
    const [rows] = await p.execute("SELECT password FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!verifyPassword(currentPassword, rows[0].password)) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }
    await p.execute("UPDATE users SET password=? WHERE id=?", [hashPassword(newPassword), req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── HELPERS DE NÍVEL ─────────────────────────────────────────────────────────
const XP_PER_LEVEL = 1000;
const MAX_LEVEL    = 100;
const TIER_BREAK   = 50;

function calcLevel(xpTotal: number) {
  const rawLevel = Math.floor(xpTotal / XP_PER_LEVEL) + 1;
  const levelNum  = Math.min(rawLevel, MAX_LEVEL);
  let tier = "iniciante";
  if (levelNum >= MAX_LEVEL) tier = "avancado";
  else if (levelNum >= TIER_BREAK) tier = "investidor";
  return { levelNum, tier };
}

// ── XP ────────────────────────────────────────────────────────────────────────
app.post("/api/users/:id/xp", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const xpGain = Math.round(parseFloat(req.body.xpGain));
    if (isNaN(xpGain) || xpGain <= 0) return res.status(400).json({ error: "xpGain invalido" });
    const [rows] = await p.execute("SELECT xp FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    const newXp = (rows[0].xp || 0) + xpGain;
    const { levelNum, tier } = calcLevel(newXp);
    await p.execute("UPDATE users SET xp=?, levelNum=?, level=? WHERE id=?", [newXp, levelNum, tier, req.params.id]);
    res.json({ xp:newXp, levelNum, level:tier, xpGained:xpGain });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── STREAK ────────────────────────────────────────────────────────────────────
// Regra: 1 checkin por dia (00:00–23:59). Streak zera se pular 1 dia.
// Dia 30+ reinicia para 1. XP = dia * 10.
app.get("/api/users/:id/streak", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT streakDays, lastCheckin FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    let { streakDays, lastCheckin } = rows[0];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    // Verifica se streak foi quebrado (mais de 1 dia sem checkin)
    let streakBroken = false;
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcStart = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      // Se o último checkin foi antes de ontem, streak quebrou
      if (lcStart.getTime() < yesterdayStart.getTime()) {
        streakBroken = true;
      }
    }

    // Se streak quebrou, zera no banco imediatamente
    if (streakBroken) {
      await p.execute("UPDATE users SET streakDays=0 WHERE id=?", [req.params.id]);
      streakDays = 0;
    }

    let claimedToday = false;
    if (lastCheckin && !streakBroken) {
      const lc = new Date(lastCheckin);
      const lcStart = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      claimedToday = lcStart.getTime() === todayStart.getTime();
    }

    const msLeft = new Date(todayStart.getTime() + 86400000).getTime() - now.getTime();
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    res.json({ streakDays: streakDays || 0, claimedToday, expiresIn: `${h}h ${m}m`, streakBroken });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:id/streak/checkin", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const [rows] = await p.execute("SELECT xp, level, levelNum, streakDays, lastCheckin FROM users WHERE id=?", [req.params.id]) as any;
    if (!rows.length) return res.status(404).json({ error: "Nao encontrado" });
    let { xp, level, levelNum, streakDays, lastCheckin } = rows[0];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    // Já fez hoje?
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcStart = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      if (lcStart.getTime() === todayStart.getTime()) {
        return res.status(400).json({ error: "Checkin ja realizado hoje" });
      }
    }

    // Streak quebrou se pulou um dia (último checkin foi antes de ontem)
    let newStreak = (streakDays || 0) + 1;
    if (lastCheckin) {
      const lc = new Date(lastCheckin);
      const lcStart = new Date(lc.getFullYear(), lc.getMonth(), lc.getDate());
      if (lcStart.getTime() < yesterdayStart.getTime()) newStreak = 1; // streak quebrou
    }
    if (newStreak > 30) newStreak = 1; // reinicia após dia 30

    const isMilestone = newStreak === 7 || newStreak === 15 || newStreak === 30;

    // XP = dia * 10
    const xpGain = newStreak * 10;
    const newXp = (xp || 0) + xpGain;
    const { levelNum: newLevelNum, tier: newTier } = calcLevel(newXp);

    await p.execute("UPDATE users SET streakDays=?, lastCheckin=NOW(), xp=?, levelNum=?, level=? WHERE id=?",
      [newStreak, newXp, newLevelNum, newTier, req.params.id]);

    res.json({ streakDays:newStreak, xpGained:xpGain, xp:newXp, levelNum:newLevelNum, level:newTier, isMilestone });
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
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name obrigatorio" });
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "amount invalido" });
    const recur = (recurring === 1 || recurring === true || recurring === '1') ? 1 : 0;
    let due: Date | null = null;
    if (dueDate) { try { due = new Date(dueDate); } catch {} }
    await p.execute(
      "INSERT INTO expenses (userId,categoryId,name,amount,subcategory,dueDate,paid,recurring,recurringMonths,recurringGoal) VALUES (?,?,?,?,?,?,0,?,?,?)",
      [req.params.userId, catId, name.trim(), amt, subcategory||null, due, recur,
       recurringMonths ? parseInt(recurringMonths) : null,
       recurringGoal ? parseFloat(recurringGoal) : null]
    );
    const [rows] = await p.execute("SELECT * FROM expenses WHERE userId=? ORDER BY categoryId, createdAt", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { console.error("POST expenses:", e.message); res.status(500).json({ error: e.message }); }
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

// ── CARTÃO DE CRÉDITO ─────────────────────────────────────────────────────────
app.get("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId=? ORDER BY createdAt", [req.params.userId]) as any;
    res.json(rows);
  } catch { res.json([]); }
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { description, subcategory, amount, installments, dueDay } = req.body;
    const inst = Math.max(1, parseInt(installments) || 1);
    const totalAmt = parseFloat(amount);
    if (isNaN(totalAmt) || totalAmt <= 0) return res.status(400).json({ error: "amount invalido" });
    const parcelAmt = Math.round(totalAmt / inst * 100) / 100;
    await p.execute(
      "INSERT INTO creditCardExpenses (userId,description,amount,totalAmount,installments,installmentCurrent,subcategory,paid,dueDay) VALUES (?,?,?,?,?,1,?,0,?)",
      [req.params.userId, description, parcelAmt, inst > 1 ? totalAmt : null, inst, subcategory||null, dueDay||null]
    );
    const [rows] = await p.execute("SELECT * FROM creditCardExpenses WHERE userId=? ORDER BY createdAt", [req.params.userId]) as any;
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { paid, amount, description, dueDay, advanceInstallment } = req.body;
    if (paid !== undefined) {
      await p.execute("UPDATE creditCardExpenses SET paid=? WHERE id=?", [paid ? 1 : 0, req.params.id]);
    }
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0) await p.execute("UPDATE creditCardExpenses SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    if (description !== undefined) {
      await p.execute("UPDATE creditCardExpenses SET description=? WHERE id=?", [description, req.params.id]);
    }
    if (dueDay !== undefined) {
      await p.execute("UPDATE creditCardExpenses SET dueDay=? WHERE id=?", [dueDay||null, req.params.id]);
    }
    if (advanceInstallment) {
      const [rows] = await p.execute("SELECT installments, installmentCurrent FROM creditCardExpenses WHERE id=?", [req.params.id]) as any;
      if (rows.length) {
        const { installments, installmentCurrent } = rows[0];
        if (installmentCurrent < installments) {
          await p.execute("UPDATE creditCardExpenses SET installmentCurrent=installmentCurrent+1, paid=0 WHERE id=?", [req.params.id]);
        } else {
          await p.execute("DELETE FROM creditCardExpenses WHERE id=?", [req.params.id]);
        }
      }
    }
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("DELETE FROM creditCardExpenses WHERE id=?", [req.params.id]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/users/:userId/credit-card/pay-all", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    await p.execute("UPDATE creditCardExpenses SET paid=1 WHERE userId=?", [req.params.userId]);
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── EDITAR DESPESA ────────────────────────────────────────────────────────────
app.patch("/api/expenses/:id/edit", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { name, amount } = req.body;
    if (name !== undefined) await p.execute("UPDATE expenses SET name=? WHERE id=?", [name, req.params.id]);
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0) await p.execute("UPDATE expenses SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── RENDA EXTRA ───────────────────────────────────────────────────────────────
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

app.patch("/api/extra-income/:id/edit", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const { description, amount } = req.body;
    if (description !== undefined) await p.execute("UPDATE extraIncomes SET description=? WHERE id=?", [description, req.params.id]);
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!isNaN(amt) && amt > 0) await p.execute("UPDATE extraIncomes SET amount=? WHERE id=?", [amt, req.params.id]);
    }
    res.json({ success:true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── VIRAR O MÊS ──────────────────────────────────────────────────────────────
// Aceita month do frontend (para respeitar timezone do usuário) ou usa o do servidor como fallback
app.post("/api/users/:userId/reset-month", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.status(500).json({ error: "DB indisponivel" });
    const uid = req.params.userId;
    // Usa o mês enviado pelo frontend (timezone do usuário) ou fallback para servidor
    const month = req.body.month || new Date().toISOString().slice(0, 7);

    const [expRows] = await p.execute("SELECT name, CAST(amount AS CHAR) as amount, categoryId, paid FROM expenses WHERE userId=?", [uid]) as any;
    const [ccRows]  = await p.execute("SELECT description, CAST(amount AS CHAR) as amount, paid FROM creditCardExpenses WHERE userId=?", [uid]) as any;
    const [incRows] = await p.execute("SELECT description, CAST(amount AS CHAR) as amount FROM extraIncomes WHERE userId=?", [uid]) as any;

    const totalExp = (expRows||[]).reduce((s: number, e: any) => s + parseFloat(e.amount||0), 0);
    const totalCC  = (ccRows||[]).reduce((s: number, c: any) => s + parseFloat(c.amount||0), 0);
    const totalInc = (incRows||[]).reduce((s: number, i: any) => s + parseFloat(i.amount||0), 0);
    const [uSalary] = await p.execute("SELECT salaryBase FROM users WHERE id=?", [uid]) as any;
    const salaryBase = parseFloat((uSalary[0]||{}).salaryBase||0);
    const totalIncomeWithSalary = totalInc + salaryBase;

    await p.execute(
      `INSERT INTO monthArchive (userId,month,expensesJson,creditCardJson,incomesJson,totalExpenses,totalIncome,totalSalary,totalExtraIncome)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         expensesJson=VALUES(expensesJson), creditCardJson=VALUES(creditCardJson),
         incomesJson=VALUES(incomesJson), totalExpenses=VALUES(totalExpenses), totalIncome=VALUES(totalIncome),
         totalSalary=VALUES(totalSalary), totalExtraIncome=VALUES(totalExtraIncome)`,
      [uid, month, JSON.stringify(expRows||[]), JSON.stringify(ccRows||[]), JSON.stringify(incRows||[]),
       totalExp+totalCC, totalIncomeWithSalary, salaryBase, totalInc]
    );

    // Limpa — NÃO toca xp, streakDays, salaryBase
    await p.execute("DELETE FROM expenses WHERE userId=? AND (recurring=0 OR recurring IS NULL)", [uid]);
    await p.execute("DELETE FROM creditCardExpenses WHERE userId=?", [uid]);
    await p.execute("DELETE FROM extraIncomes WHERE userId=?", [uid]);
    await p.execute("UPDATE expenses SET paid=0 WHERE userId=? AND recurring=1", [uid]);

    const [uRows] = await p.execute("SELECT id, name, salaryBase FROM users WHERE id=?", [uid]) as any;
    res.json({ success:true, month, user: uRows[0]||{} });
  } catch (e: any) {
    console.error("reset-month:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────
app.get("/api/users/:userId/history", async (req, res) => {
  try {
    const p = getPool(); if (!p) return res.json([]);
    const [rows] = await p.execute(
      "SELECT month, totalExpenses, totalIncome, totalSalary, totalExtraIncome FROM monthArchive WHERE userId=? ORDER BY month DESC LIMIT 12",
      [req.params.userId]
    ) as any;
    const history = (rows||[]).map((r: any) => ({
      month: r.month,
      totalExpenses: parseFloat(r.totalExpenses||0),
      totalIncome: parseFloat(r.totalIncome||0),
      totalSalary: parseFloat(r.totalSalary||0),
      totalExtraIncome: parseFloat(r.totalExtraIncome||0),
      balance: parseFloat(r.totalIncome||0) - parseFloat(r.totalExpenses||0),
    }));
    res.json(history);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── ANÁLISE IA ────────────────────────────────────────────────────────────────
// Controle de geração: somente a cada 15 dias (1º e 16º de cada mês)
// Guarda último uso no banco para não depender do cliente
app.post("/api/ai/insights", async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor" });

    const { prompt, userId } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt obrigatorio" });

    // Controle de grade: somente nos períodos 1-15 (janela A) e 16-fim (janela B)
    const now = new Date();
    const day = now.getDate();
    // Janela atual: "YYYY-MM-A" ou "YYYY-MM-B"
    const windowKey = `${now.toISOString().slice(0,7)}-${day <= 15 ? 'A' : 'B'}`;

    // Verifica se já gerou nesta janela (usando userId se disponível)
    if (userId) {
      const p = getPool();
      if (p) {
        try {
          // Usa monthArchive como proxy — cria campo virtual via JSON para armazenar ai_window
          // Alternativa simples: checa se já existe registro ai_window_${windowKey} para o usuário
          // Usamos uma tabela simples via alters
          await p.execute(`CREATE TABLE IF NOT EXISTS ai_usage (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId INT NOT NULL, windowKey VARCHAR(20) NOT NULL,
            createdAt TIMESTAMP DEFAULT NOW(),
            UNIQUE KEY user_window (userId, windowKey)
          )`).catch(()=>{});

          const [existing] = await p.execute("SELECT id FROM ai_usage WHERE userId=? AND windowKey=?", [userId, windowKey]) as any;
          if (existing.length > 0) {
            return res.status(429).json({
              error: `Análise já gerada neste período (${day <= 15 ? '1-15' : '16-fim'} do mês). Próxima disponível em ${day <= 15 ? '16' : '1 do próximo mês'}.`,
              windowKey
            });
          }
          // Registra uso
          await p.execute("INSERT IGNORE INTO ai_usage (userId, windowKey) VALUES (?,?)", [userId, windowKey]);
        } catch {}
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json() as any;
    if (!response.ok) return res.status(502).json({ error: data?.error?.message || "Erro na API Anthropic" });

    const text = data.content?.map((b: any) => b.text || "").join("") || "";
    res.json({ text, windowKey });
  } catch (e: any) {
    console.error("AI insights:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── STATIC + FALLBACK ─────────────────────────────────────────────────────────
app.get("*", (_req, res) => {
  const indexPath = path.join(process.cwd(), "dist", "client", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>MoneyGame</title></head><body><div id="root"></div></body></html>`);
  });
});

// ── AUTO VIRADA DE MÊS ────────────────────────────────────────────────────────
// Roda a cada hora — verifica se é o primeiro dia do mês e arquiva para todos os usuários
async function checkMonthRollover() {
  const p = getPool();
  if (!p) return;
  try {
    const now = new Date();
    if (now.getDate() !== 1 || now.getHours() !== 0) return; // Só roda no dia 1 às 00:xx

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2,'0')}`;

    const [users] = await p.execute("SELECT id, salaryBase FROM users") as any;
    for (const u of users) {
      // Verifica se já foi arquivado
      const [existing] = await p.execute("SELECT id FROM monthArchive WHERE userId=? AND month=?", [u.id, prevMonthKey]) as any;
      if (existing.length > 0) continue;

      // Arquiva o mês anterior
      const [expRows] = await p.execute("SELECT name, CAST(amount AS CHAR) as amount, categoryId, paid FROM expenses WHERE userId=?", [u.id]) as any;
      const [ccRows]  = await p.execute("SELECT description, CAST(amount AS CHAR) as amount, paid FROM creditCardExpenses WHERE userId=?", [u.id]) as any;
      const [incRows] = await p.execute("SELECT description, CAST(amount AS CHAR) as amount FROM extraIncomes WHERE userId=?", [u.id]) as any;

      const totalExp = (expRows||[]).reduce((s: number, e: any) => s + parseFloat(e.amount||0), 0);
      const totalCC  = (ccRows||[]).reduce((s: number, c: any) => s + parseFloat(c.amount||0), 0);
      const totalInc = (incRows||[]).reduce((s: number, i: any) => s + parseFloat(i.amount||0), 0);
      const salaryBase = parseFloat(u.salaryBase||0);

      await p.execute(
        `INSERT IGNORE INTO monthArchive (userId,month,expensesJson,creditCardJson,incomesJson,totalExpenses,totalIncome,totalSalary,totalExtraIncome)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [u.id, prevMonthKey, JSON.stringify(expRows||[]), JSON.stringify(ccRows||[]), JSON.stringify(incRows||[]),
         totalExp+totalCC, totalInc+salaryBase, salaryBase, totalInc]
      );

      // Limpa mês (mesma lógica do reset manual)
      await p.execute("DELETE FROM expenses WHERE userId=? AND (recurring=0 OR recurring IS NULL)", [u.id]);
      await p.execute("DELETE FROM creditCardExpenses WHERE userId=?", [u.id]);
      await p.execute("DELETE FROM extraIncomes WHERE userId=?", [u.id]);
      await p.execute("UPDATE expenses SET paid=0 WHERE userId=? AND recurring=1", [u.id]);

      console.log(`✅ Auto-rollover: usuário ${u.id} → ${prevMonthKey}`);
    }
  } catch (e: any) { console.error("checkMonthRollover:", e.message); }
}

const PORT = parseInt(String(process.env.PORT || "3000"), 10);
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🪙 MoneyGame porta ${PORT}`);
  try { await runMigrations(); } catch (e: any) { console.error("Migration warning:", e.message); }
  // Checagem a cada hora
  setInterval(checkMonthRollover, 60 * 60 * 1000);
});
