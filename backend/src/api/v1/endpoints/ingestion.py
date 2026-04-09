from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from src.services.ingestion_service import IngestionService
from pydantic import BaseModel
import shutil
import tempfile
import os

router = APIRouter()

class UploadTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str

@router.post("/upload", response_model=UploadTaskResponse, status_code=202)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Check size constraints roughly later but save first
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1] if file.filename else "")
        with os.fdopen(fd, 'wb') as f:
            shutil.copyfileobj(file.file, f)
            
        task_id = await IngestionService.create_task(db, file.filename or "unknown", temp_path)
        
        return UploadTaskResponse(
            task_id=task_id,
            status="initiated",
            message="Upload task started. Follow progress via WebSocket."
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
