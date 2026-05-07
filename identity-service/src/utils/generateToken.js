const jwt = require('jsonwebtoken');

const RefreshToken = require('../models/refresh-token');

const crypto = require('crypto');


const generateToken =async(user)=>{
    const accessToken = jwt.sign({
                            userId: user._id,
                            username: user.username, 
                    }, process.env.JWT_SECRET,{expiresIn:'60m'});
    // 1. Generate raw refresh token
    const refreshToken = crypto
                        .randomBytes(64)
                        .toString('hex');
    // 2. hash token before storing
    const hashedToken  = crypto
                        .createHash('sha256')
                        .update(refreshToken)
                        .digest('hex');

    //set expiration 
    const expiresAt =  new Date(Date.now()+7*24*60*60*1000);//
    //save to RefreshToken model
    await RefreshToken.create({
                        token:hashedToken,
                        user:user._id,
                        expiresAt
    })
    return {accessToken, refreshToken};
}

module.exports = generateToken;