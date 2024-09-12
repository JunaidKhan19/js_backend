import { asyncHandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
import path from 'path'; //Ensure the path module is imported to handle file paths.
import fs from 'fs/promises'; // Use promises API for async/await For using asynchronous file operations like rename.
import jwt from "jsonwebtoken";

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

const registerUser = asyncHandler(async (req, res) => {
    console.log("Body:", req.body);
    console.log("Files:", req.files);
   //step 1 gather inputs to be taken from the user in frontend as data
    const {fullName, email, userName, password} = req.body
    console.log("email", email)

    //step 2 validate if any of the fields are not empty while registering
    /*if (fullName === ""){
        throw new ApiError(400, "fullname is required")
    }*/
   if (
       [fullName, email, userName, password].some(
          (field) => field?.trim() === "" 
        )
   ){
      throw new ApiError(400, "fullname is required")
   }

   //step 3 check if user already exists : email , username , etc. in db
   const existedUser = await User.findOne({
      $or: [{ email }, { userName }]
   })
   if (existedUser){
      throw new ApiError(409,"User with username or email already exists.")
   }

   //step 4 check for image input and avatar input

   //const avatarLocalPath = req.files?.avatar[0]?.path; //this was not working  
   const avatarLocalPath = path.join('public', 'temp', req.files.avatar[0].filename.replace(/\s+/g, '_')); 
   //to remove whitespaces from the file name and replace it with "_"
   await fs.rename(req.files.avatar[0].path, avatarLocalPath);
   //this will replace the name of the avatar file kept at req.files.avatar[0].path with the avatarLocalPath
   console.log(avatarLocalPath);

   //const coverImageLocalPath = req.files?.coverImage[0]?.path;
   let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
   //.files is provided due to the middleware written in user.routes.js

   if (!avatarLocalPath){
      throw new ApiError(400 , "Avatar is required.")
   }

   //step 5 upload data on cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if (!avatar || !avatar.url){
      throw new ApiError(400 , "Avatar is required.")
   }

   //step 6 create user object - entry in db
   const user = await User.create({
      fullName,
      email,
      userName : userName.toLowerCase(),
      password,
      //avatar : avatar.url,
      //avatar : avatar?.url || "" ,
      //coverImage : coverImage?.url || ""
   })

   //step 7 remove password and refresh token fields from response 
   //step 8 and to check if user is not created
   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken" // (-) means dont take this 
   )

   if (!createdUser){
      throw new ApiError(500, "Something went wrong wile creating user")
   }

   //step 9 if created then response
   return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered successfully")
   )
})

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

    //step 2 checking for either username or email for making username or email base login
    if (!(userName || email)){
        throw new ApiError(400, "username or email is required")
    }

    //step 3 finding the user from req.body eventually in existing database
    const user = await User.findOne({
        $or: [{userName}, {email}]
    })

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
        { $set : {refreshToken : undefined} },
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

export {registerUser, loginUser, logoutUser, refreshedAccessToken} ; 