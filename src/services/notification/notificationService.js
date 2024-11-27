import { consumeMessage } from '../../messaging/messageQueue.js';

// Mock email sending
const sendEmail = async (to, subject, body) => {
  console.log(`Sending email to ${to}:`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
};

// Handle order status updates
const handleOrderUpdate = async (order) => {
  const emailTemplates = {
    pending: {
      subject: 'Order Received',
      body: `Thank you for your order #${order.id}. We'll process it soon.`
    },
    processing: {
      subject: 'Order Processing',
      body: `Your order #${order.id} is being processed.`
    },
    shipped: {
      subject: 'Order Shipped',
      body: `Your order #${order.id} has been shipped!`
    }
  };

  const template = emailTemplates[order.status];
  if (template) {
    await sendEmail(order.userId, template.subject, template.body);
  }
};

// Handle payment events
const handlePaymentEvent = async (payment) => {
  const subject = payment.status === 'success' 
    ? 'Payment Successful' 
    : 'Payment Failed';
  
  const body = payment.status === 'success'
    ? `Your payment of $${payment.amount} for order #${payment.orderId} was successful.`
    : `Your payment of $${payment.amount} for order #${payment.orderId} failed. Please try again.`;

  await sendEmail(payment.userId, subject, body);
};

// Initialize notification service
export const initNotificationService = async () => {
  // Subscribe to order events
  await consumeMessage('order.created', handleOrderUpdate);
  await consumeMessage('order.updated', handleOrderUpdate);

  // Subscribe to payment events
  await consumeMessage('payment.succeeded', handlePaymentEvent);
  await consumeMessage('payment.failed', handlePaymentEvent);
};