import logging
from typing import Set

logger = logging.getLogger("task_monitor")

class TaskMonitor:
    _instance = None
    _active_tasks: Set[str] = set()
    _cancelled_tasks: Set[str] = set()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskMonitor, cls).__new__(cls)
        return cls._instance

    def start_task(self, task_id: str):
        self._active_tasks.add(task_id)
        if task_id in self._cancelled_tasks:
            self._cancelled_tasks.remove(task_id)
        logger.info(f"T\u00e2che d\u00e9marr\u00e9e : {task_id}")

    def stop_task(self, task_id: str):
        if task_id in self._active_tasks:
            self._active_tasks.remove(task_id)
        logger.info(f"T\u00e2che termin\u00e9e : {task_id}")

    def cancel_task(self, task_id: str):
        if task_id in self._active_tasks:
            self._cancelled_tasks.add(task_id)
            logger.warning(f"Demande d'annulation re\u00e7ue pour : {task_id}")

    def is_cancelled(self, task_id: str) -> bool:
        return task_id in self._cancelled_tasks

task_monitor = TaskMonitor()
