const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.error(`Error: ${err.stack}`);

    if (err.name === 'CastError') {
        error.message = 'Resource not found';
        res.status(404);
    }

    if (err.code === 11000) {
        error.message = 'Duplicate field value entered';
        res.status(400);
    }

    if (err.name === 'ValidationError') {
        error.message = Object.values(err.errors).map((val) => val.message);
        res.status(400);
    }

    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
        success: false,
        error: error.message || 'Server Error'
    });
};

export default errorHandler;
