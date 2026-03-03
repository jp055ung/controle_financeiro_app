import express from "express";
import cors from "cors";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and } from "drizzle-orm";
import { users, expenses, creditCardExpenses, extraIncomes } from "../drizzle/schema.js";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist/client"));

let db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!db && process.env.DATABASE_URL) {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    db = drizzle(pool);
  }
  return db;
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    const existing = await database.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return res.status(400).json({ error: "Email ja cadastrado" });
    await (database.insert(users) as any).values({ name, email, password });
    const user = await database.select().from(users).where(eq(users.email, email)).limit(1);
    res.json({ user: { id: user[0].id, name: user[0].name, email: user[0].email } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    const result = await database.select().from(users)
      .where(and(eq(users.email, email), eq(users.password, password))).limit(1);
    if (result.length === 0) return res.status(401).json({ error: "Credenciais invalidas" });
    const u = result[0];
    res.json({ user: { id: u.id, name: u.name, email: u.email, salaryBase: u.salaryBase, reserveMeta: u.reserveMeta } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put("/api/users/:id/settings", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await (database.update(users) as any).set(req.body).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/users/:userId/expenses", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(expenses).where(eq(expenses.userId, Number(req.params.userId))));
});

app.post("/api/users/:userId/expenses", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    const { categoryId, name, amount, subcategory, dueDate } = req.body;
    await (database.insert(expenses) as any).values({
      userId: Number(req.params.userId), categoryId, name,
      amount: String(amount), subcategory, dueDate: dueDate ? new Date(dueDate) : null, paid: 0,
    });
    res.json(await database.select().from(expenses).where(eq(expenses.userId, Number(req.params.userId))));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/expenses/:id/paid", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await (database.update(expenses) as any).set({ paid: req.body.paid ? 1 : 0 }).where(eq(expenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await database.delete(expenses).where(eq(expenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/users/:userId/credit-card", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(creditCardExpenses).where(eq(creditCardExpenses.userId, Number(req.params.userId))));
});

app.post("/api/users/:userId/credit-card", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await (database.insert(creditCardExpenses) as any).values({
      userId: Number(req.params.userId), description: req.body.description,
      amount: String(req.body.amount), subcategory: req.body.subcategory,
    });
    res.json(await database.select().from(creditCardExpenses).where(eq(creditCardExpenses.userId, Number(req.params.userId))));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/credit-card/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await database.delete(creditCardExpenses).where(eq(creditCardExpenses.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/users/:userId/extra-income", async (req, res) => {
  const database = await getDb();
  if (!database) return res.json([]);
  res.json(await database.select().from(extraIncomes).where(eq(extraIncomes.userId, Number(req.params.userId))));
});

app.post("/api/users/:userId/extra-income", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await (database.insert(extraIncomes) as any).values({
      userId: Number(req.params.userId), description: req.body.description,
      amount: String(req.body.amount), date: new Date(),
    });
    res.json(await database.select().from(extraIncomes).where(eq(extraIncomes.userId, Number(req.params.userId))));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/extra-income/:id", async (req, res) => {
  try {
    const database = await getDb();
    if (!database) return res.status(500).json({ error: "DB indisponivel" });
    await database.delete(extraIncomes).where(eq(extraIncomes.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/init-db", async (_req, res) => {
  try {
    const pool = mysql.createPool(process.env.DATABASE_URL!);
    await pool.execute("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(320) UNIQUE, password VARCHAR(255), salaryBase DECIMAL(10,2) DEFAULT 2300.00, reserveMeta DECIMAL(10,2) DEFAULT 500.00, createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())");
    await pool.execute("CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, name VARCHAR(100) NOT NULL, emoji VARCHAR(10), color VARCHAR(7), budgetAmount DECIMAL(10,2), createdAt TIMESTAMP DEFAULT NOW())");
    await pool.execute("CREATE TABLE IF NOT EXISTS expenses (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, categoryId INT NOT NULL, name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100), paid INT DEFAULT 0, dueDate TIMESTAMP NULL, createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())");
    await pool.execute("CREATE TABLE IF NOT EXISTS creditCardExpenses (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, subcategory VARCHAR(100), createdAt TIMESTAMP DEFAULT NOW(), updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW())");
    await pool.execute("CREATE TABLE IF NOT EXISTS extraIncomes (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, description VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, date TIMESTAMP DEFAULT NOW(), createdAt TIMESTAMP DEFAULT NOW())");
    await pool.end();
    res.json({ success: true, message: "Tabelas criadas com sucesso!" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("*", (_req, res) => {
  res.sendFile("index.html", { root: "dist/client" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FinControl rodando na porta ${PORT}`));
