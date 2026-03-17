# Pakalale Backend API

The high-performance, event-driven backend for the Pakalale demand-supply marketplace in Zambia.

Pakalale inverts traditional e-commerce by allowing customers to broadcast their demands (e.g. "I need an iPhone 13") which instantly notifies local shops, who can then dynamically compete to fulfill the request with their existing inventory via real-time chat.

## Tech Stack
* **Language:** TypeScript
* **Runtime:** Node.js + Express
* **Database:** PostgreSQL (via Prisma ORM)
* **Real-time Engine:** Socket.IO
* **Event Bus:** Apache Kafka
* **Cache Layer:** Redis (used for sub-millisecond global feed serving)

---

## 🚀 Getting Started

Follow these steps to run the backend API locally.

### 1. Prerequisites
Make sure you have installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/) (Required to run the database, redis, and kafka containers)

### 2. Installation
Clone the repository and install the Node dependencies:

```bash
git clone <your-repo-url>
cd pakalale-backend
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory. You can copy the contents below:

```env
# Database Credentials matching the Docker Compose configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/pakalale?schema=public"

# Security
JWT_SECRET="super_secret_dev_jwt_string_12345"
JWT_EXPIRES_IN="90d"

# Infrastructure
KAFKA_BROKER="localhost:9092"
REDIS_URL="redis://localhost:6379"

# API Port
PORT=5000
```

### 4. Boot Up Infrastructure (Databases & Event Bus)
The project includes a `docker-compose.yml` file which automatically spins up exactly configured instances of PostgreSQL, Redis, Kafka, and Zookeeper.

```bash
docker compose up -d
```
*(Wait a few seconds for all containers to fully initialize before progressing).*

### 5. Setup Database Schema
Once the Postgres container is running, use Prisma to explicitly push the schema and generate the typescript client types:

```bash
npx prisma db push
npx prisma generate
```

### 6. Run the Developer Server
Start the Express API:

```bash
npm run dev
```

The API should now be running cleanly at `http://localhost:5000`.

---

## 🛠️ Architecture Overview

The backend is composed of several modular services communicating concurrently:

* **AuthService (`/api/v1/auth`)**: JWT-based authentication and role-based access control (`CUSTOMER`, `SHOP_OWNER`, `ADMIN`).
* **ShopService (`/api/v1/shops`)**: Core logic for shop verification, inventory additions, and location management.
* **RequestService (`/api/v1/requests`)**: The demand engine. Customers post requests, which are persisted to Postgres and simultaneously fire `requestCreated` events onto Kafka.
* **ResponseService (`/api/v1/requests/:requestId/responses`)**: Allows shop owners to instantly map their inventory to active requests. Submitting a template automatically initializes a direct message thread with the customer via Socket.IO.
* **FeedService (`/api/v1/feed`)**: A universally scrolling timeline of active requests and shop promotions. Aggressively cached in Redis to protect the database layer from heavy read-traffic.
* **ChatService & NotificationService (`/api/v1/conversations`)**: Private DMs powered by persistent Postgres storage and active WebSocket tunneling for real-time negotiations.

## Testing Endpoints
The backend utilizes strict, validated endpoints. 
A sample request to create a new user:
```bash
curl -X POST http://localhost:5000/api/v1/auth/signup \
-H "Content-Type: application/json" \
-d '{"name": "Developer Test", "email": "dev@example.com", "password": "password123", "role": "CUSTOMER"}'
```
