import { Router } from "express";
import {
    addComment,
    getVideoComments,
    getComment,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment,
    replyComment,
    getreply
} from "../controllers/comment.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/uploadcomment/:videoId").post(verifyJWT, addComment);

router.route("/getvideocomment/:videoId").get(getVideoComments)

router.route("/:commentId")
    .get(verifyJWT, getComment)
    .patch(verifyJWT, updateComment)  // For updating the tweet
    .delete(verifyJWT, deleteComment);  // For deleting the tweet

router.route("/like/:commentId").patch(verifyJWT, likeComment);

router.route("/dislike/:commentId").patch(verifyJWT, dislikeComment);

router.route("/reply/:commentId").post(verifyJWT, replyComment);

router.route("/getreply/:commentId").get(getreply);

export default router;