import express from "express";
import fileRoutes from "./routes/file.js";
import cors from "cors";

const app = express();
// ✅ CORS setup
app.use(
    cors({
        origin: "http://localhost:5173", // your React app’s URL
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    })
);
// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", fileRoutes);

export default app;
