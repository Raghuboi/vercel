from celery import Celery


QUEUE_NAME = "high-priority"
app = Celery("pyproject-subscriber-high-priority")
app.conf.task_default_queue = QUEUE_NAME

# Use the canonical package name so loading this entrypoint as
# "subscriber_a.__init__" would create a second package/app without this task.
from subscriber_a.tasks import process_job  # noqa: E402


__all__ = ["QUEUE_NAME", "app", "process_job"]
