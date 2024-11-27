# E-Commerce Microservices System

A modern e-commerce platform built with Node.js microservices architecture, featuring user management, product catalog, order processing, payment handling, and notifications.

## System Architecture

The system consists of the following microservices:

- **API Gateway** (Port 3000): Routes requests to appropriate services
- **User Service** (Port 3001): Handles user authentication and management
- **Product Service** (Port 3002): Manages product catalog and inventory
- **Order Service** (Port 3003): Processes customer orders
- **Payment Service** (Port 3004): Handles payment processing
- **Notification Service** (Port 3005): Sends notifications for various events

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- PostgreSQL (v12 or higher)
- RabbitMQ (v3.8 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd e-commerce-microservices
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values according to your environment

4. Set up databases:
   - Start MongoDB
   - Start PostgreSQL
   - Create databases mentioned in the `.env` file

5. Start RabbitMQ:
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```

## Running the Services

You can start all services concurrently using:

```bash
npm run dev
```

Or start services individually:

```bash
# API Gateway
npm run dev:gateway

# User Service
npm run dev:users

# Product Service
npm run dev:products

# Order Service
npm run dev:orders

# Payment Service
npm run dev:payments

# Notification Service
npm run dev:notifications
```

## API Documentation

### User Service
- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - User login
- `GET /api/users/:id` - Get user details

### Product Service
- `GET /api/products` - List products (with filtering)
- `POST /api/products` - Add new product
- `PATCH /api/products/:id` - Update product

### Order Service
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id` - Update order status

### Payment Service
- `POST /api/payments` - Process payment
- `GET /api/payments/:id` - Get payment status

## Database Schema

### MongoDB Collections

#### Users
```javascript
{
  email: String,
  password: String (hashed),
  firstName: String,
  lastName: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Orders
```javascript
{
  user: ObjectId,
  items: [{
    product: ObjectId,
    quantity: Number,
    price: Number
  }],
  status: String,
  totalAmount: Number,
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  paymentStatus: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Payments
```javascript
{
  order: ObjectId,
  amount: Number,
  paymentMethod: String,
  status: String,
  transactionId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### PostgreSQL Tables

#### Products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR NOT NULL,
  inventory INTEGER NOT NULL,
  images TEXT[],
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Message Queue Events

### Order Events
- `order.created` - New order created
- `order.updated` - Order status updated

### Payment Events
- `payment.succeeded` - Payment processed successfully
- `payment.failed` - Payment processing failed

### Notification Events
- `notification.email` - Email notification
- `notification.sms` - SMS notification

## Error Handling

- All services implement proper error handling and logging
- Failed operations are rolled back using transactions where applicable
- Message queue implements retry mechanism with dead letter queues

## Security

- JWT-based authentication
- Password hashing using bcrypt
- CORS enabled
- Input validation using express-validator
- Environment variables for sensitive data

## Monitoring and Logging

- Each service logs important events and errors
- Database connection status monitoring
- Message queue connection monitoring

## Development

1. Follow standard Git workflow
2. Run tests before submitting changes
3. Update documentation when adding new features
4. Follow the established code style and patterns

## Production Deployment

1. Set up production databases
2. Configure environment variables
3. Set up monitoring and logging
4. Deploy services using containerization (Docker)
5. Set up load balancing and scaling