import express from 'express';
import { getAllClients, getClientAssetHistory } from '../controllers/client.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getAllClients);
router.get('/:clientId/assets', protect, getClientAssetHistory);

export default router;
