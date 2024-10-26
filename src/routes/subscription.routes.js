import { Router } from "express";
import { 
    toggleSubscription, 
    getUserChannelSubscribers, 
    getSubscribedChannels 
} from "../controllers/subscription.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// Toggle subscription to a channel
router.route("/c/:channelId")
      .post(toggleSubscription)
      .get(getUserChannelSubscribers); // Get list of subscribers for a specific channel

// Get the list of channels the user has subscribed to
router.route("/u/:subscriberId").get(getSubscribedChannels);

export default router;