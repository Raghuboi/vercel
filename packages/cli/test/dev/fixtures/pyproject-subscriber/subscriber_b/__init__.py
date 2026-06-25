from celery import Celery


QUEUE_NAME = "low-priority"
app = Celery("pyproject-subscriber-low-priority")
app.conf.task_default_queue = QUEUE_NAME

# Use the canonical package name so loading this entrypoint as
# "subscriber_b.__init__" would create a second package/app without this task.
from subscriber_b.tasks import process_job  # noqa: E402


__all__ = ["QUEUE_NAME", "app", "process_job"]
