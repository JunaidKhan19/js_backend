import { Router } from "express";
import { 
    createPlaylist, 
    addVideoToPlaylist, 
    getUserPlaylists, 
    getPlaylistById, 
    updatePlaylist, 
    removeVideoFromPlaylist, 
    deletePlaylist 
} from "../controllers/playlist.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/create").post(createPlaylist);

router.route("/u/:userId").get(getUserPlaylists);

router.route("/:playlistId")
      .get(getPlaylistById)
      .patch(updatePlaylist)
      .delete(deletePlaylist);

router.route("/add_video/:playlistId/video/:videoId")
      .patch(addVideoToPlaylist);

router.route("/remove_video/:playlistId/video/:videoId")
      .delete(removeVideoFromPlaylist);

export default router;