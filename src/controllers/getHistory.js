import Asset from "../models/Asset.js";

export const History = async (req, res) => {
    try {
        const user = req.user && req.user._id;
        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Optionally return recent history (useful for client)
        const history = await Asset.find({ user })
            .lean()
            .select("-prompt")
            .sort({ createdAt: -1 })
            .limit(20);

        if (!history || history.length <= 0) {
            return res.status(404).json({ success: false, message: "No history found" });
        }

        return res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            data: history,
        });
    } catch (error) {
        console.error("History error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "History get failed",
        });
    }
};
