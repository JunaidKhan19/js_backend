class ApiError extends Error {
    constructor(
        statusCode ,
        message = "Something went wrong!!!",
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null //read documentation for this.data in Error to see more
        this.message = message
        this.errors = errors
        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }        
    }
}

export { ApiError };
