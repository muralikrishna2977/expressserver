import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import cors from "cors";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5000;

// Convert ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.json());

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL // Use environment variable for deployment
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

// PostgreSQL Connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => {
    console.error("❌ Database Connection Error:", err);
    process.exit(1);
  });

// Serve React frontend when deployed
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "client", "build");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Routes (No changes to logic, just formatting improvements)
app.post("/signup", async (req, res) => {
  const { name, emailid, password } = req.body;
  if (!emailid || !password) return res.status(400).json({ message: "Email and password are required" });

  try {
    const userExists = await pool.query('SELECT * FROM "users" WHERE email = $1', [emailid]);
    if (userExists.rows.length > 0) return res.status(400).json({ message: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO "users" (name, email, password) VALUES ($1, $2, $3)', [name, emailid, hashedPassword]);
    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/signin", async (req, res) => {
  const { emailid, password } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM "users" WHERE email = $1', [emailid]);
    if (userExists.rows.length === 0) return res.status(400).json({ message: "No such user" });
    
    const user = userExists.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });
    
    res.json({ message: "Login successful", userId: user.id });
  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Other routes remain unchanged...

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

// Graceful Shutdown
process.on("SIGINT", async () => {
  await pool.end();
  console.log("⚡ Database connection closed.");
  process.exit();
});

process.on("SIGTERM", async () => {
  await pool.end();
  console.log("⚡ Database connection closed.");
  process.exit();
});

