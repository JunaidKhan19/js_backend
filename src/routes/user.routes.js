import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshedAccessToken } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount : 1
        },
        {
            name : "coverImage",
            maxCount : 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)
//secured routes
router.route("/logoutUser").post(verifyJWT, logoutUser)

router.route("/refresh_token").post(refreshedAccessToken)

export default router;