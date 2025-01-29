import { asyncHandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken";
import mongoose from "mongoose"

//method for generating access and refresh token as it will be used frequently
//note: we are not using asyncHandler bcoz we are not making any web request 
//this method will only be used here internally 
const generateAccessRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        //this user.refresh token is from user.model which is updated with the refreshToken generated here
        //basically the refresh token made here is added to the user data in user.model
        await user.save({ validateBeforeSave: false })
        /*
        since the user object is made with the help of mongoose it provides the .save method 
        that helps in saving the freshly updated refreshToken 
        note since we are saving only one value i.e refresh token but .save will kick in 
        all the fields of user model e.g password field in user.model
        hence {validateBeforeSave: false} object of .save is written to avoid conflict 
        and let the new refresh token get saved
        */
       return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "OOP's , Something went wrong while generating access and refresh tokens!!!")
    }
}

// creating a method to register user
/*
    creating a proper user input or registration with all data. STEPS:-
    1.gather inputs to be taken from the user in frontend
    2.validate if any of the fields are not empty while registering
    3.check if user already exists : email , username , etc. in db
    4.check for image input and avatar input
    5.upload data on cloudinary
    6.create user object - entry in db
    7.remove password and refresh token fields from response
    8.check for user creation response if not null
    9.then response
*/
const registerUser = asyncHandler( async (req, res) => {
    //step 1 gather inputs to be taken from the user in frontend as data
    const {fullName, email, userName, password } = req.body
    
    //step 2 validate if any of the fields are not empty while registering
    if (
        [fullName, email, userName, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    //step 3 check if user already exists : email , username , etc. in db
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    //step 4 check for image input and avatar input
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage?.[0]?.path;
    }
    
    // Check if avatar file exists
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    
    //step 5 upload data on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;
    
    // Check if avatar was uploaded correctly
    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }
    
    //step 6 create user object - entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        //userName: userName.toLowerCase()
        userName: userName
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //step 7 remove password and refresh token fields from response 
    //step 8 and to check if user is not created
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //step 9 if created then response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
} )

// creating a method to login user
/*
    creating a proper user input for login with all data. STEPS:-
    1.get data from req.body
    2.checking for either username or email for making username or email base login
    3.finding the user from req.body eventually in existing database
    4.if no existing user found then error 
    5.check password and validate
    6.generate access and refresh token to send it to user
    7.saving the newly generated access and refresh tokens in the user data and getting response
    8.sending cookies containing access and refresh token to user
*/

const loginUser = asyncHandler (async (req, res) => {

    //step 1 get data from req.body
    const {email, userName, password} = req.body
    console.log("Request Body:", req.body);
    console.log("User Name:", userName);
    console.log("Email:", email);


    //step 2 checking for either username or email for making username or email base login
    if (!userName && !email){
        throw new ApiError(400, "username or email is required")
    }

    //step 3 finding the user from req.body eventually in existing database
    const query = {
        $or: [
          userName ? { userName: userName } : null,
          email ? { email: email.toLowerCase() } : null
        ].filter(Boolean), // Remove any null values
      };
      
    const user = await User.findOne(query);

    //step 4 if no existing user found then error 
    if (!user){
        throw new ApiError(404, "user not found")
    }

    //step 5 check password and validate
    const isPasswordValid = await user.isPasswordCorrect(password)
    //note: User refers/gives mongoose generated user object through we can do operations  
    //such as create, findone, deleteone, findbyid,  etc
    //user refers/gives our user which is here in this code for login where we can use 
    //operations like ispasswordcorrect, etc
    if (!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    //step 6 generate access and refresh token to send it to user
    const {accessToken, refreshToken} = await generateAccessRefreshTokens(user._id)
    //like getting data from user.body, we are getting accessToken & refreshToken from the method

    //step 7 saving the newly generated access and refresh tokens in the user data and getting response
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken" // (-) means dont take this 
    )

    //step 8 sending cookies containing access and refresh token to user
    const options = {
        httpOnly : true,//since cookies can be modified in frontend, this restricts the modification there
        secure : true
    }

    return res.status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", refreshToken, options)
                .json(
                    new ApiResponse(
                        200,//statuscode
                        {user: loggedInUser, accessToken, refreshToken},//data 
                        "user logged in successfully"//message
                    )
                )
})

const logoutUser = asyncHandler (async (req, res) => {
    //for logging out we need to clear the cookies and the access and refresh token
    //to access the cookie we need to get id of the logged in user and in order to get 
    //this id we need to use a middleware i.e auth.middleware.js
    await User.findByIdAndUpdate(req.user._id, 
        { $unset : {refreshToken : 1} },
        {new: true}
    )

    const options = {
        httpOnly : true,//since cookies can be modified in frontend, this restricts the modification there
        secure : true
    }

    return res.status(200)
              .clearCookie("accessToken", options)
              .clearCookie("refreshToken", options)
              .json(new ApiResponse(200, {}, "user logged out"))
})

const refreshedAccessToken = asyncHandler (async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        new ApiError(401, "unauthorized request")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)
    if (!user) {
        new ApiError(401, "invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "refresh token is expired or used")
    }
    
    const {accessToken, refreshToken} = await generateAccessRefreshTokens(user._id) 

    const options = {
        httpOnly : true,//since cookies can be modified in frontend, this restricts the modification there
        secure : true
    }

    return res.status(200)
              .cookie("accessToken", accessToken, options)
              .cookie("refreshToken", refreshToken, options)
              .json(
                new ApiResponse(
                    200,
                    {accessToken, refreshToken : refreshToken},
                    "access token refreshed"
                )
              )
})

const changeCurrentPassword = asyncHandler (async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect){
        throw new ApiError(400, "incorrect password")
    }

    user.password = newPassword 
    await user.save({ validateBeforeSave: false })

    return res.status(200)
              .json(new ApiResponse(200, {}, "your password is saved successfully"))
})

const getCurrentUser = asyncHandler (async (req, res) => {
    return res.status(200)
              .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler (async (req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName, //it  is like fullName : fullName
                email //email : email
            }
        }, 
        {new : true} //this will return the updated information or information after update
    ).select("-password")

    return res.status(200)
              .json(new ApiResponse(200, user, "account details updated successfully"))
})

const updateUserAvatar = asyncHandler (async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing!!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url){
        throw new ApiError(400, "error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
              .json(new ApiResponse(200, user, "avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler (async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing!!")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url){
        throw new ApiError(400, "error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage : coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    return res.status(200)
              .json(new ApiResponse(200, user, "cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler (async (req, res) => {
    //we get users channel by the url so we use req.params
    const {userName} = req.params

    if (!userName?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match : {
                userName : userName?.toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subscriptions", 
                localField :"_id",
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions", 
                localField :"_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : {$in : [req.user?._id, "$subscribers.subscriber"]},
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                fullName : 1,
                userName : 1,
                avatar : 1,
                coverImage : 1,
                email : 1,
                subscribersCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1
            }
        }
    ])

    if (!channel?.length){
        throw new ApiError(404, "Channel not exist")
    }

    return res.status(200)
              .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})

const getWatchHistory = asyncHandler (async (req, res) => {
    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            },
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1,
                                        userName : 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields : {
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
              .json(
                new ApiResponse(
                    200,
                    user[0].watchHistory,
                    "watch history recieved successfully"
                )
              )
})

export {registerUser, 
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
} ; 