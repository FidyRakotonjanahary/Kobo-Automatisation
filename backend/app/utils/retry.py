import asyncio
import logging
from functools import wraps
from typing import Tuple, Type, Union

logger = logging.getLogger("retry_service")


def retry_with_backoff(
    retries: int = 3,
    backoff_in_seconds: float = 2.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = (Exception,),
):
    """
    Décorateur pour re-tenter une fonction asynchrone avec un backoff exponentiel.
    Tentative 1: Immédiate
    Tentative 2: +backoff
    Tentative 3: +backoff * 2.5 (environ 5s si backoff=2)
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            x = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if x == retries:
                        logger.error(
                            "Abandon après %s tentatives pour %s: %s",
                            retries,
                            func.__name__,
                            e,
                        )
                        raise e

                    # Logique demandée: T1 immédiat, T2 +2s, T3 +5s
                    # Si x=0 (echec 1), x=1 (echec 2)...
                    actual_sleep = 0
                    if x == 0:
                        actual_sleep = 2
                    elif x == 1:
                        actual_sleep = 5

                    logger.warning(
                        f"Tentative {x + 1} échouée pour {func.__name__}. "
                        f"Nouvel essai dans {actual_sleep}s... (Erreur: {e})"
                    )
                    await asyncio.sleep(actual_sleep)
                    x += 1

        return wrapper

    return decorator
