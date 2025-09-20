import express from "express";
import upload from "../config/multer.js";
import { uploadFile } from "../controllers/file.js";
import { generateImage } from "../controllers/generate.js";
import { protect } from "../middleware/authMiddleware.js";
import { poses } from "../controllers/generatePoses.js";

const router = express.Router();

router.post("/upload", protect, upload.single("file"), uploadFile);
router.post("/generateImage", protect, upload.single("file"), generateImage);
router.post("/generatePoses", protect, poses);


export default router;
