import asyncio
import logging
import random
from functools import wraps
from typing import Type, Union, Tuple

logger = logging.getLogger("retry_service")

def retry_with_backoff(
    retries: int = 3,
    backoff_in_seconds: float = 2.0,
    exceptions: Union[Type[Exception], Tuple[Type[Exception], ...]] = (Exception,)
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
                        logger.error(f"Abandon après {retries} tentatives pour {func.__name__}: {e}")
                        raise e
                    
                    sleep_time = (backoff_in_seconds * (x ** 2)) + random.uniform(0, 1)
                    if x == 0: sleep_time = 0 # Première erreur, on peut retenter presque de suite ou selon le backoff
                    
                    # Logique demandée: T1 immédiat, T2 +2s, T3 +5s
                    # Si x=0 (echec 1), x=1 (echec 2)...
                    actual_sleep = 0
                    if x == 0: actual_sleep = 2
                    elif x == 1: actual_sleep = 5
                    
                    logger.warning(f"Tentative {x+1} échouée pour {func.__name__}. Nouvel essai dans {actual_sleep}s... (Erreur: {e})")
                    await asyncio.sleep(actual_sleep)
                    x += 1
        return wrapper
    return decorator
