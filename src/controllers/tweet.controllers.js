import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content.trim()) {
        throw new ApiError(400, "Content is required");
    }
    
    const userId = await User.findById(req.user._id).select("-password -refreshToken");
    
    const tweet = await Tweet.create({
        content,
        owner: userId
    });

    return res.status(200)
              .json(new ApiResponse(200, tweet, "Tweet created successfully"));
});

const getAllTweets = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const tweets = await Tweet.aggregate([
        {
            $match: { retweetsTo: null }, // Only fetch original tweets
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] },
            },
        },
        {
            $lookup: {
                from: "tweets",
                localField: "retweets",
                foreignField: "_id",
                as: "retweets",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                        },
                    },
                    {
                        $addFields: {
                            owner: { $arrayElemAt: ["$owner", 0] },
                        },
                    },
                    {
                        $project: {
                            content: 1,
                            createdAt: 1,
                            owner: { userName: 1, avatar: 1 },
                        },
                    },
                ],
            },
        },
        {
            $sort: { createdAt: -1 },
        },
        {
            $skip: skip,
        },
        {
            $limit: limitNumber,
        },
        {
            $project: {
                content: 1,
                likes: 1,
                retweets: 1,
                createdAt: 1,
                owner: { userName: 1, avatar: 1 },
            },
        },
    ]);

    const totalTweets = await Tweet.countDocuments({ retweetsTo: null });
    const totalPages = Math.ceil(totalTweets / limitNumber);

    /* using populate
    const tweets = await Tweet.find({})
        .populate({ path: 'owner', select: 'userName avatar' }) // Populate owner details
        .sort({ createdAt: -1 }) // Sort tweets by creation date in descending order
        .skip(skip) // Skip tweets based on the current page
        .limit(limitNumber); // Limit the number of tweets per page
    */

    res.status(200).json(
        new ApiResponse(200, {
            tweets,
            pagination: {
                currentPage: pageNumber,
                totalPages,
                totalTweets,
            },
        }, 'Tweets fetched successfully')
    );
};    

const getTweetById = async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)){
        throw new ApiError(400, "not valid tweetId")
    }

    const tweet = await Tweet.findById(tweetId).populate("owner", "fullName userName avatar email")

    return res.status(200)
              .json(new ApiResponse(200, tweet, "Tweet fetched successfully"))
}

const getSearchUserTweets = asyncHandler(async (req, res) => {
    //get the user id from the url by using req.params.
    //req.user finds for the authenticated user which in this case is not required
    //since user can be any one among the many users
    const { userName } = req.params

    if (!userName){
        throw new ApiError(400, "invalid username")
    }

    const user = await User.findOne({ userName });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const userId = user._id

    if (!isValidObjectId(userId)){
        throw new ApiError(400, "not a valid user")
    }
    
    const usersTweets = await Tweet.aggregate([
        {
            //match stage is used to filter tweets where the owner is 
            //the user with the given userId.
            //we are explicitly converting the userId into a mongoose ObjectId since 
            //it is in string format 
            $match : {
                owner : new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup : {
                from : 'users', // Collection to join                  
                localField : 'owner', // Field from the Tweet model
                foreignField : '_id', // Field from the User model
                as : 'owner'  // Field to store the resulting user data
            }
        },
        {
            // Add the first user from the 'owner' array (since we expect only one)
            $addFields : {
                owner : { $arrayElemAt : ['$owner',0]}
            }
        },
        {
             // Sort the tweets by the createdAt field in descending order (most recent first)
            $sort : {
                createdAt : -1
            }
        },
        {
            $project : {
                content : 1, // Keep tweet content
                retweets : 1,
                createdAt : 1, // Keep tweet creation time
                owner : {
                    fullName : 1, // Keep owner's full name
                    userName : 1, // Keep owner's username
                    avatar : 1 // Keep owner's avatar
                }                   
            }
        },
    ])
    return res.status(200)
              .json(new ApiResponse(200, usersTweets, "User's tweets retrieved successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params; // Access the tweet ID from the URL
    const { content } = req.body;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid Tweet ID");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify/delete this tweet");
    }

    const tweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { content },
        { new: true, runValidators: true }
    );

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    return res.status(200)
        .json(new ApiResponse(200, tweet ,"tweet updated successfully"))
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to modify/delete this tweet");
    }

    if (tweet.retweetsTo) {
        await Tweet.findByIdAndUpdate(tweet.retweetsTo, { $pull : {retweets : tweetId}})
        /*
        //If it's a retweet, find the original tweet (main tweet)
        const originalTweet = await Tweet.findById(tweet.retweetsTo);

        if (originalTweet) {
            originalTweet.retweets.pull(tweetId); //Remove the retweet's ID from the original tweet's retweets array
            await originalTweet.save(); //Save the original tweet after updating the retweets array
        }*/
        await tweet.deleteOne(); //Delete the retweet

    } else {
        //If it's a main/original tweet, just delete the tweet directly
        await Tweet.findByIdAndDelete(tweetId);
    }

    return res.status(200).json(
        new ApiResponse(200, { tweetId }, "Tweet deleted successfully")
    );
});

const likeTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    if (!req.user || !req.user._id) {
        throw new ApiError(401, "User not authenticated");
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    const userId = req.user._id.toString();
    const isLiked = tweet.likes.some((like) => like.toString() === userId);

    if (isLiked) {
        tweet.likes = tweet.likes.filter((like) => like.toString() !== userId);
    } else {
        tweet.likes.push(userId);
    }

    const updatedTweet = await tweet.save();
    
    await updatedTweet.populate({
        path: "likes",
        select: "userName fullName email avatar",
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                tweet: updatedTweet,
                totalLikes: updatedTweet.likes.length,
                likedBy: updatedTweet.likes,
            },
            isLiked ? "Tweet unliked successfully" : "Tweet liked successfully"
        )
    );
});


const retweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    console.log("tweetId:", tweetId); // Debug log
    console.log("content:", req.body); // Debug log

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    if (!content.trim()) {
        throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(400, "Tweet not found");
    }

    console.log("Creating retweet for tweetId:", tweetId); // Debug log

    const Retweet = await Tweet.create({
        content,
        owner: req.user._id,
        likes: [],
        retweets: [],
        retweetsTo: tweetId, // Ensure this is an ObjectId, not an array
    });

    console.log("Created retweet:", Retweet); // Debug log

    tweet.retweets = tweet.retweets || null;
    tweet.retweets.push(Retweet._id);
    await tweet.save();

    console.log("Updated main tweet retweets:", tweet.retweets); // Debug log

    await tweet.populate({
        path: "retweets",
        select: "userName fullName email content",
    });

    return res.status(200).json(new ApiResponse(200, { Retweet }, "Retweeted successfully"));
});


const getRetweets = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    
    if (!isValidObjectId(tweetId)){
    throw new ApiError(400, "invalid tweet")
    }
    
    const retweetsList = await Tweet.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(tweetId)
            },
        },
        {
            $lookup : {
                from : "tweets",
                localField : "retweets",
                foreignField : "_id",
                as : "retweets",
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
                                        avatar : 1,
                                        fullName : 1,
                                        userName : 1,
                                        email : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $unwind : "$owner" // Ensure owner is an object, not an array
                    }
                ]
            }
        },   
        {
            $project : {
                retweets : {
                    _id: 1,
                    content : 1, 
                    owner : {
                        userName : 1,
                        avatar : 1
                    }, 
                    createdAt : 1, 
                    updatedAt : 1,
                    retweetsTo : 1
                }
            }
        }
    ])
    
    /* //using the populate method 
    const tweet = await Tweet.findById(tweetId).populate({
        path: "retweets",
        populate: {
            path: "owner",
            select: "fullName userName avatar"
        }
    });
    */
    
    if (!retweetsList){
    throw new ApiError(400, "no tweet found")
    }
    
    return res.status(200)
    .json(new ApiResponse(200, retweetsList, "retweets list fetched successfully"))
})

export {
    createTweet,
    getAllTweets,
    getTweetById,
    getSearchUserTweets,
    updateTweet,
    deleteTweet,
    likeTweet,
    retweet,
    getRetweets
}