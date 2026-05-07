require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mediaRoutes = require('./routes/media-routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const {connectToRabbitMQ,publishEvent,consumeEvent}= require('./utils/rabbitmq');
const {handlePostDeleted} = require('./eventHandlers/media-event-handlers')
const Redis = require('ioredis');

const redisClient = new Redis(process.env.REDIS_URL);
const app = express();
const PORT = process.env.PORT ||3003;


mongoose.connect(process.env.MONGODB_URI)
    .then(()=>logger.info('Connected to mongoDB'))
    .catch((e)=>logger.error('Mongo connection error',e));

app.use(cors());
app.use(helmet());
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
app.use('/api/media/upload',sensitiveEndpointsLimiter);
//routes ->pass redisClient to routes

app.use('/api/media',mediaRoutes);

app.use(errorHandler);

async function startServer(){
   try{
       await  connectToRabbitMQ();
       //consume all the events
       await consumeEvent('post.deleted',handlePostDeleted);
       app.listen(PORT,()=>{
            logger.info(`Media service running on port  ${PORT}`)
            });
    }catch (error) {
    console.error("🔥 STARTUP ERROR:", error); // shows full error in terminal

    logger.error('failed to connect to server', {
        message: error.message,
        stack: error.stack
    });

    process.exit(1);
}
}
startServer();

//unhandled promise rejection
process.on('unhandledRejection',(reason,promise)=>{
    logger.error('Unhandled Rejection at',"reason",reason);
})