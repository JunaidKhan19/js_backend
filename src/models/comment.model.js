import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema({
    content : {
        type : String,
        required : true
    },
    video : {
        type : Schema.Types.ObjectId,
        ref : "Video"
    },
    owner : {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    replies : [{
        id  : Schema.Types.ObjectId,
        ref : 'Comment',
        default : null
    }],
    repliesTo : [{
        id  : Schema.Types.ObjectId,
        ref : 'Comment',
        default : null
    }],
    likes : [{
        id  : Schema.Types.ObjectId,
        ref : 'User'
    }],
    dislikes : [{
        id  : Schema.Types.ObjectId,
        ref : 'User'
    }],
    mentions : [{
        id : Schema.Types.ObjectId,
        ref : 'User'
    }],
},{timestamps : true})

commentSchema.plugin(mongooseAggregatePaginate)

/*
// Virtual for counting replies
commentSchema.virtual('repliesCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'parentComment',
    count: true
});

// Pre-save hook for sanitizing content
commentSchema.pre('save', function(next) {
    if (this.content) {
        this.content = sanitizeHtml(this.content);
    }
    next();
});
*/

export const Comment = mongoose.model("Comment", commentSchema)