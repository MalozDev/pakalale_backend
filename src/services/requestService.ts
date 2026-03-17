import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

export const createRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, location } = req.body;
    const customerId = req.user.id;

    // 1. Save the request to the database
    const newRequest = await prisma.request.create({
      data: {
        customerId,
        title,
        description,
        location,
      },
    });

    // 2. We also want this to show up in the universal "feed" as a customer post.
    // In our schema, we have a Post table that acts as the feed.
    const newPost = await prisma.post.create({
      data: {
        authorId: customerId,
        postType: 'REQUEST',
        content: `I am looking for: ${title} - ${description}`,
        location,
      }
    });

    // 3. Publish asynchronous Kafka event 'requestCreated'
    // Other microservices (like Notifications or Feed caching) will listen to this.
    try {
      await producer.send({
        topic: 'request-events',
        messages: [
          { 
            key: newRequest.id, 
            value: JSON.stringify({
               type: 'requestCreated',
               data: newRequest
            }) 
          },
        ],
      });
    } catch (kafkaError) {
      console.error('Failed to publish requestCreated event:', kafkaError);
      // We don't fail the API call if Kafka is down, just log it. 
      // In production, we'd have a dead-letter queue or retry mechanism.
    }

    res.status(201).json({
      status: 'success',
      data: {
        request: newRequest,
        feedPost: newPost
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requests = await prisma.request.findMany({
      where: {
        status: 'OPEN'
      },
      include: {
        customer: {
          select: { name: true, avatarUrl: true }
        },
        _count: {
          select: { responses: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: requests.length,
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

export const getRequestDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.id as string;
    
    const requestItem = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        customer: {
          select: { id: true, name: true, avatarUrl: true }
        },
        responses: {
          include: {
            shop: {
              select: { id: true, name: true, rating: true, verified: true }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!requestItem) {
      return next(new AppError('No request found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { request: requestItem },
    });
  } catch (error) {
    next(error);
  }
};
