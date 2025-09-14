import { processFile } from "../services/file.js";
import fs from "fs";

export const uploadFile = async (req, res) => {
    try {
        const fileData = await processFile(req.file);


        res.status(200).json({
            success: true,
            message: "File uploaded successfully",
            data: fileData,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
