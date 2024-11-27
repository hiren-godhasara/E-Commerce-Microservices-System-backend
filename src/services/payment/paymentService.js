import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import { Payment } from '../../models/payment.js';
import { Order } from '../../models/order.js';
import { publishMessage } from '../../messaging/messageQueue.js';

const router = express.Router();

// Razorpay instance configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const processPayment = async (paymentDetails) => {
  const { amount, orderId, paymentMethod } = paymentDetails;

  try {
    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Amount in paise (multiply by 100 to convert to INR paise)
      currency: 'INR',
      receipt: `order_rcptid_${orderId}`,
      payment_capture: 1 // Auto-capture the payment
    });

    // Return the Razorpay order ID and success flag
    return {
      success: true,
      orderId: razorpayOrder.id
    };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return {
      success: false
    };
  }
};

router.post('/', [
  body('orderId').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('paymentMethod').isIn(['credit_card', 'debit_card', 'paypal', 'razorpay'])
], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, amount, paymentMethod } = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.totalAmount !== amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Payment amount does not match order total' });
    }

    const payment = new Payment({
      order: orderId,
      amount,
      paymentMethod,
      status: 'pending'
    });

    const { success, orderId: razorpayOrderId } = await processPayment(req.body);

    if (success) {
      payment.status = 'success';
      payment.transactionId = razorpayOrderId;
      await payment.save({ session });

      order.paymentStatus = 'paid';
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

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
      payment.status = 'failed';
      await payment.save({ session });

      order.paymentStatus = 'failed';
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

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
    await session.abortTransaction();
    session.endSession();

    console.error('Payment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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
