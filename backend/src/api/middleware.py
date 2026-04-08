from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from backend.src.models.schemas import SuccessResponse
import logging

logger = logging.getLogger(__name__)

async def error_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled error: {e}", exc_info=True)
        status_code = 500
        message = "Internal Server Error"
        
        if isinstance(e, HTTPException):
            status_code = e.status_code
            message = e.detail
        
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "data": None,
                "message": str(message)
            }
        )
