import { kafka } from '../config/kafka';
import prisma from '../config/db';
import { sendToUser } from './socket';

const consumer = kafka.consumer({ groupId: 'pakalale-notification-group' });

export const startEventSubscriber = async () => {
  try {
    await consumer.connect();
    
    // Subscribe to the necessary topics
    await consumer.subscribe({ topic: 'request-events', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat-events', fromBeginning: false });

    console.log('Kafka Consumer successfully connected and subscribed to events');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        try {
          const payload = JSON.parse(message.value.toString());
          const recipientId = message.key?.toString(); // We keyed messages by recipientId where possible
          
          if (topic === 'chat-events' && payload.type === 'messageSent') {
            const { message: chatMessage, conversationId, recipientId: targetUserId } = payload.data;
            
            // 1. Push directly to Socket.IO if user is online
            if (targetUserId) {
              sendToUser(targetUserId, 'new_message', {
                conversationId,
                message: chatMessage
              });
            }

            // 2. Also create a Notification in postgres so they see it when they open the app later
            // (Only create if it's the first unread message to avoid spamming the database)
            const recentNotif = await prisma.notification.findFirst({
                where: { userId: targetUserId, type: 'NEW_MESSAGE', isRead: false }
            });

            if (!recentNotif && targetUserId) {
                await prisma.notification.create({
                    data: {
                        userId: targetUserId,
                        type: 'NEW_MESSAGE',
                        title: 'New Message Received',
                        message: 'You have new unread messages in your inbox.',
                    }
                });
            }
          }

          if (topic === 'request-events' && payload.type === 'shopResponded') {
            const { requestTitle, shopName, customerId } = payload.data;
            
            // 1. DB Push
            const newNotif = await prisma.notification.create({
              data: {
                userId: customerId,
                type: 'SHOP_RESPONSE',
                title: 'New Shop Offer!',
                message: `${shopName} has responded to your request for "${requestTitle}"!`,
              }
            });

            // 2. Socket Push
            sendToUser(customerId, 'new_notification', newNotif);
          }

          if (topic === 'request-events' && payload.type === 'requestCreated') {
            const requestData = payload.data;
            console.log(`[Event Processed] requestCreated -> finding local shops for ${requestData.title}`);
          }

        } catch (parseError) {
          console.error(`Failed to process Kafka message on topic ${topic}`, parseError);
        }
      },
    });
  } catch (error) {
    console.error('Failed to start Kafka Consumer', error);
  }
};
