import { Router } from 'express';
import {
    createTweet,
    getAllTweets,
    getUserTweets,
    updateTweet,
    deleteTweet,
    likeTweet,
    retweet,
    getRetweets 
} from '../controllers/tweet.controllers.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router()
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route('/createtweet').post(createTweet);

router.route('/getAllTweets').get(getAllTweets)

router.route("/users/:userName").get(getUserTweets);

router.route("/:tweetId")
    .patch(updateTweet)  // For updating the tweet
    .delete(deleteTweet);  // For deleting the tweet

router.route("/like/:tweetId").patch(likeTweet);

router.route("/:tweetId/retweet").post(retweet);

router.route("/:tweetId/retweet").get(getRetweets);

export default router;
