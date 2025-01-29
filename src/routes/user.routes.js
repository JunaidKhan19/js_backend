import { Router } from "express";
import {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshedAccessToken,
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory
} from "../controllers/user.controllers.js";
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

router.route("/login")
      .post(loginUser) //secured routes

router.route("/logout")
      .post(verifyJWT, logoutUser)

router.route("/refresh_token")
      .post(refreshedAccessToken)

router.route("/change_password")
      .post(verifyJWT, changeCurrentPassword)

router.route("/current_user")
      .get(verifyJWT, getCurrentUser)

router.route("/update_account_details")
      .patch(verifyJWT, updateAccountDetails) 
//patch is used here to update only few values without changing other values rather than post method

router.route("/change_avatar")
      .patch(verifyJWT, upload.single("avatar"), updateUserAvatar)

router.route("/change_cover_image")
      .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

router.route("/c/:userName")
      .get(verifyJWT, getUserChannelProfile)

router.route("/history")
      .get(verifyJWT, getWatchHistory)

export default router;