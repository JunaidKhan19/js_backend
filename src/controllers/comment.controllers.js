import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content){
        throw new ApiError(400, "content is required")
    }

    if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid or missing video ID");
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, "Invalid or missing user ID");
    }

    // Regular expression to find mentions in the format @username
    const mentionRegex = /@(\w+)/g;
    
    // Extract mentioned usernames from the content
    const mentionedUsernames = [...content.matchAll(mentionRegex)].map(match => match[1]);

    // Find users based on the mentioned usernames
    const mentionedUsers = await User.find({ userName: { $in: mentionedUsernames } }).select("_id userName");

    const mentions = mentionedUsers.map(user => ({ userId: user._id, username: user.userName }));

    const comment = await Comment.create({
        content : content,
        video : videoId,
        owner : req.user._id,
        mentions : mentions,
    })

    return res.status(200).json(new ApiResponse(200, comment, "comment added successfully"))
})

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);

    const comments = await Comment.find({ video: videoId })
        .skip((pageInt - 1) * limitInt)
        .limit(limitInt)
        .sort({ createdAt: -1 })
        .populate("owner", "userName avatar"); // Sort by most recent

    // Get the total count of comments for pagination metadata
    const totalComments = await Comment.countDocuments({ video: videoId });

    // Convert the array of comments to an object with commentId as the key
    const commentsObject = comments.reduce((acc, comment) => {
        acc[comment._id] = comment; // Use comment._id as the key
        return acc;
    }, {});

    res.status(200).json(new ApiResponse(200, {
        commentsObject,  // Return comments as an object
        page: pageInt,
        totalPages: Math.ceil(totalComments / limitInt),
        totalComments: totalComments
    }));
    /*
    res.status(200).json(new ApiResponse(200, {
        data: comments,
        page: pageInt,
        totalPages: Math.ceil(totalComments / limitInt),
        totalComments : totalComments
    }));
    */
});

const getComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not valid comment id")
    }

    const comment = await Comment.findById(commentId)
                                .populate("owner", "username fullName avatar")
                                .populate("video", "title description thumbnail")
    
    if (!comment){
        throw new ApiError(400, "not valid comment" )
    }
    
    return res.status(200).json(new ApiResponse(200, comment, "comment fetched successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not valid comment id")
    }

    const updateData = {};
    if (content) updateData.content = content;
    
    const mentionRegex = /@(\w+)/g;
    const mentionedUsernames = [...content.matchAll(mentionRegex)].map(match => match[1]);
    const mentionedUsers = await User.find({ userName: { $in: mentionedUsernames } }).select("_id userName");
    const mentions = mentionedUsers.map(user => ({ userId: user._id, username: user.userName }));

    if (mentions) updateData.mentions = mentions;

    const comment = await Comment.findByIdAndUpdate(
        commentId,
        { $set : updateData},
        { new : true }
    )

    if (!comment){
        throw new ApiError(400, "not valid comment")
    }

    return res.status(200).json(new ApiResponse(200, comment, "comment updated successfully"))
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not a valid comment id")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(400, "not valid comment");
    }

    if (comment.repliesTo){
        await Comment.findByIdAndUpdate(comment.repliesTo, { $pull: { replies: commentId } });
        /* working explained:
        const originalComment = await Comment.findById(comment.repliesTo)
        if (originalComment){
            originalComment.replies.pull(commentId)
            await originalComment.save()
        }
        */
    }
    await comment.deleteOne()

    return res.status(200).json(new ApiResponse(200, comment, "comment deleted successfully"))
})

const likeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID.");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found.");
    }

    const userId = req.user._id;

    // Check if the user already liked or disliked the comment
    const alreadyLiked = comment.likes.some(like => like._id.toString() === userId.toString());
    const alreadyDisliked = comment.dislikes.some(dislike => dislike._id.toString() === userId.toString());

    if (alreadyLiked) {
        return res.status(200).json(new ApiResponse(200, {}, "You have already liked the comment."));
    }

    // Handle dislike removal or adding like
    if (alreadyDisliked) {
        comment.dislikes.pull(userId);
    } else {
        comment.likes.push(userId);
    }

    await comment.save();
    await comment.populate("likes", "userName fullName email");

    const updatedComment = {
        ...comment.toObject(),
        liked_by: comment.likes,
        total_likes: comment.likes.length
    };

    return res.status(200).json(new ApiResponse(200, { 
        comment: updatedComment 
    }, "Comment liked successfully."));
});


const dislikeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID.");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found.");
    }

    const userId = req.user._id;

    // Check if the user already liked or disliked the comment
    const alreadyLiked = comment.likes.some(like => like._id.toString() === userId.toString());
    const alreadyDisliked = comment.dislikes.some(dislike => dislike._id.toString() === userId.toString());

    if (alreadyDisliked) {
        return res.status(200).json(new ApiResponse(200, {}, "You have already disliked the comment."));
    }

    // Handle like removal or adding dislike
    if (alreadyLiked) {
        comment.likes.pull(userId);
    } else {
        comment.dislikes.push(userId);
    }

    await comment.save();
    await comment.populate("dislikes", "userName fullName email");

    const updatedComment = {
        ...comment.toObject(),
        disliked_by: comment.dislikes,
        total_dislikes: comment.dislikes.length
    };
    
    return res.status(200).json(new ApiResponse(200, { 
        comment: updatedComment 
    }, "Comment disliked successfully."));
});

const replyComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params // from url get the main comment id
    const { content } = req.body //from form data get the content of reply to be posted

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not a valid comment Id")
    }
    
    const comment = await Comment.findById(commentId) //finding main commenton through id

    if (!content){
        throw new ApiError(400, "not a valid comment")
    }

    const reply = await Comment.create({
        content,        
        owner : req.user._id,
        repliesTo : commentId //main comment id referenced in the repliesTo
    })

    //Ensure if repliesTo array exist and is an array 
    comment.replies = comment.replies || [] //initialize if undefined

    //push the reply id to the replies field of main comment array and save
    comment.replies.push(reply._id)
    await comment.save()

    //populate the main comment replies field
    await comment.populate({
        path : "replies",
        select : "content userName fullName email"
    })

    return res.status(200).json(new ApiResponse(200, { reply }, "reply added successfully"))
})

const getreply = asyncHandler(async (req, res) => {  
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Not a valid comment ID");
    }

    const replylist = await Comment.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(commentId),
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "replies",
                foreignField: "_id",
                as: "replies",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        userName: 1,
                                        email: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",
                    },
                ],
            },
        },
        {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                likesCount: { $size: "$likes" },
                replies: 1,
            },
        },
    ]);

    if (!replylist || replylist.length === 0) {
        throw new ApiError(400, "No replies found");
    }
    
    const repliesArray = replylist[0]?.replies || [];

    return res.status(200).json(
        new ApiResponse(200, repliesArray, "Replies fetched successfully")
    );

    /* convert replies from array to object
    const replyObject = replylist[0].replies.reduce((acc, reply) => {
        if (reply._id) {
            acc[reply._id.toString()] = reply; // Use toString() to ensure keys are strings
        }
        return acc;
    }, {});

    return res.status(200).json(
        new ApiResponse(200, { replies: replyObject }, "Replies fetched successfully")
    );*/
});

export {
    addComment,
    getComment,
    getVideoComments,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment,
    replyComment,
    getreply
}