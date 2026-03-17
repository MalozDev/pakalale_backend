import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { producer } from '../config/kafka';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/authMiddleware';

export const respondToRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.requestId as string;
    let { shopId, productId, price, message, imageUrl } = req.body;
    const userId = req.user.id;

    // 1. Verify that the shop exists and belongs to the authenticated user
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return next(new AppError('Shop not found', 404));
    
    // In production, SHOP_OWNERs can only respond on behalf of their own shop
    if (shop.ownerId !== userId && req.user.role !== 'ADMIN') {
      return next(new AppError('You do not have permission to respond as this shop', 403));
    }

    // 2. Verify the request exists and is STILL OPEN
    const customerRequest = await prisma.request.findUnique({ where: { id: requestId } });
    if (!customerRequest) return next(new AppError('Request not found', 404));
    if (customerRequest.status === 'CLOSED') {
      return next(new AppError('This request has already been closed by the customer.', 400));
    }

    // 2.5 Quick Response Template feature check
    if (productId) {
      // Find the specific Product from their Inventory
      const product = await prisma.product.findFirst({
        where: { id: productId, shopId: shopId },
        include: { images: true }
      });

      if (!product) {
        return next(new AppError('Product not found in your inventory', 404));
      }

      // Automatically map product details to the response!
      price = product.price;
      message = `Quick Response: We have ${product.name} in stock! ${product.description || ''}`;
      if (product.images && product.images.length > 0) {
        imageUrl = product.images[0].imageUrl;
      }
    }

    // 3. Create the response
    const newResponse = await prisma.requestResponse.create({
      data: {
        requestId,
        shopId,
        price: parseFloat(price),
        message,
        imageUrl,
      },
    });

    // 4. Optionally, we can also inject this into the public Feed...
    await prisma.post.create({
      data: {
        authorId: userId,
        shopId: shopId,
        postType: 'SHOP_POST',
        content: `We just responded to a request for ${customerRequest.title} with an offer of K${price}! ${message || ''}`,
        imageUrl,
      }
    });

    // 5. Fire the 'shopResponded' event so the NotificationService can instantly push an alert to the Customer's phone!
    try {
      await producer.send({
        topic: 'request-events',
        messages: [
          {
            key: customerRequest.customerId, // Route by customer ID for easy fan-out
            value: JSON.stringify({
              type: 'shopResponded',
              data: {
                response: newResponse,
                requestTitle: customerRequest.title,
                customerId: customerRequest.customerId,
                shopName: shop.name
              }
            })
          }
        ]
      });
    } catch (kafkaError) {
      console.error('Failed to publish shopResponded event:', kafkaError);
    }

    // 6. AUTO-CHAT INTEGRATION (Quickly establish communication)
    // Create or find a specific chat thread linking this customer and shop
    let conversation = await prisma.conversation.findFirst({
      where: {
        customerId: customerRequest.customerId,
        shopId: shopId
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerId: customerRequest.customerId,
          shopId: shopId
        }
      });
    }

    // Drop a fully-formed message introducing the shop's offer on behalf of the owner
    const chatMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        message: `I'm responding to your request for "${customerRequest.title}". My offer is K${price}. ${message || ''}`,
        imageUrl: imageUrl
      }
    });

    // Shoot this chat message over Kafka so Socket.IO pings the customer real-time
    try {
      await producer.send({
        topic: 'chat-events',
        messages: [{
          key: customerRequest.customerId,
          value: JSON.stringify({
            type: 'messageSent',
            data: {
              message: chatMessage,
              conversationId: conversation.id,
              recipientId: customerRequest.customerId
            }
          })
        }]
      });
    } catch (kafkaError) {
      console.error('Failed to publish auto-chat event:', kafkaError);
    }

    res.status(201).json({
      status: 'success',
      data: { response: newResponse, autoMessage: chatMessage }
    });
  } catch (error) {
    next(error);
  }
};

export const closeRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requestId = req.params.requestId as string;
    const userId = req.user.id;

    // Verify ownership of the request
    const customerRequest = await prisma.request.findUnique({ where: { id: requestId } });
    if (!customerRequest) return next(new AppError('Request not found', 404));
    if (customerRequest.customerId !== userId && req.user.role !== 'ADMIN') {
      return next(new AppError('Only the original requester can close this request', 403));
    }

    const closedRequest = await prisma.request.update({
      where: { id: requestId },
      data: { status: 'CLOSED' }
    });

    res.status(200).json({
      status: 'success',
      data: { request: closedRequest }
    });
  } catch (error) {
    next(error);
  }
};
