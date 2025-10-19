import Client from '../models/Client.js';

export const getAllClients = async (req, res) => {
    try {
        const clients = await Client.find();
        res.status(200).json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getClientAssetHistory = async (req, res) => {
    try {
        const { clientId } = req.params;
        const client = await Client.findById(clientId).populate('assets');

        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json(client.assets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
