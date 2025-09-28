import { generatePoses } from "../services/generateImage.js";
import User from "../models/User.js";
import Asset from "../models/Asset.js";

export const poses = async (req, res) => {
    console.log('User making request:', req.user);
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!req.url) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const requestedImages = 4;
    if (user.credits < requestedImages) {
        return res.status(402).json({ success: false, message: "Insufficient credits" });
    }

    // Immediately deduct credits and update usage stats
    user.credits -= requestedImages;
    user.creditsUsed += requestedImages;
    await user.save();

    try {
        // Call the image generation service
        const fileData = await generatePoses(req);

        // If generation was partially or fully successful, record the assets
        if (fileData.successful > 0) {
            const newAssets = [];
            for (const result of fileData.results) {
                const newAsset = new Asset({
                    user: user._id,
                    imageUrl: result.url,
                    prompt: fileData.prompt,
                    type: fileData.type,
                    environment: fileData.environment
                });
                await newAsset.save();
                newAssets.push(newAsset._id);
            }
            user.assets.push(...newAssets);
        }

        // If some images failed to generate, refund credits and update refund stats
        const failedCount = requestedImages - fileData.successful;
        if (failedCount > 0) {
            user.credits += failedCount;
            user.creditsRefunded += failedCount;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Poses generation complete",
            data: fileData,
            remainingCredits: user.credits,
        });

    } catch (error) {
        // If the entire process fails, refund credits and update refund stats
        user.credits += requestedImages;
        user.creditsRefunded += requestedImages;
        await user.save();

        res.status(500).json({
            success: false,
            message: `Image generation failed: ${error.message}`,
            remainingCredits: user.credits,
        });
    }
};
