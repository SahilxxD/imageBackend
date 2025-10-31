import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises"; // Use promises version
import ImageKit from "imagekit";
import path from "path";
import { generateSystemPrompt, seedreamPrompt } from "./systemPrompt.js";
import axios from "axios";


export const seedream = async (file, refPrompt) => {
    if (!file) {
        throw new Error("No file uploaded");
    }
    // if (!data) {
    //     throw new Error("Vibe or product is not provided");
    // }
    let prompt = "Generate a creative image";

    prompt = seedreamPrompt();


    // Read file once and reuse the buffer
    let fileBuffer;
    try {
        fileBuffer = await fs.readFile(file.path);
    } catch (err) {
        console.error("Failed to read uploaded file:", err);
        throw new Error("Failed to read uploaded file from disk");
    }

    // Convert to Base64 once
    const base64 = fileBuffer.toString("base64");
    const mimeType = file.mimetype;
    let link;
    try {
        link = await SaveToImageKit({ data: base64, mimeType }, `upload-${Date.now()}.jpg`);
    } catch (error) {
        console.error("❌ Image generation failed:", error.message);
        return {
            successful: 0,
            failed: 1,
            results: [],
            errors: [{ index: 1, error: error.message }],
            prompt: prompt,
            type,
            environment,
        };
    }

    // Clean up file immediately after reading
    try {
        await fs.unlink(file.path);
        console.log("Temp file deleted successfully");
    } catch (err) {
        console.error("Warning: Error deleting temp file:", err);
        // Don't throw here - continue processing
    }

    const resp = await geminiGeneratePrompt(base64, mimeType, prompt, refPrompt);
    console.log('this is the prompt generate: ',resp);
    console.log('prompt used: ',refPrompt);
    return 

    if (!resp) {
        throw new Error("No response from Gemini API");
    }

    let imageResult;
    try {
        imageResult = await generateImage(link, resp);
        console.log("✅ Image generation successful:", imageResult.arkUrl);
    } catch (error) {
        console.error("❌ Image generation failed:", error.message);
        return {
            successful: 0,
            failed: 1,
            results: [],
            errors: [{ index: 1, error: error.message }],
            prompt: resp,
            type,
            environment,
        };
    }
    return {
        successful: 1,
        failed: 0,
        results: [imageResult],
        errors: [],
        prompt: resp
    };
}

export const geminiGeneratePrompt = async (file, mimeType, sysInst, refPrompt) => {
    if (!file) {
        throw new Error("No file uploaded");
    }

    try {

        // 1) Call Gemini API with the image data
        let response;
        try {
            const ai = new GoogleGenAI({});
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash-lite",
                contents: [
                    {
                        inlineData: {
                            mimeType,
                            data: file,
                        },
                    },
                    {
                        text: `
                        Reference prompt:
                        "
                        ${refPrompt}
                        "

                        TASK:
                        Analyze the uploaded image and generate a new prompt written in the exact same descriptive format and tone as the reference prompt above.

                        REQUIREMENTS:
                        - Update the outfit details to match the clothing and accessories visible in the uploaded image.
                        - Maintain the same structure, flow, and professional tone as the reference prompt.
                        - The background must always be a solid-color or smooth gradient **studio backdrop**, not a real-world texture or environment (e.g., no wood, fabric, wall, or location-based backgrounds).
                        - Choose a background color that contrasts powerfully and professionally with the outfit colors.
                        - Keep lighting as soft, even studio lighting with natural detail retention.
                        - Do not include any conversational or explanatory text.
                        - The output must be a single clean text string containing only the generated prompt.
                        `.trim(),
                    },
                ],
                config: {
                    systemInstruction: sysInst,
                },
            });
        } catch (err) {
            throw new Error(`Gemini API call failed: ${err.message}`);
        }

        if (!response || !response.text) {
            throw new Error("Gemini API returned empty response");
        }

        let text = response.text;
        console.log("Gemini response:", text);

        text = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");

        // let parsed;
        // try {
        //     // Try to parse directly first (most common case)
        //     parsed = JSON.parse(text);
        // } catch (err) {
        //     try {
        //         // If that fails, try to extract JSON (array or object)
        //         const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        //         if (jsonMatch) {
        //             parsed = JSON.parse(jsonMatch[0]);
        //         } else {
        //             throw new Error("No valid JSON found in response");
        //         }
        //     } catch (parseErr) {
        //         console.error("JSON parsing failed:", parseErr);
        //         console.error("Original text:", text);
        //         throw new Error("Failed to parse Gemini response as JSON");
        //     }
        // }

        return text;
    } catch (error) {
        console.error("processFile error:", error);
        throw error; // Let controller decide how to respond
    }
};

export const generateImage = async (
    link,
    prompt,
    size = "4096x4096",
    uploadToImageKit = false
) => {
    console.log("Generating image with link:", link);
    if (!link || !prompt) {
        throw new Error("Missing required parameters: link and prompt");
    }

    const API_URL =
        "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";
    const API_KEY = process.env.SEEDREAM_API_KEY; // set this in your env

    if (!API_KEY) {
        throw new Error(
            "Missing ARK_API_KEY environment variable. Set process.env.ARK_API_KEY to your Bearer token."
        );
    }

    const payload = {
        model: "seedream-4-0-250828",
        prompt,
        image: link,
        sequential_image_generation: "disabled",
        response_format: "url",
        size,
        stream: false,
        watermark: false,
    };

    try {
        const resp = await axios.post(API_URL, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            timeout: 120000, // 2 minutes
        });

        const data = resp.data;
        // sample shape you provided: { data: [ { url: "...", size: "..." } ] }
        const arkUrl =
            data?.data && Array.isArray(data.data) && data.data[0] && data.data[0].url
                ? data.data[0].url
                : data?.url || null;

        if (!arkUrl) {
            throw new Error(
                `No generated image URL found in ARK response. Response: ${JSON.stringify(
                    data
                ).slice(0, 2000)}`
            );
        }
        console.log("Generated image URL from ARK:", arkUrl);
        let imageKitUrl = null;

        if (uploadToImageKit) {
            // Download the image as binary
            const imageResp = await axios.get(arkUrl, { responseType: "arraybuffer" });

            // Determine mimeType from headers or fallback to jpeg
            const mimeType =
                (imageResp.headers && imageResp.headers["content-type"]) ||
                "image/jpeg";

            // convert to base64 so SaveToImageKit can accept inlineData similar to your earlier code
            const base64Data = Buffer.from(imageResp.data, "binary").toString("base64");

            const inlineData = {
                data: base64Data,
                mimeType,
            };

            // SaveToImageKit should be available in your codebase (you used it before)
            // it should accept an object like { data: base64, mimeType } and a filename
            try {
                const filename = `generated-${Date.now()}.jpg`;
                imageKitUrl = await SaveToImageKit(inlineData, filename);
            } catch (uploadErr) {
                // If upload fails, keep arkUrl in the result and expose the upload error
                console.error("SaveToImageKit upload error:", uploadErr);
                throw new Error(`ImageKit upload failed: ${uploadErr.message || uploadErr}`);
            }
        }

        return { arkUrl, imageKitUrl, raw: data, link, prompt };
    } catch (err) {
        // include response body when available for debugging
        const debug = err.response?.data ?? err.message;
        console.error("generateImage error:", debug);
        throw new Error(`ARK API request failed: ${JSON.stringify(debug)}`);
    }
};


const SaveToImageKit = async (inlineData, destinationName) => {
    try {
        const imagekit = new ImageKit({
            publicKey: process.env.IMAGE_KIT_PUBLIC_KEY || 'public_GHH9cy6zKklwoVNHhUZGxXtKsZA=',
            privateKey: process.env.IMAGE_KIT_PRIVATE_KEY || 'private_rrZyNr36dEGrhkmbiTiyc/wfCPM=',
            urlEndpoint: process.env.IMAGE_KIT_URL || 'https://ik.imagekit.io/efhehcx94'
        });

        // Extract the base64 data from the inlineData object
        // The inlineData structure is: { mimeType: 'image/png', data: 'base64string' }
        let base64Data = inlineData.data;

        // Ensure the base64 data has the proper data URL format for ImageKit
        // ImageKit expects: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        if (!base64Data.startsWith('data:')) {
            base64Data = `data:${inlineData.mimeType};base64,${base64Data}`;
        }

        console.log('📤 Uploading to ImageKit:', {
            mimeType: inlineData.mimeType,
            fileName: destinationName,
            dataLength: base64Data.length
        });

        const imagekitResponse = await imagekit.upload({
            file: base64Data,              // pass the formatted base64 data URL string
            fileName: path.basename(destinationName),
            useUniqueFileName: true,
            // optional: specify folder
            // folder: "/your-folder-name"
        });

        console.log('✅ Uploaded to ImageKit:', imagekitResponse.url);
        return imagekitResponse.url;

    } catch (error) {
        console.error('❌ Error uploading to ImageKit:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });
        throw error;
    }
};
