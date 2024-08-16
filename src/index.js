//import dotenv from 'dotenv';
import mongoose from "mongoose";
//import { printMessage } from './db/connectiondb.js';
import { DB_NAME } from "./constants.js";
import express from "express";

/*
// Debugging to check if dotenv is loaded
console.log('Loading dotenv...');
dotenv.config({ path: './.env' });
console.log('dotenv loaded');
*/

// mongodb_uri and PORT are the environment variables and must be written in .env file
//but i have written it here bcauz the .env was not loading in the index.js
const app = express();
const mongodb_uri = 'mongodb+srv://khanjunaid1719:Junaid123@cluster0.prf9s.mongodb.net/';
const PORT = 3000;
( async () => {
    try {
        const connectionInstance = await mongoose.connect(`${mongodb_uri}/${DB_NAME}`)
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