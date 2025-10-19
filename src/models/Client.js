import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
    },
    refPrompt: {
        type: String,
        default: null,
    },
    location: {
        type: String,
        default: null,
    },
    price: {
        type: Number,
        default: 0,
    },
    assets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
    }],
    creditsUsed: {
        type: Number,
        default: 0
    },
    retryCredits: {
        type: Number,
        default: 0
    },
    totalCredits: {
        type: Number,
        default: 0
    },
    imageGenerated: {
        type: Number,
        default: 0
    },
    retryImages: {
        type: Number,
        default: 0
    }
})


// ✅ Export using ES module
const Client = mongoose.model("Client", ClientSchema);
export default Client;
