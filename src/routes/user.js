import express from "express";
import { History } from "../controllers/getHistory.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", protect, History);



export default router;
