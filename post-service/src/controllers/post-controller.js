const logger = require('../utils/logger');
const Post = require('../models/Post');
const {validateCreatePost}  = require('../utils/validation');
const { json } = require('express');
const {publishEvent}=require('../utils/rabbitmq');

async function invalidatePostCache(req,input){
    const cachedkey = `post:${input}`;
    await req.redisClient.del(cachedkey);
    const keys = await req.redisClient.keys("posts:*");
    if(keys.length > 0){
        await req.redisClient.del(keys);
    }

}
const createPost = async(req,res)=>{
    logger.info('Create post endpoint hit....');
    try{
         //validate input
        const {error} = validateCreatePost(req.body);
        if(error){
            logger.warn('Validation error', error.details[0].message)
            return res.status(400).json({
                success:false,
                message:  error.details[0].message
            });
        }
        const {content,mediaIds} = req.body;
        const newlyCreatedPost = new Post({
            user: req.user.userId,
            content,
            mediaIds : mediaIds || []
        });

        await newlyCreatedPost.save();
        await publishEvent('post.created',{
            postId:newlyCreatedPost._id.toString(),
            userId:newlyCreatedPost.user.toString(),
            content: newlyCreatedPost.content,
            createdAt: newlyCreatedPost.createdAt,
        });
        await invalidatePostCache(req,newlyCreatedPost._id.toString());

        // ✅ Use Redis (dependency injection)
        await req.redisClient.set(
            `post:${newlyCreatedPost._id}`,
            JSON.stringify(newlyCreatedPost),
            'EX',
            60
        );
        logger.info('Post created successfully',newlyCreatedPost);
        res.status(201).json({
            success: true,
            message: 'Post created successfully'
        });

    }catch(e){
        logger.error('Error creating post ',e);
        res.status(500).json({
            success: false,
            message: 'Error creating post',
        })
    }
}
const getAllPosts = async(req,res)=>{
    try{
        const page = parseInt(req.query.page)|| 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;


        const cacheKey = `posts: ${page}: ${limit}`;
        const cachedPosts = await req.redisClient.get(cacheKey);

        
        if(cachedPosts){
            return res.json(JSON.parse(cachedPosts))
        }

        const posts = await Post.find({})
            .sort({createdAt : -1})
            .skip(startIndex)
            .limit(limit);

        const totalNoOfPosts = await Post.countDocuments();

        const result  = {
            posts,
            currentPage :  page,
            totalPages:  Math.ceil(totalNoOfPosts/limit),
            totalPosts : totalNoOfPosts
        }

        //save your posts in redis cache
        await req.redisClient.setex(cacheKey,300,JSON.stringify(result));


        res.json(result);

    }catch(e){
        logger.error('Error fetching posts',e);
        res.status(500).json({
            success: false,
            message: 'Error fetching posts',
        })
    }
}
const getPost = async(req,res)=>{
    try{
        const postId = req.params.id;
        const cachekey = `post:${postId}`;
        const cachedPost = await req.redisClient.get(cachekey);

        if(cachedPost){
            return res.json(JSON.parse(cachedPost))
        }
        const singlePostDetailsbyId = await Post.findById(postId);
        

        if(!singlePostDetailsbyId){
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            })
        }
        await  req.redisClient.setex(cachekey,3600, JSON.stringify(singlePostDetailsbyId));

        
        res.json(singlePostDetailsbyId);

    }catch(e){
        logger.error('Error fetching post',e);
        res.status(500).json({
            success: false,
            message: 'Error fetching post by ID',
        })
    }
}
const deletePost = async(req,res)=>{
    try{
        const post = await Post.findOneAndDelete({
            _id: req.params.id,
            user: req.user.userId
        });

        if(!post){
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            })
        }
        //publish post delete method
        await publishEvent('post.deleted',{
            postId:post._id.toString(),
            userId: req.user.userId,
            mediaIds: post.mediaIds
        });
        await invalidatePostCache(req,req.params.id);
        res.json({
            success: true,
            message: 'Post deleted successfully'
        })
    }catch(e){
        logger.error('Error deleting post',e);
        res.status(500).json({
            success: false,
            message: 'Error deleting post',
        })
    }
}
const updatePost = async (req, res) => {
    logger.info('Update post endpoint hit....');

    try {
        const postId = req.params.id;

        // 1. Validate input (optional but recommended)
        const { error } = validateCreatePost(req.body);
        if (error) {
            logger.warn('Validation error', error.details[0].message);
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        const { content, mediaIds } = req.body;

        // 2. Find and update post (only owner can update)
        const updatedPost = await Post.findOneAndUpdate(
            {
                _id: postId,
                user: req.user.userId
            },
            {
                content,
                mediaIds: mediaIds || []
            },
            {
                new: true // return updated document
            }
        );

        if (!updatedPost) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or unauthorized'
            });
        }

        // 3. Invalidate cache
        await invalidatePostCache(req, postId);

        // 4. Update single post cache
        await req.redisClient.set(
            `post:${postId}`,
            JSON.stringify(updatedPost),
            'EX',
            300
        );

        logger.info('Post updated successfully', updatedPost);

        res.json({
            success: true,
            message: 'Post updated successfully',
            post: updatedPost
        });

    } catch (e) {
        logger.error('Error updating post', e);
        res.status(500).json({
            success: false,
            message: 'Error updating post'
        });
    }
};
module.exports ={
    createPost,
    getAllPosts,
    getPost,
    deletePost,
    updatePost
}