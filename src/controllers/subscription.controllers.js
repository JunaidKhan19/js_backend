import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { asyncHandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);

    if (!channel) {
        throw new ApiError(400, "Channel not found");
    }

    const deletedSubscription = await Subscription.findOneAndDelete({
        channel: channelId,
        subscriber: req.user._id
    });

    if (deletedSubscription) {
        return res.status(204).json(new ApiResponse(204, {}, "Unsubscribed successfully"));
    } else {
        // If subscription doesn't exist, create a new subscription
        const newSubscription = await Subscription.create({
            channel: channelId,
            subscriber: req.user._id
        });
        return res.status(200).json(new ApiResponse(200, newSubscription, "Subscribed successfully"));
    }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);

    if (!channel) {
        throw new ApiError(400, "Channel not found");
    }

    const subscribersList = await Subscription.find({ channel : channelId })
                                              .populate("subscriber", "fullName userName avatar")
   
    return res.status(200)
              .json(new ApiResponse(200, subscribersList, "channels subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID.");
    }

    const user = await User.findById(subscriberId);

    if (!user) {
        throw new ApiError(404, "User not found.");
    }
    
    const subscribedTo = await Subscription.find({ subscriber: subscriberId })
                                            .populate("channel", "fullName userName avatar");

    return res.status(200)
              .json(new ApiResponse(200, subscribedTo, "Subscribed channels fetched successfully."));
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}