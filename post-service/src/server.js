require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const postRoutes = require('./routes/post-routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const redisMiddleware = require('./middleware/redisMiddleware');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { connectToRabbitMQ } = require('./utils/rabbitmq');

const app = express();


const PORT = process.env.PORT || 3002;

mongoose.connect(process.env.MONGODB_URI)
    .then(()=>logger.info('Connected to mongoDB'))
    .catch((e)=>logger.error('Mongo connection error',e));

const  redisClient = new Redis(process.env.REDIS_URL);
    //middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use((req,res,next)=>{
    logger.info( `Received ${req.method} request to ${req.url}`);
    logger.info( `Request body, ${req.body} `);
    next();
});
//*** Homework - Implement IP based rate limiting for sensitive endpoints
//IP based rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
    windowMs : 15 *  60 * 1000,//15 min
    max :  100,//max requests
    standardHeaders :  true,
    legacyHeaders : false,
    handler : (req,res) =>{
        logger.warn(`sensitive endpoint rate limit exceeded for IP:${req.ip} `);
        res.status(429).json({success: false, message: 'Too many requests'})
    },
    store: new RedisStore({
        sendCommand:(...args)=>redisClient.call(...args)
    }),
});

//Apply the sensitiveEndpointsLimiter to our routes
app.use('/api/post/create-post',sensitiveEndpointsLimiter);
//routes ->pass redisClient to routes

app.use('/api/post',redisMiddleware(redisClient),postRoutes);

app.use(errorHandler);
async function startServer(){
    try{
       await  connectToRabbitMQ();
       app.listen(PORT,()=>{
            logger.info(`Post service running on port  ${PORT}`)
            });
    }catch(error){
        logger.error('failed to connect to server');
        process.exit(1);
    }
}
startServer();

//unhandled promise rejection
process.on('unhandledRejection',(reason,promise)=>{
    logger.error('Unhandled Rejection at',"reason",reason);
})
