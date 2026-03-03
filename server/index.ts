import express from "express";
import cors from "cors";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and } from "drizzle-orm";
import { users, expenses, creditCardExpenses, extraIncomes, categories } from "../drizzle/schema.js";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist/client"));

// DB setup
let db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!db && process.env.DATABASE_URL) {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    db = drizzle(pool);
  }
  return db;
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });

    const existing = await database.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "Email já cadastrado" });

    await database.insert(users).values({ name, email, password });
    const user = await database.select().from(users).where(eq(users.email, email)).limit(1);
    res.json({ user: { id: user[0].id, name: user[0].name, email: user[0].email } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });

    const result = await database.select().from(users)
      .where(and(eq(users.email, email), eq(users.password, password))).limit(1);

    if (result.length === 0) return res.status(401).json({ error: "Credenciais inválidas" });
    const user = result[0];
    res.json({ user: { id: user.id, name: user.name, email: user.email, salaryBase: user.salaryBase, reserveMeta: user.reserveMeta } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const { salaryBase, reserveMeta } = req.body;
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    await database.update(users).set({ salaryBase, reserveMeta }).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── EXPENSES ──────────────────────────────────────────────────────────────
app.get("/api/users/:userId/expenses", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  const result = await database.select().from(expenses).where(eq(expenses.userId, Number(req.params.userId)));
  res.json(result);
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    const { categoryId, name, amount, subcategory, dueDate } = req.body;
    await database.insert(expenses).values({
      userId: Number(req.params.userId), categoryId, name,
      amount: String(amount), subcategory, dueDate: dueDate ? new Date(dueDate) : undefined, paid: 0,
    });
    const all = await database.select().from(expenses).where(eq(expenses.userId, Number(req.params.userId)));
    res.json(all);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/expenses/:id/paid", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    await database.update(expenses).set({ paid: req.body.paid ? 1 : 0 }).where(eq(expenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    await database.delete(expenses).where(eq(expenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── CREDIT CARD ───────────────────────────────────────────────────────────
app.get("/api/users/:userId/credit-card", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(creditCardExpenses).where(eq(creditCardExpenses.userId, Number(req.params.userId))));
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    const { description, amount, subcategory } = req.body;
    await database.insert(creditCardExpenses).values({
      userId: Number(req.params.userId), description, amount: String(amount), subcategory,
    });
    res.json(await database.select().from(creditCardExpenses).where(eq(creditCardExpenses.userId, Number(req.params.userId))));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    await database.delete(creditCardExpenses).where(eq(creditCardExpenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── EXTRA INCOME ──────────────────────────────────────────────────────────
app.get("/api/users/:userId/extra-income", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(extraIncomes).where(eq(extraIncomes.userId, Number(req.params.userId))));
});

app.post("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    const { description, amount } = req.body;
    await database.insert(extraIncomes).values({
      userId: Number(req.params.userId), description, amount: String(amount), date: new Date(),
    });
    res.json(await database.select().from(extraIncomes).where(eq(extraIncomes.userId, Number(req.params.userId))));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/extra-income/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponível" });
    await database.delete(extraIncomes).where(eq(extraIncomes.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORIES ────────────────────────────────────────────────────────────
app.get("/api/users/:userId/categories", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(categories).where(eq(categories.userId, Number(req.params.userId))));
});

// ─── DB INIT ───────────────────────────────────────────────────────────────
app.get("/api/admin/init-db", async (_req, res) => {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL!);
    await pool.execute(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(320) UNIQUE, password VARCHAR(255), salaryBase DECIMAL(10,2) DEFAULT 2300.00, reserveMeta DECIMAL(10,2) DEFAULT 500.00, createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, name VARCHAR(100) NOT NULL, emoji VARCHAR(10), color VARCHAR(7), budgetAmount DECIMAL(10,2), createdAt TIMESTAMP DEFAULT NOW())`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS expenses (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, categoryId INT NOT NULL, name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100), paid INT DEFAULT 0, dueDate TIMESTAMP NULL, createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100), createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW(), createdAt TIMESTAMP DEFAULT NOW())`);
    await pool.end();
    res.json({ success: true, message: "Tabelas criadas com sucesso!" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

    await conn.execute(`CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      emoji VARCHAR(10),
      color VARCHAR(7),
      budgetAmount DECIMAL(10,2),
      createdAt TIMESTAMP DEFAULT NOW()
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      categoryId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      subcategory VARCHAR(100),
      paid INT DEFAULT 0,
      dueDate TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT NOW(),
      updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS creditCardExpenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      subcategory VARCHAR(100),
      createdAt TIMESTAMP DEFAULT NOW(),
      updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
    )`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS extraIncomes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      date TIMESTAMP DEFAULT NOW(),
      createdAt TIMESTAMP DEFAULT NOW()
    )`);

    conn.release();
    res.json({ success: true, message: "Banco de dados inicializado!" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "dist/client" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ FinControl rodando na porta ${PORT}`));
