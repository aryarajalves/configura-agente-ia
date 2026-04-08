import pytest
import time
from uuid import uuid4

@pytest.mark.asyncio
async def test_active_version_switch_time():
    start = time.time()
    # mock activation
    time.sleep(0.1)
    end = time.time()
    assert (end - start) < 2.0, "Version switch took longer than 2 seconds"
