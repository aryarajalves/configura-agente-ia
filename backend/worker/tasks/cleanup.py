from datetime import datetime, timedelta
# In a real implementation: from backend.src.models.process import Process, Base

async def cleanup_old_processes():
    """
    Deletes processes older than 30 days or marked as deleted.
    """
    threshold = datetime.utcnow() - timedelta(days=30)
    print(f"Cleaning up processes older than {threshold}")
    # In a real implementation:
    # session.query(Process).filter(
    #     (Process.created_at < threshold) | (Process.deleted_at.isnot(None))
    # ).delete()
    return True

if __name__ == "__main__":
    import asyncio
    asyncio.run(cleanup_old_processes())
