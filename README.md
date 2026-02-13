# Pathfinder

Web app for Italian university students — aggregates universities, internships, stages, and extracurricular opportunities with personalized matching.

## Quick Start

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Run database migration
cd backend && npx prisma migrate dev --name init && cd ..

# 4. Seed the database
cd backend && npx prisma db seed && cd ..

# 5. Start both frontend and backend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## Demo Users

All demo users have password: `password123`

| Name | Email | University | Profile |
|------|-------|-----------|---------|
| Marco Rossi | marco@example.com | PoliMi | Analista/Tech |
| Giulia Bianchi | giulia@example.com | Bologna | Leader/Business |
| Luca Verdi | luca@example.com | Sapienza | Analista/Tech |
| Sara Ferrari | sara@example.com | Firenze | Creativo/Creative |
| Alessandro Conti | alessandro@example.com | Ca' Foscari | Imprenditore/Business |

## Stack

- **Frontend**: Next.js 14, Tailwind CSS, TypeScript, Socket.IO Client
- **Backend**: Express, Prisma, PostgreSQL, Socket.IO, JWT
- **Database**: PostgreSQL 16 (via Docker)
