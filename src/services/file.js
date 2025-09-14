// Example business logic for uploaded files
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

export const processFile = async (file) => {
    if (!file) {
        throw new Error("No file uploaded");
    }

    try {
        // Extract mime type
        const mimeType = file.mimetype;

        // Read file from disk safely
        let fileBuffer;
        try {
            fileBuffer = fs.readFileSync(file.path);
        } catch (err) {
            throw new Error("Failed to read uploaded file from disk");
        }

        // Convert to Base64
        const base64 = fileBuffer.toString("base64");

        // Delete the file (unlink)
        fs.unlink(file.path, (err) => {
            if (err) {
                console.error("Error deleting temp file:", err);
            } else {
                console.log("Temp file deleted successfully");
            }
        });

        // 1) Call Gemini API with the image data
        let response;
        try {
            const ai = new GoogleGenAI({});
            response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64,
                        },
                    },
                    {
                        text: `
              Analyze the image and identify the product in it. 
              Provide the product name and category in JSON format.
            `.trim(),
                    },
                ],
                config: {
                    responseMimeType: "application/json",
                    systemInstruction: `
            You are a helpful product detection AI. Given an image, you will respond with what type of product it is, like if product in image is a shoe, shirt, cup, dress, pants etc. 
            Be specific like "formal shirt", "urban T-shirt", "linen pants", etc.
            Respond ONLY in JSON format with keys "product" (Must not be too long) and "category".

            JSON OUTPUT FORMAT:
            {
              "product": "string",
              "category": "string"
            }
          `.trim(),
                },
            });
        } catch (err) {
            throw new Error(`Gemini API call failed: ${err.message}`);
        }

        if (!response || !response.text) {
            throw new Error("Gemini API returned empty response");
        }

        // 2) Extract and clean the JSON from Gemini’s response
        let text = response.text;
        text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");

        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch (err) {
            throw new Error("Failed to parse Gemini response as JSON");
        }

        return parsed;
    } catch (error) {
        console.error("processFile error:", error);
        throw error; // Let controller decide how to respond
    }
};
