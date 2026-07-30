import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.health import router as health_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.database.connection import verify_db_connection

logger = logging.getLogger(__name__)

# Setup structured logging configuration
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify database connection on application startup
    logger.info("Initializing application startup sequence...")
    verify_db_connection()
    yield
    logger.info("Shutting down application...")


# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Apply CORS Middleware configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Root level health endpoint
@app.get("/health", tags=["Health"])
def root_health():
    """
    Root level health check endpoint.
    """
    return {"status": "healthy"}


# Mount API routes
app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])
