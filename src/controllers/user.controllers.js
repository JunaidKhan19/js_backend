import { asyncHandler } from "../utils/asynchandler.js"

// creating a method to register user
const registerUser = asyncHandler(async (req, res) => {
    return res.status(200).json({
        message: "khan junaid"
    })
})

export {registerUser} ; 