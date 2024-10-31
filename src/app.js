import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express()

app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials: true
}))

//to allow json data and its limit 
app.use(express.json({
    limit:"16kb"
}))

//to allow data through url using url encoders
//extended allows to accept object under/in/wthin the object
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

//using static =: public so that to save files, images, favicons etc on the server
app.use(express.static("public"))

// using cookie-parser to be able to accept and set the cookies from a users browser
//basically to be able to perform crud operation
app.use(cookieParser())

//router import
import userRouter from "./routes/user.routes.js";
import tweetRouter from "./routes/tweet.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js";

//routes declaration
app.use("/api/v1/users", userRouter)
app.use("/api/v1/tweet", tweetRouter)
app.use("/api/v1/video", videoRouter)
app.use("/api/v1/comment", commentRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/subscription", subscriptionRouter)
app.use("/api/v1/dashboard", dashboardRouter)

export {app};