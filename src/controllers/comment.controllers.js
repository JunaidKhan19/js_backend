import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from '../models/comment.model.js';
import { Video } from "../models/video.model.js";
import { User } from '../models/user.model.js';
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const addComment = asyncHandler(async (req, res) => {
    const { content } = req.body
    const { videoId } = req.params
    const userId = req.user._id

    if (!content){
        throw new ApiError(400, "content is required")
    }
    
    if (!(videoId && userId)){
        throw new ApiError(400, "video and user not found")
    }

    // Regular expression to find mentions in the format @username
    const mentionRegex = /@(\w+)/g;
    
    // Extract mentioned usernames from the content
    const mentionedUsernames = [...content.matchAll(mentionRegex)].map(match => match[1]);

    // Find users based on the mentioned usernames
    const mentionedUsers = await User.find({ username: { $in: mentionedUsernames } })
                                     .select("_id username");

    const mentions = mentionedUsers.map(user => ({ userId: user._id, username: user.username }));

    const comment = await Comment.create({
        content,
        video : videoId,
        owner : req.user._id,
        mentions,
    })

    return res.status(200).json(new ApiResponse(200, comment, "comment added successfully"))
})

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

})

const getComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not valid comment id")
    }

    const comment = await Comment.findById(commentId).populate("owner", "username fullName avatar")
    
    if (!comment){
        throw new ApiError(400, "not valid comment" )
    }
    
    return res.status(200)
              .json(new ApiResponse(200, comment, "comment fetched successfully"))
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content, mentions} = req.body

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not valid comment id")
    }

    const updateData = {};
    if (content) updateData.content = content;
    if (mentions) updateData.mentions = mentions;

    const comment = await Comment.findByIdAndUpdate(
        commentId,
        { $set : updateData},
        { new : true }
    )

    if (!comment){
        throw new ApiError(400, "not valid comment")
    }

    return res.status(200)
              .json(new ApiResponse(200, comment, "comment updated successfully"))
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
        /*const originalComment = await Comment.findById(comment.repliesTo)
        if (originalComment){
            originalComment.replies.pull(commentId)
            await originalComment.save()
        }*/
    }else if (comment.video){
        await Video.findByIdAndUpdate(comment.video, { $pull: { comments: commentId } });
        /*const video = await Video.findById(comment.video)
        if (video){
            video.comments.pull(commentId)
            await video.save()
        }*/
    }
    await comment.deleteOne()

    return res.status(200).json(new ApiResponse(200, comment, "comment deleted successfully"))
})

const likeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not a valid comment id")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(400, "not a valid comment");
    }

    const isLiked = comment.likes.some( like => like._id.toString() === req.user._id.toString() )

    if (isLiked){
        comment.likes.pull(req.user._id)
    }else{
        comment.likes.push(req.user._id)
    }

    await comment.save()

    await comment.populate({
        path : "likes",
        select : "username fullName email"
    })

    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    {
                        comment,
                        likedby : comment.likes,
                        totalLikes: comment.likes.length
                    },
                    isLiked? "unliked comment" : "liked comment"
                )
            )
})

const dislikeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not a valid comment id")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(400, "not a valid comment");
    }

    const isDisliked = comment.dislikes.some( dislikes => dislikes._id.toString() === req.user._id.toString() )

    if (isDisliked){
        comment.dislikes.pull(req.user._id)
    }else{
        comment.dislikes.push(req.user._id)
    }

    await comment.save()

    await comment.populate({
        path : "dislikes",
        select : "username fullName email"
    })

    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    {
                        comment,
                        dislikedby : comment.dislikes,
                        totalDislikes: comment.dislikes.length
                    },
                    isDisliked? "unliked comment" : "liked comment"
                )
            )
})

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

    //creating reply 
    const Reply = await Comment.create({
        content,        
        owner : req.user._id,
        repliesTo : commentId //main comment id referenced in the repliesTo
    }).then(reply => reply.populate('owner', 'username fullName avatar'));

    //Ensure if repliesTo array exist and is an array 
    comment.replies = comment.replies || [] //initialize if undefined

    //push the reply id to the replies field of main comment array and save
    comment.replies.push(Reply._id)
    await comment.save()

    //populate the main comment replies field
    await comment.populate({
        path : "replies",
        select : "content owner"
    })

    return res.status(200)
              .json(new ApiResponse(200, { Reply }, "reply added successfully"))
})

const getreply = asyncHandler (async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)){
        throw new ApiError(400, "not a valid comment id")
    }

    const replylist = await Comment.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(commentId)
            }
        },
        {
            $lookup : {
                from : "comments",
                localField : "replies",
                foreignField : "_id",
                as : "replies",
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1,
                                        userName : 1,
                                        email : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $unwind : "$owner"
                    }
                ]
            }
        },
        {
            $project : {
                content : 1,
                owner : 1,
                createdAT : 1,
                updatedAt : 1,
                likesCount : { $size : "$likes"},
                isliked : { $in : [req.user._id, "$likes"]},
                replies : {
                    content : 1,
                    owner : 1,
                    createdAT : 1,
                    updatedAt : 1 
                },
                repliesTo : 1
            }
        }
    ])

    if (!replylist){
        throw new ApiError(400, "no reply found")
    }

    return res.status(200)
              .json(new ApiResponse(200 , replylist, "replies fetched successfully"))
})

export {
    addComment,
    getComment,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment,
    replyComment,
    getreply
}