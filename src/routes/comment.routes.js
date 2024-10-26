import { Router } from 'express';
import {
    addComment,
    getComment,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment,
    replyComment,
    getreply
} from "../controllers/comment.controllers.js"
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router()
router.use(verifyJWT)

router.route("/:videoId/addcomment").post(addComment)

router.route("/getcomment/:commentId").get(getComment);

router.route("/:commentId")
      .patch(updateComment)
      .delete(deleteComment)

router.route("/like/:commentId").patch(likeComment)

router.route("/dislike/:commentId").patch(dislikeComment)

router.route("/:commentId/replycomment").post(replyComment)

router.route("/:commentId/getreply").get(getreply)

export default router;