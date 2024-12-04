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

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

        // Aggregation pipeline to fetch tweets with pagination
    const tweets = await Tweet.aggregate([
        {
            $lookup: {
                from: 'users', // Join the 'users' collection
                localField: 'owner', // Match tweets.owner
                foreignField: '_id', // With users._id
                as: 'owner', // Store matched user data in 'owner'
            },
        },
        {
            $addFields: {
                owner: { $arrayElemAt: ['$owner', 0] }, // Unwrap the owner array
            },
        },
        {
            $sort: { createdAt: -1 }, // Sort by creation date
        },
        {
            $project: {
                content: 1, // Include tweet content
                likes: 1, // Include likes count
                retweets: 1, // Include retweets count
                replies: 1, // Include replies count
                createdAt: 1, // Include creation date
                owner: {
                    userName: 1, // Include owner's username
                    avatar: 1, // Include owner's avatar
                },
            },
        },
        { $skip: skip }, // Skip documents based on page
        { $limit: limitNumber }, // Limit documents to the page size
    ]);
    
    /* using populate
    const tweets = await Tweet.find({})
        .populate({ path: 'owner', select: 'userName avatar' }) // Populate owner details
        .sort({ createdAt: -1 }) // Sort tweets by creation date in descending order
        .skip(skip) // Skip tweets based on the current page
        .limit(limitNumber); // Limit the number of tweets per page
    */
    const totalTweets = await Tweet.countDocuments();

    const totalPages = Math.ceil(totalTweets / limitNumber);

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

const getUserTweets = asyncHandler(async (req, res) => {
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
        throw new ApiError(400, "Invalid tweet");
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(400, "Tweet not found");
    }

    //Check if the user already liked the tweet using `.some()` with ObjectId comparison
    const isliked = tweet.likes.some( like => like._id.toString() === req.user._id.toString() );

    if (isliked) {
        tweet.likes.pull(req.user._id); // Remove the user's like if already liked
    } else {
        tweet.likes.push(req.user._id); // Add the user's like if not already liked
    }

    const likedTweet = await tweet.save();

    await likedTweet.populate({
        path: "likes",
        select: "username fullName email"
    });

    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    {
                        tweet: likedTweet,
                        likedBy: likedTweet.likes,//optional since likedTweet.populate privides this
                        totalLikes: likedTweet.likes.length
                    },
                    isliked ? "unliked tweet" : "Liked tweet"
                )
              
            )  
       ;
});

const retweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;    

    if (!isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweet ID");
    }

    if (!content.trim()) {
        throw new ApiError(400, "content is required");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(400, "Tweet not found");
    }

    const Retweet = await Tweet.create({
        content, // Reply content
        owner : req.user._id, // The owner of the reply (the user making the reply)
        likes : [], //the likes to the retwwets initialized as empty
        retweets : [],
        retweetsTo : tweetId // Linking the reply to the original tweet based on its Id
    })

    // Ensure the retweets array exists and is an array
    tweet.retweets = tweet.retweets || []; // Initialize if undefined

    // Push the retweet ID to the retweets array and Save the updated tweet document (main tweet)
    tweet.retweets.push(Retweet._id);   
    await tweet.save();

    // Populate the retweets field of main tweet 
    await tweet.populate({
        path: "retweets",
        select: "userName fullName email content"
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
                content : 1, 
                owner : 1, 
                createdAt : 1, 
                updatedAt : 1, // Last update time of the retweet
                likesCount : { $size : "$likes" }, // Count of likes on the retweet 
                isLiked : { $in : [req.user._id, "$likes"] }, // Check if the user liked this retweet
                retweets : {
                    content : 1, 
                    owner : 1, 
                    createdAt : 1, 
                    updatedAt : 1
                },
                retweetsTo : 1
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
    getUserTweets,
    updateTweet,
    deleteTweet,
    likeTweet,
    retweet,
    getRetweets
}