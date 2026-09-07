# Rural Healthcare Platform

A monorepo for a rural healthcare platform with a FastAPI backend and three React (Vite) frontends for patients, doctors, and facility administrators.

## Architecture

```
sih26/
├── backend/              FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── api/          Route handlers
│   │   ├── core/         Config, database session
│   │   ├── models/       SQLAlchemy ORM models
│   │   ├── schemas/      Pydantic request/response schemas
│   │   └── services/     Business logic
│   └── alembic/          Database migrations
├── frontend/
│   ├── user/             Patient portal       → localhost:5173
│   ├── doctor/           Doctor portal        → localhost:5174
│   └── admin/            Admin portal         → localhost:5175
```

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **PostgreSQL** (running locally or via Docker)

## Getting Started

### 1. Clone & setup environment files

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Frontends
cp frontend/user/.env.example frontend/user/.env
cp frontend/doctor/.env.example frontend/doctor/.env
cp frontend/admin/.env.example frontend/admin/.env
```

### 2. Start the backend

```bash
cd backend

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Test the health check:

```bash
curl http://localhost:8000/api/health
```

### 3. Start the frontends

Each frontend runs in its own terminal:

```bash
# Terminal 1 — Patient portal (port 5173)
cd frontend/user
npm install
npm run dev

# Terminal 2 — Doctor portal (port 5174)
cd frontend/doctor
npm install
npm run dev

# Terminal 3 — Admin portal (port 5175)
cd frontend/admin
npm install
npm run dev
```

### 4. Database migrations (when you have models)

```bash
cd backend
source venv/bin/activate

# Generate a migration
alembic revision --autogenerate -m "describe your change"

# Apply migrations
alembic upgrade head
```

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
