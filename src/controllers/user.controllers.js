import { asyncHandler } from "../utils/asynchandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"

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
   const existedUser = User.findOne({
      $or: [{ email }, { userName }]
   })
   if (existedUser){
      throw new ApiError(409,"User with username or email already exists.")
   }

   //step 4 check for image input and avatar input
   const avatarLocalPath = req.files?.avatar[0]?.path; 
   const coverImageLocalPath = req.files?.coverImage[0]?.path;
   //.files is provided due to the middleware written in routes.js

   if (!avatarLocalPath){
      throw new ApiError(400 , "Avatar is required.")
   }

   //step 5 upload data on cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if (!avatar){
      throw new ApiError(400 , "Avatar is required.")
   }

   //step 6 create user object - entry in db
   const user = await User.create({
      fullName,
      email,
      userName : userName.toLowerCase(),
      password,
      avatar : avatar.url,
      coverImage : coverImage?.url || ""
   })

   //step 7 remove password and refresh token fields from response 
   //step 8 and to check if user is not created
   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken" // (-) means not take this 
   )

   if (!createdUser){
      throw new ApiError(500, "Something went wrong wile creating user")
   }

   //step 9 if created then response
   return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered successfully")
   )
})


export {registerUser} ; 