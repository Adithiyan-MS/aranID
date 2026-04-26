// This function wraps our controllers and catches any errors, 
// passing them to the next middleware (our Error Handler).
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
