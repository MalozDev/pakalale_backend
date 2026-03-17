import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

export const startConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { shopId } = req.body;
    const userId = req.user.id;

    // Check if a conversation between this customer and shop already exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        customerId: userId,
        shopId: shopId,
      },
    });

    if (!conversation) {
      // If it doesn't exist, create a new one
      conversation = await prisma.conversation.create({
        data: {
          customerId: userId,
          shopId: shopId,
        },
      });
    }

    res.status(200).json({
      status: 'success',
      data: { conversation }
    });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Determine query based on role. 
    // Customers fetch conversations they started. 
    // Shop_Owners fetch conversations linked to their shops.
    let whereClause = {};

    if (userRole === 'SHOP_OWNER') {
      // A user might own multiple shops, find all their shop IDs finding conversations for those shops
      const userShops = await prisma.shop.findMany({
        where: { ownerId: userId },
        select: { id: true }
      });
      const shopIds = userShops.map(s => s.id);
      
      whereClause = { shopId: { in: shopIds } };
    } else {
      whereClause = { customerId: userId };
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } },
        shop: { select: { id: true, name: true, ownerId: true } },
        // Get the latest message to show in the preview list
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: conversations.length,
      data: { conversations }
    });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const userId = req.user.id;

    // Basic security: Ensure the user is a participant of this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { shop: true }
    });

    if (!conversation) return next(new AppError('Conversation not found', 404));

    if (conversation.customerId !== userId && conversation.shop.ownerId !== userId && req.user.role !== 'ADMIN') {
      return next(new AppError('You are not a participant of this chat', 403));
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }, // Older messages first for chat view
    });

    res.status(200).json({
      status: 'success',
      results: messages.length,
      data: { messages }
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { message, imageUrl } = req.body;
    const senderId = req.user.id;

    // Verify conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { shop: true }
    });

    if (!conversation) return next(new AppError('Conversation not found', 404));
    
    // Check participation
    if (conversation.customerId !== senderId && conversation.shop.ownerId !== senderId) {
      return next(new AppError('You are not a participant of this chat', 403));
    }

    const newMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        message,
        imageUrl,
      },
    });

    // Fire the messageSent event over Kafka.
    // Our Socket.IO server (which we will build next) will listen to this
    // and instantly push the message to the recipient's phone without them refreshing.
    const recipientId = senderId === conversation.customerId ? conversation.shop.ownerId : conversation.customerId;

    try {
      await producer.send({
        topic: 'chat-events',
        messages: [
          {
            key: recipientId, // Route by recipient for real-time delivery
            value: JSON.stringify({
              type: 'messageSent',
              data: {
                message: newMessage,
                conversationId,
                recipientId
              }
            })
          }
        ]
      });
    } catch (kafkaError) {
      console.error('Failed to publish messageSent event:', kafkaError);
    }

    res.status(201).json({
      status: 'success',
      data: { message: newMessage }
    });
  } catch (error) {
    next(error);
  }
};
