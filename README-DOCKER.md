# 🐳 MediFlow AI - Quick Start with Docker

Run the entire MediFlow AI pharmacy system in 3 steps!

## Prerequisites

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Get API keys:
   - [Clerk](https://clerk.com) - Authentication
   - [Stripe](https://stripe.com) - Payments
   - [Anthropic](https://console.anthropic.com/) - AI

## Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-repo/mediflow-ai.git
cd mediflow-ai
```

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory:
```bash
# Required Keys
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx

STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

ANTHROPIC_API_KEY=sk-ant-xxxxx

ADMIN_SECRET=your_password
```

### Step 3: Start the System
```bash
docker-compose up -d
```

**That's it!** 🎉

## Access the System

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Database:** localhost:5432

## Commands
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Restart a service
docker-compose restart backend

# Reset everything (including database)
docker-compose down -v
docker-compose up -d
```

## Troubleshooting

**Port already in use?**
```bash
# Change ports in docker-compose.yml
ports:
  - "5174:5173"  # Frontend
  - "3002:3001"  # Backend
```

**Database not initializing?**
```bash
docker-compose down -v
docker-compose up -d
```

## Test Payment

Use Stripe test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC

## Default Admin Password

Username: (not required)
Password: `your_password` (from ADMIN_SECRET in .env)