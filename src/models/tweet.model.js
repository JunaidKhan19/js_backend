import mongoose, { Schema } from "mongoose";

const tweetSchema = new Schema({
    content : {
        type : String,
        required : true
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    retweets: [{
        type: Schema.Types.ObjectId,
        ref: "Tweet"
    }],
    retweetsTo: {
        type: Schema.Types.ObjectId,
        ref: "Tweet"
    }
},{timestamps : true})

export const Tweet = mongoose.model("Tweet", tweetSchema)