import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../../config/database.js';
import { initMessageQueue } from '../../messaging/messageQueue.js';
import { initNotificationService } from './notificationService.js';

dotenv.config();

const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3005;

app.use(cors());
app.use(express.json());

const init = async () => {
  try {
    await connectDB();
    await initMessageQueue();
    await initNotificationService();
    
    app.listen(PORT, () => {
      console.log(`Notification service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize notification service:', error);
    process.exit(1);
  }
};

init();