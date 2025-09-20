import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import User from '../models/User.js';

export const signup = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });

    }

    let { name, email, password, profilePicture } = req.body;

    // Lodash to sanitize input
    name = _.trim(name);
    email = _.toLower(_.trim(email));

    try {
        let user = await User.findOne({ email })
        if (user) {
            return res.status(400).json({ message: "Email already exist!" })
        }

        user = new User({ name, email, password, profilePicture });
        await user.save();
        // Send welcome email
        // await sendEmail(email, 'Welcome to Our Store!', "../templates/welcome.ejs", { name });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        })

        res.status(201).json({
            token: token,
            user: user
        })
    } catch (error) {
        res.status(500).json({ message: 'Server Error' })
    }
};

export const login = async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
        return res.status(400).json({ error: error.array() });
    }

    let { email, password } = req.body;

    // 🛠️ Sanitize email before querying database
    email = _.toLower(_.trim(email));

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' })
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });
        res.status(200).json({
            token: token,
            user: user
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' })
    }
};

export const getMe = async (req, res) => {
    const user = req.user; // The user object is already attached by the protect middleware

    // Calculate initials
    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : '';

    // Format the response
    const formattedUser = {
        name: user.name,
        avatar: user.profilePicture || null, // Use profilePicture as avatar, default to null
        initials: initials,
        credits: user.credits,
        history: user.assets || [],
        showLogo: true // Assuming showLogo is always true for now, or can be configured
    };

    res.status(200).json(formattedUser);
};