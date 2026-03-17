import { Kafka } from 'kafkajs';

const clientId = 'pakalale-backend';
const brokers = [process.env.KAFKA_BROKER || 'localhost:9092'];

// Initialize the Kafka client
// Handled internally by kafkajs, connects automatically when we create producers/consumers
export const kafka = new Kafka({
  clientId,
  brokers,
});

export const producer = kafka.producer();
// Consumer will be instantiated dynamically by the eventSubscriber when needed

// Connect the main producer on startup to avoid delay on first event published
(async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer successfully connected');
  } catch (err) {
    console.error('Failed to connect Kafka Producer', err);
  }
})();
