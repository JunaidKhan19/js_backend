import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";//file system to do operations on a file

cloudinary.config({
    cloud_name: "dyhk4id3o",//process.env.CLOUDINARY_CLOUD_NAME, 
    api_key:  "433286171757544",//process.env.CLOUDINARY_API_KEY, 
    api_secret:  "qF9Blm5gaTkoLAb6ZaUlqrckxPs"//process.env.CLOUDINARY_API_SECRET 
    // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        //upload file on cloudinary
        //.upload(url or any filepath, upload options read them in cloudinary)
        const response = await cloudinary.v2.uploader.upload(localFilePath, {
            resource_type : "auto" 
        })
        console.log("file has been uploaded successfully", response.url);
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the operation got failed
        return response ;
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the operation got failed
        return null
    }
}

export {uploadOnCloudinary};