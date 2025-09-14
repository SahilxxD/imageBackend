import express from "express";
import upload from "../config/multer.js";
import { uploadFile } from "../controllers/file.js";
import { generateImage } from "../controllers/generate.js";

const router = express.Router();

router.post("/upload", upload.single("file"), uploadFile);
router.post("/generateImage", upload.single("file"), generateImage);


export default router;
