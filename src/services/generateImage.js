// Improved business logic for uploaded files
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises"; // Use promises version
import ImageKit from "imagekit";
import path from "path";

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
        prompt = `
        Professional flat lay photography of a ${product} laid flat on complementary background, styled with complementary items, overhead shot, natural lighting, clean complementary background, commercial fashion photography, Instagram-worthy composition, 25% negative space for clean aesthetic
        `.trim();
    } else if (type === "on-model") {
        prompt = `
        Photorealistic image of a indian model wearing ${product}, in a dynamic pose maintaining original design of the product. Complementary ${environment} environment and natural lightning.
        `.trim();
    }

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

    // Create promises array with proper error handling
    const generatePromises = [];
    for (let i = 0; i < batchSize; i++) {
        generatePromises.push(
            generateImage(base64, mimeType, prompt, i + 1)
                .catch(error => {
                    console.error(`Error generating image ${i + 1}:`, error);
                    return { error: error.message, index: i + 1 };
                })
        );
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
            prompt,
            batchSize,
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

