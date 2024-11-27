import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Payment } from '../../models/payment.js';
import { Order } from '../../models/order.js';
import { publishMessage } from '../../messaging/messageQueue.js';

const router = express.Router();

const processPayment = async (paymentDetails) => {
  // Simulate payment gateway processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  return Math.random() < 0.8;
};

router.post('/', [
  body('orderId').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('paymentMethod').isIn(['credit_card', 'debit_card', 'paypal'])
], async (req, res) => {
  // Start a new session for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, amount, paymentMethod } = req.body;

    // Find order within the transaction
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify payment amount matches order total
    if (order.totalAmount !== amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: 'Payment amount does not match order total'
      });
    }

    // Create payment record
    const payment = new Payment({
      order: orderId,
      amount,
      paymentMethod,
      status: 'pending'
    });

    // Process payment through payment gateway
    const success = await processPayment(req.body);

    if (success) {
      // Update payment record
      payment.status = 'success';
      payment.transactionId = Date.now().toString();
      await payment.save({ session });

      // Update order payment status
      order.paymentStatus = 'paid';
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Publish success event
      await publishMessage('payment.succeeded', {
        paymentId: payment._id,
        orderId: order._id,
        amount: payment.amount,
        status: 'success',
        userId: order.user
      });

      res.json({
        status: 'success',
        message: 'Payment processed successfully',
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status,
          transactionId: payment.transactionId
        }
      });
    } else {
      // Update payment record with failed status
      payment.status = 'failed';
      await payment.save({ session });

      // Update order payment status
      order.paymentStatus = 'failed';
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Publish failure event
      await publishMessage('payment.failed', {
        paymentId: payment._id,
        orderId: order._id,
        amount: payment.amount,
        status: 'failed',
        userId: order.user
      });

      res.status(400).json({
        status: 'failed',
        message: 'Payment processing failed',
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status
        }
      });
    }
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Payment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get payment status
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('order', 'totalAmount status');
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({
      id: payment._id,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      order: payment.order,
      createdAt: payment.createdAt
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;