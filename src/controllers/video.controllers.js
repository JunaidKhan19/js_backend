import { isValidObjectId } from "mongoose";
import { Video } from '../models/video.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'; 
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from '../utils/asynchandler.js';
import mongoose from "mongoose";

const publishAVideo = asyncHandler(async(req,res)=>{
    const {title,description} = req.body;
    if (!title || !description) {
        throw new ApiError(400,"title or description is required")
    }
    const videoFilePath = req.files?.videofile?.[0]?.path;
    const thumbnailPath = req.files?.thumbnail?.[0]?.path;
    
    if (!videoFilePath || !thumbnailPath)  {
        throw new ApiError(400,"video or thumbnail file which is required")
    }
    
    const uploadedVideo = await uploadOnCloudinary(videoFilePath)
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailPath)

    const videoData = await Video.create({
        title,
        description,
        videofile: uploadedVideo.url,
        thumbnail: uploadedThumbnail.url,
        duration: uploadedVideo.duration,
        owner: req.user._id,
    });
    
    return res.status(201).json(
        new ApiResponse(201, videoData, "Video uploaded successfully")
    );
})

const getVideobyId = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid video id")
    }

    const video = await Video.findById(videoId)
                            .populate("owner", "userName avatar")

    if (!video){
        throw new ApiError(400, "video not found")
    }
    
    return res.status(200).json(new ApiResponse(200, video, "video fetched successfully"))
})

const updateVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params
    const { title, description} = req.body

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid video id")
    }

    let thumbnail;
    const thumbnailLocalpath = req.files?.thumbnail?.path
    if (thumbnailLocalpath){
        const newThumbnail = await uploadOnCloudinary(thumbnailLocalpath)
        if (!newThumbnail) {
            throw new ApiError(400, "Error uploading the new thumbnail");
        }
        thumbnail = newThumbnail.url;
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set : {
                title,
                description,
                thumbnail : thumbnail
            }
        },
        { new : true, runValidators : true }
    )

    if (!video){
        throw new ApiError(400, "video not found")
    }

    return res.status(200).json(new ApiResponse(200, video, "video update successfully"))
})

const deleteVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid video id")
    }

    const video = await Video.findById(videoId);

    if (!video){
        throw new ApiError(400, "video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // Delete all comments and replies associated with the video
    //await Comment.deleteMany({ video: video._id }); 
    //comments are stored with a video field in the Comment model 
    //(i.e., each comment has a reference to the associated video), 
    //this is an efficient way to delete all comments related to the video.

    await video.deleteOne();

    return res.status(200)
              .json(new ApiResponse(200, { videoId }, "Video deleted successfully"));
})

//using aggregatepaginate
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", userId } = req.query;

    // Parse and validate page and limit
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    if (isNaN(pageNumber) || isNaN(limitNumber)) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid page or limit parameter"));
    }

    // Validate userId if provided
    if (userId && !isValidObjectId(userId)) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid userId format"));
    }

    // Base pipeline for filtering
    const filterPipeline = [];

    // Add user-specific filter if userId is provided
    if (userId) {
        filterPipeline.push({ $match: { owner: new mongoose.Types.ObjectId(userId) } });
    }

    // Add search filter for query
    if (query) {
        filterPipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } },
                ],
            },
        });
    }

    // Count total videos matching filters
    const totalVideos = await Video.aggregate([...filterPipeline, { $count: "total" }]);
    const totalFiles = totalVideos.length > 0 ? totalVideos[0].total : 0;

    // Calculate total pages
    const totalPages = Math.ceil(totalFiles / limitNumber);

    // Add pagination stages to the pipeline
    const pipeline = [
        ...filterPipeline,
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
            },
        },
        {
            $unwind: {
                path: "$ownerDetails",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                title: 1,
                description: 1,
                thumbnail: 1,
                createdAt: 1,
                "ownerDetails.userName": 1,
                "ownerDetails.avatar": 1,
            },
        },
        { $skip: (pageNumber - 1) * limitNumber },
        { $limit: limitNumber },
    ];

    // Execute aggregation to fetch videos
    const videos = await Video.aggregate(pipeline);

    // Handle no videos case
    if (!videos || videos.length === 0) {
        return res.status(404).json(new ApiResponse(404, null, "No videos found"));
    }

    // Return response with pagination info
    return res.status(200).json(
        new ApiResponse(200, { videos, currentPage: pageNumber, totalPages, totalFiles }, "Videos fetched successfully")
    );
});

const incrimentViews = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid vedio Id")
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc : { views : 1 } },
        { new : true }
    )

    if (!video){
        throw new ApiError(400, "Video not found")
    }

    return res.status(200)
              .json(new ApiResponse(200, video, "views incremented successfully"))
})

const likeVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not a valid video id")
    }

    const video = await Video.findById(videoId)

    if (!video){
        throw new ApiError(400, "video not find")
    }

    if (!req.user || !req.user._id) {
        throw new ApiError(401, "User not authenticated");
    }

    const isLiked = video.likes.some(like => like._id.toString() === req.user._id.toString())

    const isDisliked = video.dislikes.some(dislike => dislike._id.toString() === req.user._id.toString())

    if (isLiked){
        return res.status(200).json(new ApiResponse(200, {}, "You have already liked the video"));
    }
    
    if (isDisliked) {
        video.dislikes.pull(req.user._id)
    } else {
        video.likes.push(req.user._id)
    }

    const likedVideo = await video.save()

    await likedVideo.populate({
        path : "likes",
        select : "userName fullName email"
    })

    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    {
                        likedVideo,
                        liked_by : video.likes,
                        total_likes : video.likes.length
                    }, 
                    "liked the video successfully"
                )
            )
})

const dislikeVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not a valid video id")
    }

    const video = await Video.findById(videoId)

    if (!video){
        throw new ApiError(400, "video not find")
    }
    
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "User not authenticated");
    }

    const isLiked = video.likes.some(like => like._id.toString() === req.user._id.toString())

    const isDisliked = video.dislikes.some(dislike => dislike._id.toString() === req.user._id.toString())

    if (isDisliked){
        return res.status(200).json(new ApiResponse(200, {}, "you have already disliked the video"))
    }

    if (isLiked){
        video.likes.pull(req.user._id)
    } else {
        video.dislikes.push(req.user._id)
    }

    const dislikedVideo = await video.save()

    await dislikedVideo.populate({
        path : "dislikes",
        select : "userName fullName email"
    })

    return res.status(200)
              .json(
                new ApiResponse(
                    200, 
                    {
                        dislikedVideo,
                        disliked_by : video.dislikes,
                        total_dislikes : video.dislikes.length
                    }, 
                    "disliked the video successfully"
                )
            )
})

export {
    publishAVideo,
    getVideobyId,
    updateVideo,
    deleteVideo,
    getAllVideos,
    incrimentViews,
    likeVideo,
    dislikeVideo
};