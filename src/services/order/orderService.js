import express from 'express';
import { body, validationResult } from 'express-validator';
import { Order } from '../../models/order.js';
import { Product } from '../../models/productSQL.js';
import { publishMessage } from '../../messaging/messageQueue.js';

const router = express.Router();

const validateOrder = [
  body('user').notEmpty(),
  body('items').isArray(),
  body('items.*.product').notEmpty(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('shippingAddress').notEmpty()
];

router.post('/', validateOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Calculate total amount and verify inventory
    let totalAmount = 0;
    for (const item of req.body.items) {
      const product = await Product.findByPk(item.product);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.product} not found` });
      }
      if (product.inventory < item.quantity) {
        return res.status(400).json({ message: `Insufficient inventory for product ${product.name}` });
      }
      totalAmount += product.price * item.quantity;
    }

    const order = new Order({
      ...req.body,
      totalAmount
    });

    await order.save();

    // Update inventory
    for (const item of req.body.items) {
      await Product.decrement('inventory', {
        by: item.quantity,
        where: { id: item.product }
      });
    }

    await publishMessage('order.created', order);
    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', '-password')
      .populate('items.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = req.body.status;
    await order.save();

    await publishMessage('order.updated', order);
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;