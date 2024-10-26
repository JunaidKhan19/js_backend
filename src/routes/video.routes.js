import { Router } from "express";
import {     
    uploadVideo,
    getVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    serchVideos,
    incrimentViews 
} from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Set up Multer for handling file uploads (e.g., videos and thumbnails)
//const upload = multer({ dest: './public/uploads/' }); // destination folder for uploaded files

router.route("/upload")
      .post(verifyJWT, upload.fields([{ name: 'videofile' }, { name: 'thumbnail' }]), uploadVideo);

router.route("/:videoId").get(getVideo); // Fetch a single video by ID

router.route("/:videoId")
      .patch(verifyJWT, upload.single('thumbnail'), updateVideo); 

router.route("/:videoId").delete(verifyJWT, deleteVideo); 

router.route("/allvideos").get(getAllVideos); 

router.route("/search").get(serchVideos); // Search videos by query string

router.route("/:videoId/views").patch(incrimentViews); // Increment video views count

export default router;
