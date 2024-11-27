import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../../config/database.js';
import { initMessageQueue } from '../../messaging/messageQueue.js';
import paymentRoutes from './paymentService.js';

dotenv.config();

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3004;

app.use(cors());
app.use(express.json());

app.use('/', paymentRoutes);

const init = async () => {
  try {
    await connectDB();
    await initMessageQueue();
    
    app.listen(PORT, () => {
      console.log(`Payment service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize payment service:', error);
    process.exit(1);
  }
};

init();