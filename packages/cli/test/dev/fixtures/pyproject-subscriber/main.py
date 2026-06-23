from fastapi import FastAPI

from worker_a import (  # pyright: ignore[reportImplicitRelativeImport]
    QUEUE_NAME as HIGH_PRIORITY_QUEUE,
    process_job as process_high_priority_job,
)
from worker_b import (  # pyright: ignore[reportImplicitRelativeImport]
    QUEUE_NAME as LOW_PRIORITY_QUEUE,
    process_job as process_low_priority_job,
)


app = FastAPI()


@app.post("/enqueue")
def enqueue():
    high_request_id = "dev-celery-high"
    low_request_id = "dev-celery-low"
    high_result = process_high_priority_job.apply_async(
        args=(high_request_id, 19, 23),
        queue=HIGH_PRIORITY_QUEUE,
    )
    low_result = process_low_priority_job.apply_async(
        args=(low_request_id, 20, 22),
        queue=LOW_PRIORITY_QUEUE,
    )
    return {
        "requestIds": [high_request_id, low_request_id],
        "taskIds": [high_result.id, low_result.id],
    }
