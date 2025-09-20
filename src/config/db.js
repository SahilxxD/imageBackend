import mongoose from 'mongoose';
import { MongoClient, ServerApiVersion } from 'mongodb'

export const connectDB = async () => {
    // Create a new MongoClient

    const uri = "mongodb://test:XhiUziVWHIXxwxG0@ac-oavtz3h-shard-00-00.gdgdirm.mongodb.net:27017,ac-oavtz3h-shard-00-01.gdgdirm.mongodb.net:27017,ac-oavtz3h-shard-00-02.gdgdirm.mongodb.net:27017/agency?ssl=true&replicaSet=atlas-jmfuo3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=image";
    mongoose.connect(uri, { dbName: "agency" })
        .then(() => console.log("Mongoose connected"))
        .catch(err => {
            console.error("Mongoose connection error:", err);
            process.exit(1);
        });

}


// mongoose connection