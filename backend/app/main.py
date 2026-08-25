import logging
from contextlib import asynccontextmanager

from app.api.v1.api import api_router
from app.config.logging import setup_logging
from app.config.settings import settings
from app.database import verify_db_connection
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
app.include_router(api_router, prefix=settings.API_V1_STR)
