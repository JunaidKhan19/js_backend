import dotenv from 'dotenv';
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import {app} from "../src/app.js"


// Debugging to check if dotenv is loaded
//console.log('Loading dotenv...');
dotenv.config({ path: '../js_backend/.env' });
//console.log('dotenv loaded');

// mongodb_uri and PORT are the environment variables and must be written in .env file
//but i have written it here bcauz the .env was not loading in the index.js
//const mongodb_uri = 'mongodb+srv://khanjunaid1719:Junaid123@cluster0.prf9s.mongodb.net';
const PORT = 3000;

//this is approach 1 to connect db in index file 
//approach 2 is by writing in the db/connectiondb.js and importing it here
( async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n DB host: ${connectionInstance.connection.host}`)
        app.on("error" , (error) => {
            console.log("ERROR: " , error);
            throw error
        })
        app.listen(PORT, () => {
            console.log(`App is listening on port: ${PORT}`)
        })
    } catch (error) {
        console.log("ERROR: " , error)
        throw error
    }
})()