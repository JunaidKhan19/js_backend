import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema({
    video : {
        id : Schema.Types.ObjectId,
        ref : "Video"
    },
    comment : {
        id : Schema.Types.ObjectId,
        ref : "Comment"
    },
    tweeet : {
        id : Schema.Types.ObjectId,
        ref : "Tweet"
    },
    likedby : {
        id : Schema.Types.ObjectId,
        ref : "User"
    },
},{timestamps : true})

export const Like = mongoose.model("Like", likeSchema)