const redisMiddleware = (redisClient) => {
    return (req, res, next) => {
        req.redisClient = redisClient;
        next();
    };
};

module.exports = redisMiddleware;