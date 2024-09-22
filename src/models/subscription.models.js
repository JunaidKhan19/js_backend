import mongoose, {Schema} from "mongoose"

const subscriptionSchema = new mongoose.Schema({
    subscriber : {
        type : Schema.Types.ObjectId, //one who is subscribing
        ref : "User"
    },
    channel : {
        type : Schema.Types.ObjectId, //one who gets subscribed
        ref : "User"
    }
}, {timestamps: true})

export const Subscription = mongoose.model("Subscription", subscriptionSchema)