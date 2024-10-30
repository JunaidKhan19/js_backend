import { Router } from "express";
import {     
    publishAVideo,
    getVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    serchVideos,
    incrimentViews,
    likeVideo,
    dislikeVideo
} from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/upload")
      .post(verifyJWT, upload.fields([{ name: 'videofile' }, { name: 'thumbnail' }]), publishAVideo);

router.route("/:videoId").get(getVideo); // Fetch a single video by ID

router.route("/:videoId")
      .patch(verifyJWT, upload.single('thumbnail'), updateVideo); 

router.route("/:videoId").delete(verifyJWT, deleteVideo); 

router.route("/allvideos").get(getAllVideos); 

router.route("/search").get(serchVideos); 

router.route("/:videoId/views").patch(incrimentViews); 

router.route("/like/:videoId").patch(verifyJWT, likeVideo);

router.route("/dislike/:videoId").patch(verifyJWT, dislikeVideo);

export default router;
