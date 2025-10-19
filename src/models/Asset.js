import { Environment } from '@google/genai';
import mongoose from 'mongoose';

const AssetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  inputUrl: {
    type: String,
    // required: true,
  },
  prompt: {
    type: String,
  },
  type: {
    type: String,
    required: true,
  },
  environment: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Asset = mongoose.model('Asset', AssetSchema);
export default Asset;
