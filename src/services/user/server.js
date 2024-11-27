import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../../config/database.js';
import userRoutes from './userService.js';

dotenv.config();

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/', userRoutes);

const init = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`User service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize user service:', error);
    process.exit(1);
  }
};

init();