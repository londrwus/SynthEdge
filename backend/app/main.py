"""SynthEdge Backend — FastAPI application."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.services.synth_service import synth_polling_loop
from app.routers import synth, analytics, portfolio, insights, trading, earnings

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("synthedge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Synth polling loop...")
    task = asyncio.create_task(synth_polling_loop())
    yield
    task.cancel()
    logger.info("Synth polling stopped.")


app = FastAPI(
    title="SynthEdge API",
    description="Predictive Intelligence Meets On-Chain Execution",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins in dev mode
cors_origins = settings.CORS_ORIGINS.split(",")
if "*" in cors_origins:
    cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True if "*" not in cors_origins else False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# GZip compression — reduces /percentiles/all from ~468KB to ~50KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(synth.router)
app.include_router(analytics.router)
app.include_router(portfolio.router)
app.include_router(insights.router)
app.include_router(trading.router)
app.include_router(earnings.router)


@app.get("/api/health")
async def health():
    from app.services.synth_service import get_redis, get_poll_status
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    poll = await get_poll_status()

    return {
        "status": "ok",
        "services": {
            "redis": "connected" if redis_ok else "disconnected",
            "synth_api_key_set": bool(settings.SYNTH_API_KEY),
        },
        "polling": poll,
    }


@app.post("/api/refresh")
async def force_refresh():
    """Force-refresh all assets from Synth API. Costs 18 credits."""
    from app.services.synth_service import force_refresh_all
    result = await force_refresh_all()
    return {"data": result}
