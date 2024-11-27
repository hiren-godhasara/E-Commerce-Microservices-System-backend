import amqp from 'amqplib';

let connection;
let channel;

const EXCHANGE_TYPES = {
  ORDER: 'order_events',
  PAYMENT: 'payment_events',
  NOTIFICATION: 'notification_events'
};

// Initialize message queue connection
export const initMessageQueue = async () => {
  try {
    connection = await amqp.connect('amqp://localhost');
    channel = await connection.createChannel();
    
    // Declare exchanges
    await channel.assertExchange(EXCHANGE_TYPES.ORDER, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGE_TYPES.PAYMENT, 'topic', { durable: true });
    await channel.assertExchange(EXCHANGE_TYPES.NOTIFICATION, 'topic', { durable: true });

    // Declare queues with dead letter exchange
    const queues = {
      'order.created': EXCHANGE_TYPES.ORDER,
      'order.updated': EXCHANGE_TYPES.ORDER,
      'payment.succeeded': EXCHANGE_TYPES.PAYMENT,
      'payment.failed': EXCHANGE_TYPES.PAYMENT,
      'notification.email': EXCHANGE_TYPES.NOTIFICATION,
      'notification.sms': EXCHANGE_TYPES.NOTIFICATION
    };

    for (const [queueName, exchange] of Object.entries(queues)) {
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': `${exchange}.dlx`,
          'x-dead-letter-routing-key': `${queueName}.dead`
        }
      });

      // Bind queue to exchange
      await channel.bindQueue(queueName, exchange, queueName);

      // Create and bind dead letter queue
      await channel.assertExchange(`${exchange}.dlx`, 'direct', { durable: true });
      await channel.assertQueue(`${queueName}.dead`, { durable: true });
      await channel.bindQueue(
        `${queueName}.dead`,
        `${exchange}.dlx`,
        `${queueName}.dead`
      );
    }

    // Handle connection errors
    connection.on('error', (error) => {
      console.error('RabbitMQ connection error:', error);
      setTimeout(initMessageQueue, 5000);
    });

    connection.on('close', () => {
      console.error('RabbitMQ connection closed. Retrying...');
      setTimeout(initMessageQueue, 5000);
    });

    console.log('Message queue initialized successfully');
  } catch (error) {
    console.error('Failed to initialize message queue:', error);
    setTimeout(initMessageQueue, 5000);
  }
};

// Publish message to exchange
export const publishMessage = async (routingKey, message, options = {}) => {
  try {
    if (!channel) {
      throw new Error('Channel not initialized');
    }

    let exchange;
    if (routingKey.startsWith('order.')) {
      exchange = EXCHANGE_TYPES.ORDER;
    } else if (routingKey.startsWith('payment.')) {
      exchange = EXCHANGE_TYPES.PAYMENT;
    } else if (routingKey.startsWith('notification.')) {
      exchange = EXCHANGE_TYPES.NOTIFICATION;
    } else {
      throw new Error(`Invalid routing key: ${routingKey}`);
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const publishOptions = {
      persistent: true,
      ...options
    };

    await channel.publish(exchange, routingKey, messageBuffer, publishOptions);
    console.log(`Published message to ${exchange}:${routingKey}`);
  } catch (error) {
    console.error(`Failed to publish message to ${routingKey}:`, error);
    throw error;
  }
};

// Consume messages from queue
export const consumeMessage = async (queueName, callback) => {
  try {
    if (!channel) {
      throw new Error('Channel not initialized');
    }

    await channel.consume(queueName, async (message) => {
      if (!message) return;

      try {
        const content = JSON.parse(message.content.toString());
        await callback(content);
        channel.ack(message);
      } catch (error) {
        console.error(`Error processing message from ${queueName}:`, error);
        
        // Reject message and send to dead letter queue if max retries reached
        const retryCount = (message.properties.headers['x-retry-count'] || 0) + 1;
        if (retryCount > 3) {
          channel.reject(message, false);
        } else {
          // Retry with exponential backoff
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            channel.publish(
              message.fields.exchange,
              message.fields.routingKey,
              message.content,
              {
                headers: { 'x-retry-count': retryCount }
              }
            );
            channel.ack(message);
          }, delay);
        }
      }
    }, { noAck: false });

    console.log(`Subscribed to queue: ${queueName}`);
  } catch (error) {
    console.error(`Failed to consume messages from ${queueName}:`, error);
    throw error;
  }
};

// Graceful shutdown
export const closeMessageQueue = async () => {
  try {
    await channel?.close();
    await connection?.close();
  } catch (error) {
    console.error('Error closing message queue:', error);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await closeMessageQueue();
  process.exit(0);
});