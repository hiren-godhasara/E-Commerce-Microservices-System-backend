import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const GATEWAY_PORT = process.env.GATEWAY_PORT || 3000;

app.use(cors());
app.use(express.json());

// Proxy middleware configuration
const createProxy = (target) => createProxyMiddleware({
  target,
  changeOrigin: true,
  pathRewrite: { '^/api': '' }
});

// Route services through the gateway
app.use('/api/users', createProxy(`http://localhost:${process.env.USER_SERVICE_PORT}`));
app.use('/api/products', createProxy(`http://localhost:${process.env.PRODUCT_SERVICE_PORT}`));
app.use('/api/orders', createProxy(`http://localhost:${process.env.ORDER_SERVICE_PORT}`));
app.use('/api/payments', createProxy(`http://localhost:${process.env.PAYMENT_SERVICE_PORT}`));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(GATEWAY_PORT, () => {
  console.log(`API Gateway running on port ${GATEWAY_PORT}`);
});