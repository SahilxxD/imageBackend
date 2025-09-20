import passport from 'passport';
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google ID:', profile.id);
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null, // Added profilePicture
                credits: 10 // Assign default credits to new users
            })
            await user.save();
        } else {
            // If user exists, update their profile picture if it's not already set or if it has changed
            if (!user.profilePicture && profile.photos && profile.photos.length > 0) {
                user.profilePicture = profile.photos[0].value;
                await user.save();
            }
        }

        return done(null, user)
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findOne({ _id: id });  // Pass the id inside an object
    done(null, user);
});