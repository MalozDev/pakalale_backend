import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import redisClient from '../config/redis';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

export const createPost = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, imageUrl, location, shopId } = req.body;
    const authorId = req.user.id;
    // We infer the post type: if shopId is provided, it's a promotion. Otherwise, it's a request string.
    const postType = shopId ? 'SHOP_POST' : 'REQUEST';

    // 1. Create the Post in the DB
    const newPost = await prisma.post.create({
      data: {
        authorId,
        postType,
        content,
        imageUrl,
        location,
        shopId: shopId || null,
      },
      include: {
        author: {
          select: { name: true, avatarUrl: true }
        },
        shop: {
          select: { name: true, rating: true, verified: true }
        }
      }
    });

    // 2. Invalidate the global feed cache
    // Because the feed just changed, we clear the cached version so the next person 
    // retrieving the feed pulls the fresh data from Postgres.
    try {
      await redisClient.del('global_feed:page:1');
    } catch (redisErr) {
      console.warn('Redis Cache Invalidation Failed', redisErr);
    }

    res.status(201).json({
      status: 'success',
      data: { post: newPost }
    });
  } catch (error) {
    next(error);
  }
};

export const getFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const cacheKey = `global_feed:page:${page}`;

    // 1. Try to fetch from Redis Cache first
    try {
      const cachedFeed = await redisClient.get(cacheKey);
      if (cachedFeed) {
        return res.status(200).json({
          status: 'success',
          source: 'cache',
          results: JSON.parse(cachedFeed).length,
          data: { posts: JSON.parse(cachedFeed) }
        });
      }
    } catch (redisErr) {
      console.warn('Redis Cache Read Failed - Falling back to DB', redisErr);
    }

    // 2. If it's a cache miss, fetch from PostgreSQL
    const skip = (page - 1) * limit;
    
    // We want the newest posts first, and we JOIN the author and shop details
    const posts = await prisma.post.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true, role: true }
        },
        shop: {
          select: { id: true, name: true, location: true, verified: true }
        }
      }
    });

    // 3. Save the result to Redis Cache for the next 60 seconds
    try {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(posts));
    } catch (redisErr) {
      console.warn('Redis Cache Write Failed', redisErr);
    }

    res.status(200).json({
      status: 'success',
      source: 'database',
      results: posts.length,
      data: { posts }
    });
  } catch (error) {
    next(error);
  }
};

export const getPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = req.params.id as string;
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          shop: { select: { id: true, name: true, location: true, verified: true } }
        }
      });
  
      if (!post) return next(new AppError('Post not found', 404));
  
      res.status(200).json({
        status: 'success',
        data: { post }
      });
    } catch (error) {
      next(error);
    }
  };
