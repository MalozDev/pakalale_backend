import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';

// ------------------------------------------------------------------
// REVIEW SERVICE
// ------------------------------------------------------------------

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.shopId as string;
    const customerId = req.user.id;
    const { rating, comment } = req.body;

    // Check if the shop exists
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return next(new AppError('Shop not found', 404));

    // Optional: Check if they already reviewed this shop to prevent spam
    const existingReview = await prisma.shopReview.findFirst({
      where: { shopId, customerId }
    });
    
    if (existingReview) {
      return next(new AppError('You have already reviewed this shop', 400));
    }

    // Create the review
    const newReview = await prisma.shopReview.create({
      data: {
        shopId,
        customerId,
        rating: parseFloat(rating),
        comment,
      }
    });

    // Recalculate the shop's average rating purely in Postgres
    const aggregates = await prisma.shopReview.aggregate({
      where: { shopId },
      _avg: { rating: true }
    });

    const newAvgRating = aggregates._avg.rating || 0;

    await prisma.shop.update({
      where: { id: shopId },
      data: { rating: newAvgRating }
    });

    res.status(201).json({
      status: 'success',
      data: { review: newReview, newAverage: newAvgRating }
    });
  } catch (error) {
    next(error);
  }
};

export const getShopReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.shopId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await prisma.shopReview.findMany({
      where: { shopId },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews }
    });
  } catch (error) {
    next(error);
  }
};
