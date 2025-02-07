// import dotenv from 'dotenv';
// dotenv.config();
import dotenv from "dotenv";
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import pg from 'pg';


const app = express();
const PORT = 5000;

app.use(bodyParser.json());

app.use(
    cors({
      origin: function (origin, callback) {
        const allowedOrigins = ["http://localhost:3000", "http://localhost:5173"];
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
  


const client = new pg.Client({
  user: process.env.REACT_APP_DB_USER,
  host: process.env.REACT_APP_DB_HOST,
  database: process.env.REACT_APP_DB_NAME,
  password: process.env.REACT_APP_DB_PASSWORD,
  port: process.env.REACT_APP_DB_PORT,
});


client.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch(err => console.error("Database connection error:", err));


  

app.post('/signup', async (req, res) => {
  const { name, emailid, password } = req.body;
  if (!emailid || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const userExists = await client.query('SELECT * FROM "users" WHERE email = $1', [emailid]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query(
      'INSERT INTO "users" (name, email, password) VALUES ($1, $2, $3)',
      [name, emailid, hashedPassword]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

  app.post("/signin", async (req, res) => {
    const { emailid, password } = req.body;
    try {
      const userExists = await client.query('SELECT * FROM "users" WHERE email = $1', [emailid]);
      if (userExists.rows.length === 0) {
        return res.status(400).json({ message: "No such user" });
      }
      const user = userExists.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid password" });
      }
      res.json({
        message: "Login successful",
        user: user.id,
      });
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  
  app.post("/gettasks", async (req, res) => {
    const {userId} = req.body;
    try {
      const tasksfirst = await client.query('SELECT title, id, priority FROM "tasks" WHERE userid = $1 ORDER BY id', [userId]);
      res.status(201).json({ tasksfirst: tasksfirst.rows});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/getdetails", async (req, res) => {
    const {taskId} = req.body;
    try {
      const taskdetails = await client.query('SELECT taskdetails, title FROM "tasks" WHERE id = $1', [taskId]);
      res.status(201).json({ taskdetails: taskdetails.rows});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });


  app.post("/updatetaskdetails", async (req, res) => {
    const {taskId, details} = req.body;
    try {
      const taskdetails = await client.query('UPDATE tasks SET taskdetails = $1 WHERE id = $2', [details, taskId]);
      res.status(201).json({message: "Task details updated succesfully"});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });


  app.post("/home", async (req, res) => {
    const { user, work, dropvalue, details} = req.body;
    try {
    await client.query(
        'INSERT INTO "tasks" (userid, title, priority, taskdetails) VALUES ($1, $2, $3, $4)',
        [user, work, dropvalue, details]
      );
      const tasksAfterAdd = await client.query('SELECT title, id FROM "tasks" WHERE userid = $1 ORDER BY id', [user]);
      res.status(201).json({ tasksAfterAdd: tasksAfterAdd.rows, message: "Task inserted successfully"});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });




  app.post("/edit", async (req, res) => {
    const {editedTitle, id, userId, editedpriority} = req.body;
    console
    try {
      await client.query('UPDATE tasks SET title = $1, priority = $2 WHERE id = $3', [editedTitle, editedpriority, id]);
      const tasksAfterEdit = await client.query('SELECT title, id FROM "tasks" WHERE userid = $1 ORDER BY id', [userId]);
      res.status(201).json({ tasksAfterEdit: tasksAfterEdit.rows, message: "Task Edited successfully"});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });


  app.post("/delete", async (req, res) => {
    const {userId, id}= req.body;
    try {
      await client.query('DELETE FROM tasks WHERE id = $1', [id]);
      const tasksAfterDelete= await client.query('SELECT title, id FROM "tasks" WHERE userid = $1 ORDER BY id', [userId]);
      res.status(201).json({ tasksAfterDelete: tasksAfterDelete.rows, message: "Task Deleted successfully"});
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });




app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


process.on('SIGINT', async () => {
  await client.end();
  console.log("Database connection closed.");
  process.exit();
});
