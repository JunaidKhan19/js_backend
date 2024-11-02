import { Router } from "express";
import {     
    publishAVideo,
    getVideobyId,
    updateVideo,
    deleteVideo,
    getAllVideos,
    incrimentViews,
    likeVideo,
    dislikeVideo
} from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route for fetching all videos with pagination and search
router.route("/all_videos").get(getAllVideos); //place this route before the other routes that uses videoid 

router.route("/upload")
      .post(verifyJWT, upload.fields([{ name: 'videofile' }, { name: 'thumbnail' }]), publishAVideo);

router.route("/:videoId").get(getVideobyId); // Fetch a single video by ID

router.route("/:videoId")
      .patch(verifyJWT, upload.single('thumbnail'), updateVideo); 

router.route("/:videoId").delete(verifyJWT, deleteVideo); 

router.route("/:videoId/views").patch(incrimentViews); 

router.route("/like/:videoId").patch(verifyJWT, likeVideo);

router.route("/dislike/:videoId").patch(verifyJWT, dislikeVideo);

export default router;
