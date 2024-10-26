import ffmpeg from 'fluent-ffmpeg';
import { Video } from '../models/video.model.js';
import { Comment } from '../models/comment.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'; // Import Cloudinary helper function
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from '../utils/asynchandler.js'; // Error handler middleware
import fs from 'fs'; // File system operations

const uploadVideo = asyncHandler (async (req, res) => {
    const {title, description} = req.body
    if (!(title || description)){
        throw new ApiError(400, "title and description are required." )
    }

    //uploading thumbnail on cloudinary
    const thumbnailLocalpath = req.files?.thumbnail?.path
    if(!thumbnailLocalpath){
        throw new ApiError(400, "thumbnail is required." )
    }
    const thumbnail = await uploadOnCloudinary(thumbnailLocalpath);
    if(!thumbnail){
        throw new ApiError(400, "thumbnail is required." )
    }
    console.log(thumbnail.url) //debug

    //starting the video file processing
    const videoLocalpath = req.files?.videofile?.path

    if(!videoLocalpath){
        throw new ApiError(400, "videofile is required." )
    }

    //getting metadata like duration using ffmpeg.ffprobe library
    const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoLocalpath, (err, data) => {
            if (err) reject (err);
            else resolve(data)
        });
    })
    const durationInSeconds = metadata.format.duration;
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    const videoDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    //uploading video file on cloudinary in segments using ffmpeg segmentation
    const outputfolder = "./public/videoOutput/hls";
    const playListFilePath = `${outputfolder}/playList.m3u8`
    //ensure if the outputfolder exist if not then explicitly create it
    if (!fs.existsSync(outputfolder)){
        fs.mkdirSync(outputfolder, { recursive : true }); //recursive means check for existing if none then make new
    }
    console.log(playListFilePath) //debug

    ffmpeg(videoLocalpath)
        .outputOptions([
            '-codec:v libx264', // H.264 baseline profile for video compatibility
            '-codec:a aac', //codec for audio compatibility
            '-start_number 0', // Start segment number from 0
            '-hls_time 10', // Each segment lasts 10 seconds
            `-hls_list_size 0`, // No limit on playlist size
            `-hls_segment_filename ${outputfolder}/segment%03d.ts`, //segment naming like 001,002,003..
            '-hls_playlist_type vod', //to specify the video on demand type 
            '-f hls', // Output format is HLS
        ])
        .output(playListFilePath)
        .on('start', () => {console.log("ffmpeg segmentation started")} )
        .on('end', async () => {
            const playlist = await uploadOnCloudinary(playListFilePath)
            const segmentFiles = fs.readdirSync(outputfolder).filter(file => file.endsWith('.ts'));
            //This line retrieves all the files in the outputfolder and filters them to find 
            //only the .ts files, which are the video segments created by ffmpeg.
            
            const segmentUploads = await Promise.all(segmentFiles.map(async (file) => {
                const filePath = `${outputfolder}/${file}`;
                try {
                    return await uploadOnCloudinary(filePath);
                } catch (error) {
                    throw new ApiError(500, `Error uploading segment ${file}: ${error.message}`);
                }
            }));
            
            const qualityArray = segmentUploads.map(upload => ({
                resolution : '360p',
                url :upload.secure_url
            }))

            const newVideo = await Video.create({
                title,
                description,
                tags,
                ispublished : true,
                owner: req.user._id,
                videofile: playlist.secure_url,
                thumbnail : thumbnail.url,
                duration: videoDuration,
                quality: qualityArray,
            })

            // Cleanup temp files from outputfolder
            fs.unlinkSync(videoLocalpath);
            fs.unlinkSync(playListFilePath);
            segmentFiles.forEach(file => fs.unlinkSync(`${outputfolder}/${file}`));

            return res.status(200).json(new ApiResponse(200, newVideo, "video file created and uploaded successfully"))
        })
        .on('error', (err) => {
            throw new ApiError(400, `error while procesing the video ${err.message}`)
        })
        .run()

        /* ffmpeg skeleton code
        ffmpeg(videoFilePath)
        .outputOptions([])
        .output()
        .on('start')
        .on('end')
        .run()*/
})

const getVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid video id")
    }

    const video = await Video.findById(videoId)
                            .populate("owner", "username fullName email avatar")
                            .populate("comments", "content owner createdAt replies")

    if (!video){
        throw new ApiError(400, "video not found")
    }
    
    return res.status(200).json(new ApiResponse(200, video, "video fetched successfully"))
})

const updateVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params
    const { title, description} = req.body

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid video id")
    }

    let thumbnail;
    const thumbnailLocalpath = req.files?.thumbnail?.path
    if (thumbnailLocalpath){
        const newThumbnail = await uploadOnCloudinary(thumbnailLocalpath)
        if (!newThumbnail) {
            throw new ApiError(400, "Error uploading the new thumbnail");
        }
        thumbnail = newThumbnail.url;
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set : {
                title,
                description,
                thumbnail : thumbnail
            }
        },
        { new : true, runValidators : true }
    )

    if (!video){
        throw new ApiError(400, "video not found")
    }

    return res.status(200).json(new ApiResponse(200, video, "video update successfully"))
})

const deleteVideo = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "invalid video id")
    }

    const video = await Video.findById(videoId);

    if (!video){
        throw new ApiError(400, "video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // Delete all comments and replies associated with the video
    await Comment.deleteMany({ video: video._id }); 
    //comments are stored with a video field in the Comment model 
    //(i.e., each comment has a reference to the associated video), 
    //this is an efficient way to delete all comments related to the video.

    await video.deleteOne();

    return res.status(200)
              .json(new ApiResponse(200, { videoId }, "Video deleted successfully"));
})

const getAllVideos = asyncHandler (async (req, res) => {
    const { page = 1, limit = 10 } = req.query

    const options = {
        page : parseInt(page),
        limit : parseInt(limit),
        sort : { createdAt : -1 },
        populate : { path : 'owner', select : 'userName avatar' }
    }

    const videos = await Video.aggregatePaginate(Video.aggregate([]), options)

    return res.status(200).json(new ApiResponse(200, videos, "video fetched successfully"))
})

const serchVideos = asyncHandler (async (req, res) => {
    const { query } = req.query

    const videos = await Video.find({
        title : { $regex : query, $options : 'i' }
    })

    return res.status(200).json(new ApiResponse(200, videos, "Search results"));
})

const incrimentViews = asyncHandler (async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)){
        throw new ApiError(400, "not valid vedio Id")
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc : { views : 1 } },
        { new : true }
    )

    if (!video){
        throw new ApiError(400, "Video not found")
    }

    return res.status(200)
              .json(new ApiResponse(200, video, "views incremented successfully"))
})

export {
    uploadVideo,
    getVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    serchVideos,
    incrimentViews
};