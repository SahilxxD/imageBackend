// Improved business logic for uploaded files
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises"; // Use promises version
import ImageKit from "imagekit";
import path from "path";
import { generateSystemPrompt } from "./systemPrompt.js";

export const preProcessImage = async (file, data) => {
    if (!file) {
        throw new Error("No file uploaded");
    }
    if (!data || !data.type || !data.product) {
        throw new Error("Vibe or product is not provided");
    }

    const { environment = null, type, batchSize = 1, product = 'this product' } = data;

    if (type !== "flat-lay" && type !== "on-model") {
        throw new Error("Invalid type provided");
    }

    // Validate batchSize
    if (batchSize < 1 || batchSize > 4) { // Set reasonable limits
        throw new Error("Batch size must be between 1 and 4");
    }

    let prompt = "Generate a creative image";

    if (type === "flat-lay") {
        prompt = generateSystemPrompt(batchSize, "Flat-lay");
    } else if (type === "on-model") {
        prompt = generateSystemPrompt(batchSize, "on-model", environment);

    }

    console.log("Using prompt:", prompt);


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

    // Clean up file immediately after reading
    try {
        await fs.unlink(file.path);
        console.log("Temp file deleted successfully");
    } catch (err) {
        console.error("Warning: Error deleting temp file:", err);
        // Don't throw here - continue processing
    }

    const resp = await geminiGeneratePrompt(base64, mimeType, prompt);


    if (!resp) {
        throw new Error("No response from Gemini API");
    }

    const generatePromises = [];


    resp.forEach((obj, index) => {
        console.log(`\n=== Object ${index + 1} ===`);

        const varPrompt = formatSimple(obj)
        console.log("Using varied prompt:", varPrompt);
        generatePromises.push(
            generateImage(base64, mimeType, varPrompt, index + 1, type)
                .catch(error => {
                    console.error(`Error generating image ${index + 1}:`, error);
                    return { error: error.message, index: index + 1 };
                })
        );

        console.log('-------------------'); // Separator between objects
    });


    try {
        const results = await Promise.allSettled(generatePromises);

        // Separate successful and failed results
        const successful = [];
        const failed = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && !result.value.error) {
                successful.push(result.value);
            } else {
                const errorMsg = result.status === 'rejected'
                    ? result.reason?.message || 'Unknown error'
                    : result.value.error;
                failed.push({ index: index + 1, error: errorMsg });
            }
        });

        return {
            batchSize,
            type,
            environment,
            successful: successful.length,
            failed: failed.length,
            results: successful,
            errors: failed
        };
    } catch (error) {
        console.error("Error in batch processing:", error);
        throw new Error("Batch processing failed");
    }
};

export const generateImage = async (base64Data, mimeType, prompt, imageIndex = 1) => {
    if (!base64Data || !mimeType || !prompt) {
        throw new Error("Missing required parameters for image generation");
    }

    try {
        const contents = [
            {
                role: "user",
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        ];

        const config = {
            responseModalities: ["IMAGE", "TEXT"],
        };

        const model = "gemini-2.5-flash-image-preview";

        console.log(`Calling the model for image ${imageIndex}`);

        // Call Gemini API with proper error handling
        let response;
        try {
            const ai = new GoogleGenAI({
                apiKey: process.env.GOOGLE_AI_API_KEY // Make sure API key is properly set
            });

            response = await ai.models.generateContent({
                model,
                contents,
                config
            });
        } catch (err) {
            console.error(`Error calling Gemini API for image ${imageIndex}:`, err);
            throw new Error(`Gemini API call failed: ${err.message}`);
        }

        console.log(`Model response received for image ${imageIndex}`);

        // Validate response structure
        if (!response?.candidates?.[0]?.content?.parts) {
            throw new Error("Invalid response structure from the model");
        }

        const parts = response.candidates[0].content.parts;
        if (!parts || parts.length === 0) {
            throw new Error("No content parts found in response");
        }

        // Look for inline data (images) in the response parts
        for (const part of parts) {
            if (part.inlineData) {
                console.log(`Received image data for image ${imageIndex}:`, {
                    mimeType: part.inlineData.mimeType,
                    dataSize: part.inlineData.data ? part.inlineData.data.length : 0
                });

                try {
                    const uploadResult = await SaveToImageKit(
                        part.inlineData,
                        `generated-${Date.now()}-${imageIndex}.png`
                    );
                    console.log(`Successfully uploaded to ImageKit for image ${imageIndex}:`, uploadResult);
                    return { url: uploadResult, imageIndex };
                } catch (err) {
                    console.error(`Error uploading to ImageKit for image ${imageIndex}:`, err);
                    throw new Error(`ImageKit upload failed: ${err.message}`);
                }
            }
        }

        throw new Error("No image data found in model response");
    } catch (error) {
        console.error(`generateImage error for image ${imageIndex}:`, error);
        throw error;
    }
};

export const generatePoses = async (data) => {
    console.log("data: ",data)
    if (!data || !data.product || !data.url) {
        throw new Error("product is not provided");
    }

    const { url, product = 'this product', environment = 'default' } = data;

    // Read file once and reuse the buffer
    let fileBuffer;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
        }
        const ab = await res.arrayBuffer(); // safe in Node 18+ or browsers
        fileBuffer = Buffer.from(ab);
    } catch (err) {
        console.error("Failed to download file:", err);
        throw new Error("Failed to read uploaded file from URL");
    }

    // Convert to Base64 once
    const base64 = fileBuffer.toString("base64");
    const mimeType = file.mimetype;

    const generatePromises = [];
    const poses = [
        `Shot with natural grain of a model posing to show side profile of ${product}, keeping ${product}, model and environment exactly same. `,
        `Shot with natural grain of a Model posing showing the back of the ${product}, keeping ${product}, model and environment exactly same.`,
        `Macro-shot with natrual grain of a model reviewing craftmanship of ${product}, keeping ${product}, model and environment exactly same.`,
        `Photorealistic shot with natural grain of model with ${product} sitting on complementary item. Keeping ${product}, model and environment exactly same.`
    ];

    for (let i = 0; i < poses.length; i++) {
        generatePromises.push(generateImage(base64, mimeType, `A ${poses[i]}`));
    }

    try {
        const results = await Promise.allSettled(generatePromises);

        // Separate successful and failed results
        const successful = [];
        const failed = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && !result.value.error) {
                successful.push(result.value);
            } else {
                const errorMsg = result.status === 'rejected'
                    ? result.reason?.message || 'Unknown error'
                    : result.value.error;
                failed.push({ index: index + 1, error: errorMsg });
            }
        });

        return {
            batchSize: 4,
            type: 'on-model',
            environment,
            successful: successful.length,
            failed: failed.length,
            results: successful,
            errors: failed
        };
    } catch (err) {
        console.error("Error generating poses:", err);
        throw new Error("Failed to generate poses");
    }
}

// const saveToImageKit = async (inlineData, destinationName) => {
//     if (!inlineData?.data || !inlineData?.mimeType) {
//         throw new Error("Invalid inline data provided");
//     }

//     try {
//         // Validate environment variables
//         const publicKey = process.env.IMAGE_KIT_PUBLIC_KEY || 'public_GHH9cy6zKklwoVNHhUZGxXtKsZA=';
//         const privateKey = process.env.IMAGE_KIT_PRIVATE_KEY || 'private_rrZyNr36dEGrhkmbiTiyc/wfCPM=';
//         const urlEndpoint = process.env.IMAGE_KIT_URL || 'https://ik.imagekit.io/efhehcx94';

//         if (!publicKey || !privateKey || !urlEndpoint) {
//             throw new Error("ImageKit credentials not properly configured");
//         }

//         const imagekit = new ImageKit({
//             publicKey,
//             privateKey,
//             urlEndpoint
//         });

//         // Prepare base64 data
//         let base64Data = inlineData.data;
//         if (!base64Data.startsWith('data:')) {
//             base64Data = `data:${inlineData.mimeType};base64,${base64Data}`;
//         }

//         console.log('📤 Uploading to ImageKit:', {
//             mimeType: inlineData.mimeType,
//             fileName: destinationName,
//             dataLength: base64Data.length
//         });

//         const uploadOptions = {
//             file: base64Data,
//             fileName: path.basename(destinationName),
//             useUniqueFileName: true,
//             folder: "/generated-images", // Organize uploads in folders
//             // Add retry logic for failed uploads
//             transformation: {
//                 pre: '',
//                 post: [{
//                     type: 'transformation',
//                     value: 'q-80' // Compress to 80% quality to save space
//                 }]
//             }
//         };

//         const imagekitResponse = await imagekit.upload(uploadOptions);

//         console.log('✅ Uploaded to ImageKit:', imagekitResponse.url);
//         return imagekitResponse.url;

//     } catch (error) {
//         console.error('❌ Error uploading to ImageKit:', {
//             message: error.message,
//             response: error.response?.data,
//             stack: error.stack
//         });

//         // Provide more specific error messages
//         if (error.message.includes('Invalid file')) {
//             throw new Error('Invalid image file format for ImageKit upload');
//         } else if (error.message.includes('credentials')) {
//             throw new Error('ImageKit authentication failed - check your credentials');
//         }

//         throw error;
//     }
// };

// Optional: Add retry logic for failed operations
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
};

// Usage example with retry:
// const result = await retryOperation(() => saveToImageKit(inlineData, fileName));
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

const formatSimple = (obj) => {
    let result = '';

    for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
            result += `${key}: ${value}\n\n`; // Double \n for single line space
        }
    }

    return result.trim(); // Remove trailing newlines
}


export const geminiGeneratePrompt = async (file, mimeType, sysInst) => {
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
              Analyze the image.
            `.trim(),
                    },
                ],
                config: {
                    responseMimeType: "application/json",
                    systemInstruction: sysInst.trim(),
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

        let parsed;
        try {
            // Try to parse directly first (most common case)
            parsed = JSON.parse(text);
        } catch (err) {
            try {
                // If that fails, try to extract JSON (array or object)
                const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No valid JSON found in response");
                }
            } catch (parseErr) {
                console.error("JSON parsing failed:", parseErr);
                console.error("Original text:", text);
                throw new Error("Failed to parse Gemini response as JSON");
            }
        }

        return parsed;
    } catch (error) {
        console.error("processFile error:", error);
        throw error; // Let controller decide how to respond
    }
};
