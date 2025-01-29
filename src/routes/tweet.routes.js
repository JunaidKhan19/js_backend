import { Router } from 'express';
import {
    createTweet,
    getAllTweets,
    getTweetById,
    getSearchUserTweets,
    updateTweet,
    deleteTweet,
    likeTweet,
    retweet,
    getRetweets 
} from '../controllers/tweet.controllers.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router()
//router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route('/createtweet').post(verifyJWT, createTweet);

router.route('/getAllTweets').get(getAllTweets)

router.route('/getTweetById/:tweetId').get(getTweetById)

router.route("/users/:userName").get(verifyJWT, getSearchUserTweets);

router.route("/:tweetId")
    .patch(verifyJWT, updateTweet)  // For updating the tweet
    .delete(verifyJWT, deleteTweet);  // For deleting the tweet

router.route("/like/:tweetId").patch(verifyJWT, likeTweet);

router.route("/:tweetId/retweet").post(verifyJWT, retweet);

router.route("/:tweetId/retweet").get(getRetweets);

export default router;
