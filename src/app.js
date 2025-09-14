import express from "express";
import fileRoutes from "./routes/file.js";

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", fileRoutes);

export default app;
