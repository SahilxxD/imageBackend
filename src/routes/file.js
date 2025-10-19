import express from "express";
import upload from "../config/multer.js";
import { uploadFile } from "../controllers/file.js";
import { generateImage } from "../controllers/generate.js";
import { protect } from "../middleware/authMiddleware.js";
import { poses } from "../controllers/generatePoses.js";
import { generateSeedream } from "../controllers/generateSeedream.js";

const router = express.Router();

router.post("/upload", protect, upload.any(), uploadFile);
router.post("/generateImage", protect, upload.any(), generateImage);
router.post("/generateImageNew", upload.any(), generateSeedream);
router.post("/generatePoses", protect, upload.any(), poses);


export default router;
