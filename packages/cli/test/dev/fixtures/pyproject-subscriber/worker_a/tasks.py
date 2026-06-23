# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false, reportUntypedFunctionDecorator=false

import json
import os

from . import QUEUE_NAME, app


RESULT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".results")


@app.task(name="worker_a.process_job")
def process_job(request_id: str, x: int, y: int) -> dict[str, str | int]:
    os.makedirs(RESULT_DIR, exist_ok=True)
    result = {"requestId": request_id, "priority": QUEUE_NAME, "sum": x + y}
    with open(os.path.join(RESULT_DIR, f"{QUEUE_NAME}.json"), "w") as f:
        json.dump(result, f)
    return result
