const handleSuccessResponse = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

const handleErrorResponse = (res, message, statusCode = 500) => {
    console.error(message);
    res.status(statusCode).json({
        success: false,
        message: message || 'Internal Server Error'
    });
};

module.exports = { handleSuccessResponse, handleErrorResponse };