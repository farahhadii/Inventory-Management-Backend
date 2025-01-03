/* Error-handling middleware functions can be used to catch and handle errors that occur during the processing of a request before a response 
is sent back to the client. If an error occurs in any of the route handlers, it can be passed down the middleware chain until it reaches an error-handling middleware function.
*/ 

const errorHandler = (err,req,res,next) => {
    const statusCode = res.statusCode ? 
    res.statusCode: 500
    res.status(statusCode);
    res.json({ 
        message: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : null
    });
};

module.exports = errorHandler