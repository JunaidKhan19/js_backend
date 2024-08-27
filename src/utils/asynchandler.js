//approach 1 using promises
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
               .catch((error) => next(error))
    }
}

export {asyncHandler} ; 

/*
//approach 2 using try catch
const asyncHandler = (requestHandler) => async(req, res, next) => {
    try {
        await requestHandler(req, res, next)
    } catch (error) {
        res.status(err.code || 500).json({
            success: false,
            message:err.message
        })
    }
}
*/