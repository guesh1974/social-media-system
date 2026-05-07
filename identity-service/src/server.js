require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const {rateLimit} =  require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const routes = require('./routes/identity-service');
const errorHandler = require('./middleware/errorHandler');
const app = express();

const PORT = process.env.PORT || 3001;
//connect to database
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

//DDos protection and  rate limiting
const rateLimiter = new RateLimiterRedis({
    storeClient :   redisClient,
    keyPrefix : 'middleware',
    points :   10,
    duration : 1
})

//apply the 
app.use((req,res,next)=>{
    rateLimiter.consume(req.ip)
    .then(()=> next())
    .catch(()=>{
        logger.warn(`Rate limit exceeded for IP:${req.ip}`)
        res.status(429).json({success: false, message: 'Too many requests'})
    });
});

//IP based rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
    windowMs : 15 *  60 * 1000,//15 min
    max :  50,//max requests
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
app.use('/api/auth/register',sensitiveEndpointsLimiter);

//Routes 
app.use('/api/auth',routes);

//error handlers
app.use(errorHandler);
app.listen(PORT,()=>{
    logger.info(`Identity service running on port  ${PORT}`)
});


//unhandled promise rejection
process.on('unhandledRejection',(reason,promise)=>{
    logger.error('Unhandled Rejection at',"reason",reason);
})
