import { seedream } from "../services/seedream.js";
import Client from "../models/Client.js";
import Asset from "../models/Asset.js";

export const generateSeedream = async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded.",
            });
        }

        if (files.length > 10) {
            return res.status(400).json({
                success: false,
                message: "You can process a maximum of 10 images at a time.",
            });
        }

        if (!req.body.clientId) {
            return res.status(400).json({
                success: false,
                message: "Client ID is required.",
            });
        }

        const client = await Client.findById(req.body.clientId);
        if (!client) {
            return res.status(400).json({
                success: false,
                message: "Client not found.",
            });
        }

        const generationPromises = files.map(file => seedream(file, client.refPrompt));
        const results = await Promise.all(generationPromises);
        console.log("Seedream generation results:", results);
        const allFileData = results.reduce((acc, fileData) => {
            if (fileData) {
                acc.successful += fileData.successful;
                acc.results.push(...fileData.results);
                acc.prompt = fileData.prompt;
                acc.link = fileData.link;
            }
            return acc;
        }, { successful: 0, results: [] });

        if (allFileData.successful > 0) {
            const newAssets = [];
            for (const result of allFileData.results) {
                const newAsset = new Asset({
                    user: client._id, // Placeholder user
                    imageUrl: result.arkUrl,
                    prompt: allFileData.prompt,
                    type: 'seedream',
                    inputUrl: result.link,
                });
                await newAsset.save();
                newAssets.push(newAsset._id);
            }
            // In a real app, you'd associate these assets with the logged-in user
            // For example: user.assets.push(...newAssets);
            client.assets.push(...newAssets);
            client.creditsUsed += allFileData.successful * 3;
            client.totalCredits += allFileData.successful * 3;
            client.imageGenerated += allFileData.successful;
            await client.save();
        }


        res.status(200).json({
            success: true,
            message: "Image generation process complete.",
            generated: allFileData.successful,
            failed: files.length - allFileData.successful,
            data: allFileData.results,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Image generation failed: ${error.message}`,
        });
    }
};

