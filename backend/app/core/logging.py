import logging
import logging.handlers
import os
import sys


def setup_logging():
    # Déterminer le chemin absolu du dossier backend
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.dirname(os.path.dirname(current_dir))
    log_dir = os.path.join(backend_root, "logs")

    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, "app.log")

    # Rotation: 5MB par fichier, garder 5 backups
    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s (%(module)s): %(message)s"
    )
    file_handler.setFormatter(formatter)

    # Root Logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Forcer l'ajout du handler de fichier même si d'autres existent (ex: uvicorn)
    root_logger.addHandler(file_handler)
    
    if not any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        # Console handler pour stdout si absent
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    logging.info("Journalisation avec rotation configurée dans 'logs/app.log'.")
