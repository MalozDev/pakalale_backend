import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';

// ------------------------------------------------------------------
// VERIFICATION SERVICE
// ------------------------------------------------------------------

export const submitVerification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.shopId as string;
    const userId = req.user.id;
    const { documentUrl } = req.body; // e.g., URL to an S3 bucket with their Tax ID or Passport

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return next(new AppError('Shop not found', 404));
    
    if (shop.ownerId !== userId) {
      return next(new AppError('You can only verify your own shop', 403));
    }

    // Check for pending
    const existingVP = await prisma.shopVerification.findFirst({
        where: { shopId, status: 'PENDING'}
    });
    
    if (existingVP) {
        return next(new AppError('Verification request already pending for this shop.', 400));
    }

    const verification = await prisma.shopVerification.create({
      data: {
        shopId,
        documentUrl,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Verification document submitted successfully',
      data: { verification }
    });
  } catch (error) {
    next(error);
  }
};

export const reviewVerification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ONLY ADMINS CAN ACCESS THIS ROUTE (protected via restrictTo('ADMIN') middleware)
    const verificationId = req.params.id as string;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return next(new AppError('Invalid status. Must be APPROVED or REJECTED.', 400));
    }

    const verification = await prisma.shopVerification.update({
      where: { id: verificationId },
      data: {
        status,
        reviewedAt: new Date()
      }
    });

    // If approved, update the actual Shop table to show the verified badge across the app!
    if (status === 'APPROVED') {
      await prisma.shop.update({
        where: { id: verification.shopId },
        data: { verified: true }
      });
      
      // TODO: Here we could optionally use Kafka to notify the Shop Owner via Socket.IO
    }

    res.status(200).json({
      status: 'success',
      message: `Shop verification ${status.toLowerCase()}`,
      data: { verification }
    });
  } catch (error) {
    next(error);
  }
};
