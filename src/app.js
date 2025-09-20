import express from "express";
import fileRoutes from "./routes/file.js";
import cors from "cors";
import auth from "./routes/auth.js";
import passport from "passport";  // <-- you missed this
import session from 'express-session';
import dotenv from 'dotenv';
import "./config/passport.js"; // 👈 important: loads the strategy
import { connectDB } from './config/db.js';
import user from "./routes/user.js";


dotenv.config();
connectDB();


const app = express();

app.use(express.json())

app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());


// ✅ CORS setup
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://image-r85d.vercel.app", // your Vercel frontend
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", fileRoutes, auth, user);


export default app;
