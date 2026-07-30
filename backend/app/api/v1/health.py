from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health check endpoint")
def health_check():
    """
    Basic health check endpoint confirming that the API service is active.
    """
    return {"status": "healthy"}
