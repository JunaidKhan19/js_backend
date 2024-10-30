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
router.use(verifyJWT)

router.route("/uploadcomment/:videoId").post(addComment);

router.route("/getvideocomment/:videoId").get(getVideoComments)

router.route("/:commentId")

router.route("/:commentId")
    .get(getComment)
    .patch(updateComment)  // For updating the tweet
    .delete(deleteComment);  // For deleting the tweet

router.route("/like/:commentId").patch(likeComment);

router.route("/dislike/:commentId").patch(dislikeComment);

router.route("/reply/:commentId").post(replyComment);

router.route("/getreply/:commentId").get(getreply);

export default router;