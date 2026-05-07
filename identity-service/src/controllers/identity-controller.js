const User = require('../models/user');
const logger = require('../utils/logger');
const {validateRegistration,validateLogin} = require('../utils/validation');

const generateToken  = require('../utils/generateToken');
const RefreshToken = require('../models/refresh-token');

//user registration
const registerUser = async(req,res)=>{
    logger.info('Registration endpoint hit....');
    try{
        //validate input
        const {error} = validateRegistration(req.body);
        if(error){
            logger.warn('Validation error', error.details[0].message)
            return res.status(400).json({
                success:false,
                message:  error.details[0].message
            });
           }
           
           //2. Extract data
            const {username, email, password} = req.body;
           
            //3. Check if user exists
            let user = await User.findOne({$or : [{username},{email}]});
            if(user){
                 logger.warn('User already exists');
                  return res.status(400).json({
                        success:false,
                        message:  'User already exists'
                  });

            }
            
            //4 . Create user
             user = new User({username, email, password});
             await user.save();
             logger.info(`User created: ${user._id}`);  
            
             //5. Generate tokens
            const {accessToken,refreshToken} = await generateToken(user);
            
            //6. Response 
            res.status(201).json({
                success:true,
                message: 'User registered successfully!',
                accessToken,
                refreshToken
            })
        
        }catch(e){
            logger.error('Registration error occurred',e)
            res.status(500).json({
                success:false,
                message: 'Internal server error'
            })
        }
    }
//user login
const loginUser = async(req,res)=>{
     logger.info('Login endpoint hit....');
     try{
         const {error} = validateLogin(req.body);
          if(error){
            logger.warn('Validation error', error.details[0].message)
            return res.status(400).json({
                success:false,
                message:  error.details[0].message
            });
           }

           const {email, password} =req.body;
           const user = await User.findOne({email});

           if(!user){
            logger.warn('Invalid user');
            return res.status(400).json({
               success: false,
               message:  'Invalid credentials'
            })
           }
           logger.info('User found, checking password');

           //user valid password or not 
            const isValidPassword = await user.comparePassword(password);
            if(!isValidPassword){
               logger.warn('Invalid password');
               return res.status(400).json({
                success: false,
                message: 'Invalid password'
               }) 
            } 
             logger.info('Password correct, generating token');
            //generate access token
            const {accessToken, refreshToken} = await generateToken(user);

            res.json({
                accessToken,
                refreshToken,
                userId : user._id
            })

     }catch(e){
            logger.error('Login error occurred',e)
            res.status(500).json({
                success:false,
                message: 'Internal server error'
            })
        }
}
//refresh token
const refreshTokenUser = async(req,res)=>{
       logger.info('Refresh Token endpoint hit....');
       try{
            const {refreshToken} = req.body();
            if(!refreshToken){
               logger.warn('Refresh Token missing');
               return res.status(400).json({
               success: false,
               message:  'Refresh Token missing'
            })
            }
            const storedToken =  await RefreshToken.findOne({token: refreshToken});
            if(!storedToken || storedToken.expiresAt < new Date()){
               logger.warn('Invalid or expired refresh token ');
               res.status(401).json({
                    success: false,
                    message: 'Invalid or expired refresh token'
               }) 
            }
           const user = await  User.findById(storedToken.user);
           if(!user){
            logger.warn('User not found');
            res.status(401).json({
                    success: false,
                    message: 'User not found'
            }) 
           }
           const {
            accessToken:newAccessToken, 
            refreshToken:newRefreshToken
                                    } = await generateToken(user);
            //delete the old refresh token
            await RefreshToken.deleteOne({_id: storedToken._id});
             res.json({
                accessToken  : newAccessToken,
                refreshToken : newAccessToken
             }) 

       }catch(e){
            logger.error('Refresh Token error occurred',e)
            res.status(500).json({
                success:false,
                message: 'Internal server error'
            })
        }
}
//logout
const logoutUser = async(req,res)=>{
    logger.info('Logout endpoint hit....');
    try{
       const {refreshToken} = req.body;
       if(!refreshToken){
               logger.warn('Refresh Token missing');
               return res.status(400).json({
               success: false,
               message:  'Refresh Token missing'
         })
       }
       await RefreshToken.deleteOne({token: refreshToken });
       logger.info('Refresh token deleted for logout');
       res.json({
            success: true,
            message: 'Logged out successfully!',

       })

    }catch(e){
            logger.error('Error while logging out',e)
            res.status(500).json({
                success:false,
                message: 'Internal server error'
            })
        }

}
module.exports ={
    registerUser,
    loginUser,
    refreshTokenUser,
    logoutUser
}