import mongoose, {isValidObjectId} from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { asyncHandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)){
        throw new ApiError(400, "not a valid channel id")
    }

    /* here two queries are passed and the response data is saved respectively
    const [videoStats, totalSubscribers] = await Promise.all([
        Video.aggregate([
            { $match: { owner: mongoose.Types.ObjectId(channelId) } },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    totalLikes: { $sum: { $size: "$likes" } },
                    totalComments: { $sum: { $size: "$comments" } } // Assuming comments are an array in the Video model
                }
            }
        ]),//query1
        Subscription.countDocuments({ channel: channelId }) //query2
    ]);
    */
    const videoStats = await Video.aggregate([
        {
            $match : {owner: new mongoose.Types.ObjectId(channelId)}
        },
        {
            $group : {
                _id : null,
                totalVideos : {$sum : 1},
                totalViews : {$sum : "$views"},
                totalLikes : {$sum : {$size : "$likes"}},
                totalDislikes : {$sum : {$size : "$dislikes"}},
            }
        }
    ])

    const totalSubscribers = await Subscription.countDocuments({channel : channelId})

    const stats = videoStats[0] || {totalVideos: 0, totalViews: 0, totalLikes: 0, totalDislikes: 0}

    return res.status(200)
              .json(new ApiResponse(
                200, 
                {
                    subscribers : totalSubscribers, 
                    totalVideos : stats.totalVideos,
                    totalViews : stats.totalViews,
                    totalLikes : stats.totalLikes,
                    totalDislikes : stats.totalDislikes,
                }, 
                "Channel statistics fetched successfully")        
            );
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const videos = await Video.find({ owner: channelId })
                              .sort({ createdAt: -1 }) // Most recent videos first
                              .select("title thumbnail views likes dislikes createdAt")
                              .skip((page - 1) * limit) //show the videos on current page
                              .limit(Number(limit))
    
    const totalVideos = await Video.countDocuments({ owner: channelId });

    return res.status(200)
              .json(new ApiResponse(200, 
                {
                    videos,
                    totalPages: Math.ceil(totalVideos / limit),
                    currentPage: page
                }, 
                "Channel videos fetched successfully")
            );
})

export {
    getChannelStats, 
    getChannelVideos
}