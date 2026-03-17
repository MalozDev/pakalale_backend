import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
// Need AuthRequest to access req.user
import { AuthRequest } from '../middleware/authMiddleware';

// ------------------------------------------------------------------
// SHOP OPERATIONS
// ------------------------------------------------------------------

export const createShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, location, latitude, longitude } = req.body;
    const userId = req.user.id;

    // A user can own multiple shops in our schema, but let's keep it simple
    const newShop = await prisma.shop.create({
      data: {
        ownerId: userId,
        name,
        description,
        location,
        latitude,
        longitude,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        shop: newShop,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllShops = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic implementation: Later we will add Geo-Search (PostGIS / Haversine) here!
    const shops = await prisma.shop.findMany({
      include: {
        owner: {
          select: { name: true, avatarUrl: true },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      results: shops.length,
      data: { shops },
    });
  } catch (error) {
    next(error);
  }
};

export const getShop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.id as string;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        products: {
          include: { images: true }
        },
        reviews: true,
      },
    });

    if (!shop) {
      return next(new AppError('No shop found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { shop },
    });
  } catch (error) {
    next(error);
  }
};

export const updateShop = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.id as string;
    const userId = req.user.id;

    // Verify ownership
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return next(new AppError('Shop not found', 404));
    if (shop.ownerId !== userId && req.user.role !== 'ADMIN') {
      return next(new AppError('You do not have permission to update this shop', 403));
    }

    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: req.body, // In production, whitelist allowed fields
    });

    res.status(200).json({
      status: 'success',
      data: { shop: updatedShop },
    });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------
// PRODUCT OPERATIONS
// ------------------------------------------------------------------

export const addProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = req.params.shopId as string;
    const userId = req.user.id;
    const { name, description, price, quantity, category, imageUrls } = req.body;

    // Verify ownership
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return next(new AppError('Shop not found', 404));
    if (shop.ownerId !== userId && req.user.role !== 'ADMIN') {
      return next(new AppError('You do not have permission to add products to this shop', 403));
    }

    // Create product and its images in a transaction
    const newProduct = await prisma.product.create({
      data: {
        shopId,
        name,
        description,
        price,
        quantity,
        category,
        images: {
          create: imageUrls ? imageUrls.map((url: string) => ({ imageUrl: url })) : [],
        },
      },
      include: { images: true },
    });

    res.status(201).json({
      status: 'success',
      data: { product: newProduct },
    });
  } catch (error) {
    next(error);
  }
};
