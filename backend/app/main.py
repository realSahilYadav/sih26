from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import abha, appointments, auth, dashboard, facilities, health, health_worker, medicines, referrals, triage, voice


def create_app() -> FastAPI:
    app = FastAPI(
        title="Rural Healthcare Platform",
        description="Backend API for the Rural Healthcare Platform",
        version="0.1.0",
    )

    # CORS — allow all three frontend dev servers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # frontend/user
            "http://localhost:5174",  # frontend/doctor
            "http://localhost:5175",  # frontend/admin
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(facilities.router)
    app.include_router(appointments.router)
    app.include_router(triage.router)
    app.include_router(referrals.router)
    app.include_router(medicines.router)
    app.include_router(abha.router)
    app.include_router(voice.router)
    app.include_router(dashboard.router)
    app.include_router(health_worker.router)

    return app


app = create_app()
