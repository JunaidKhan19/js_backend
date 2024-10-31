import { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    console.log("Request body:", req.body); // Log the request body for debuggingrs

    if (!name || !description){
        throw new ApiError(400, "name and description are required fields")
    }

    const playList = await Playlist.create({
        name,
        description,
        owner : req.user._id
    })

    if (!playList){
        throw new ApiError(400, "playlist was not created")
    }

    return res.status(200).json(new ApiResponse(200, playList, "playlist created successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "not a valid playlist id or video id")
    }

    const playList = await Playlist.findById(playlistId)
    const video = await Video.findById(videoId)

    if (!playList) {
        throw new ApiError(404, "Playlist not found.");
    }

    if (!video) {
        throw new ApiError(404, "Video not found.");
    }

    if (playList.videos.includes(videoId.toString())){
        throw new ApiError(400, "video already exists in playlist")
    }

    playList.videos.push(videoId);
    await playList.save();

    await playList.populate({
        path : "videos",
        select :"videofile thumbnail title owner"
    })

    return res.status(200).json(new ApiResponse(200, playList, "video added to playlist"))
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if (!isValidObjectId(userId)){
        throw new ApiError(400, "user not found. playlist can't be fetched")
    }

    const playList = await Playlist.find({ owner : userId })

    if (!playList || playList.length === 0){
        throw new ApiError(400, "playlist for requested user cant be fetched")
    }

    return res.status(200).json(new ApiResponse(200, playList, "playlist fetched successfully")) 
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)){
        throw new ApiError(400, "not a valid playlist id")
    }

    const playList = await Playlist.findById(playlistId)
                                   .populate("owner", "fullName userName email")
                                   .populate("videos", "title description thumbnail")

    if (!playList){
        throw new ApiError(400, "playlist not found")
    }

    return res.status(200).json(new ApiResponse(200, playList, "playlist and videos fetched successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const {name, description} = req.body

    if (!isValidObjectId(playlistId)){
        throw new ApiError(400, "playlist id not found")
    }

    if (!(name || description)){
        throw new ApiError(400, "name and description are required fields")
    }

    const playList = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set : {
                name , 
                description
            }
        },
        { new : true, runValidators : true }
    )

    if (!playList){
        throw new ApiError(400, "playlist not updated")
    }

    return res.status(200).json(new ApiResponse(200, playList, "playlist updated successfully"))
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "not a valid playlist id or video id")
    }

    const playList = await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull : { videos : videoId} },
        { new : true }
    )

    if (!playList){
        throw new ApiError(400, "playlist not found")
    }

    return res.status(200).json(new ApiResponse(200, playList, "video removed from playlist"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)){
        throw new ApiError(400, "not a valid playlist id or video id")
    }

    const playList = await Playlist.findById(playlistId)

    if (!playList) {
        throw new ApiError(404, "Playlist not found.");
    }

    if (playList.owner.toString() !== req.user._id.toString()){
        throw new ApiError(400, "you are not a verified user to delete the playlist")
    }

    await playList.deleteOne();

    return res.status(200).json(new ApiResponse(200, {}, "playlist deleted successfully"))
})

export {
    createPlaylist,
    addVideoToPlaylist,
    getUserPlaylists,
    getPlaylistById,
    updatePlaylist,
    removeVideoFromPlaylist,
    deletePlaylist    
}