import { preProcessImage } from "../services/generateImage.js";
import fs from "fs";

export const generateImage = async (req, res) => {
    try {


        const fileData = await preProcessImage(req.file, req.body);


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
