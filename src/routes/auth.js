import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { signup, login, getMe } from "../controllers/auth.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", signup);
router.post("/login", login);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/', session: false }), (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
    // Redirect to the frontend with the token in the URL params
    res.redirect(`https://image-r85d.vercel.app?token=${token}`);
});

router.get("/me", protect, getMe);

export default router;
