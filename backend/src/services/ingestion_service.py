from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from src.models.ingestion import IngestionTask, IngestionStatus
from src.utils.hashing import calculate_sha256
from src.tkq.tasks import task_upload_to_s3

class IngestionService:
    @staticmethod
    async def create_task(db: AsyncSession, filename: str, file_path: str) -> str:
        # Calculate hash first
        import asyncio
        loop = asyncio.get_running_loop()
        file_hash = await loop.run_in_executor(None, calculate_sha256, file_path)

        # Check for duplicates using hash
        stmt = select(IngestionTask).where(
            IngestionTask.file_hash == file_hash,
            IngestionTask.status != IngestionStatus.FAILED
        )
        result = await db.execute(stmt)
        existing_task = result.scalars().first()

        if existing_task:
            raise ValueError(f"File with hash {file_hash} is already active or completed.")

        # Create task
        task = IngestionTask(
            filename=filename,
            file_hash=file_hash,
            status=IngestionStatus.INITIATED
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)

        # Kickoff async upload 
        await task_upload_to_s3.kiq(task.id, file_path, filename)

        return task.id
