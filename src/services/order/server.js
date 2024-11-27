import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../../config/database.js';
import { initMessageQueue } from '../../messaging/messageQueue.js';
import orderRoutes from './orderService.js';

dotenv.config();

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3003;

app.use(cors());
app.use(express.json());

app.use('/', orderRoutes);

const init = async () => {
  try {
    await connectDB();
    await initMessageQueue();
    
    app.listen(PORT, () => {
      console.log(`Order service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize order service:', error);
    process.exit(1);
  }
};

init();