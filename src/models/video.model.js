import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema({
    videofile : {
        type : String, // cloudinary url
        required : true,
    },
    thumbnail : {
        type : String, // cloudinary url
        required : true,
    },
    title : {
        type : String,
        required : true,
    },
    description : {
        type : String,
        required : true,
    },
    duration : {
        type : String, // cloudinary url
        required : true,
    },
    views : {
        type : Number, // cloudinary url
        default : 0,
    },
    ispublished : {
        type : Boolean, // cloudinary url
        default : true,
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    tags: {
        type: [String],
        default: []
    },
    quality: [{
        resolution: String,
        url: String
    }],
    likes: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    dislikes: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    comments: [{
        type: Schema.Types.ObjectId,
        ref: "Comment"
    }]
}, {timestamps : true})

videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema);