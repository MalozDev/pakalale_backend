import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';

export const searchPlatform = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    
    // We want to search across Products, Shops, and active Requests simultaneously
    // If no query is provided, we just return empty
    if (!query || query.trim().length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          products: [],
          shops: [],
          requests: []
        }
      });
    }

    // 1. Search Products (using Prisma's native contains for ILIKE mapping)
    // For a truly massive platform, this would be offloaded to Elasticsearch,
    // but Postgres ILIKE is perfectly fast enough for our early stage MVP.
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 15,
      include: {
        shop: { select: { id: true, name: true, location: true, verified: true } },
        images: { take: 1 }
      }
    });

    // 2. Search Shops directly
    const shops = await prisma.shop.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        rating: true,
        verified: true,
      }
    });

    // 3. Search Open Customer Requests (so a shop owner can search "PS5" to see who wants to buy one!)
    const requests = await prisma.request.findMany({
      where: {
        status: 'OPEN',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10,
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    res.status(200).json({
      status: 'success',
      results: products.length + shops.length + requests.length,
      data: {
        products,
        shops,
        requests
      }
    });
  } catch (error) {
    next(error);
  }
};
