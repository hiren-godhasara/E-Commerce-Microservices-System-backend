import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectPostgres } from '../../config/postgresql.js';
import productRoutes from './productService.js';

dotenv.config();

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || 3002;

app.use(cors());
app.use(express.json());

app.use('/', productRoutes);

const init = async () => {
  try {
    await connectPostgres();
    
    app.listen(PORT, () => {
      console.log(`Product service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize product service:', error);
    process.exit(1);
  }
};

init();