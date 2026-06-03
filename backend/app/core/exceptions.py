class AppException(Exception):
    """Exception de base pour l'application."""

    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail


class KoboConnectionError(AppException):
    def __init__(self, detail: str = None):
        super().__init__(
            "Le serveur Kobo ne répond pas actuellement. "
            "Réessayez dans quelques minutes.",
            503,
            detail,
        )


class GoogleAuthError(AppException):
    def __init__(self, detail: str = None):
        super().__init__(
            "Votre session Google a expiré. Veuillez vous reconnecter.", 401, detail
        )


class GoogleQuotaError(AppException):
    def __init__(self, detail: str = None):
        super().__init__(
            "Quota Google Drive dépassé. Libérez de l'espace pour continuer.",
            429,
            detail,
        )


class GooglePermissionError(AppException):
    def __init__(self, detail: str = None):
        super().__init__(
            "Accès refusé au dossier Drive. Vérifiez vos permissions de partage.",
            403,
            detail,
        )


class ResourceNotFoundError(AppException):
    def __init__(self, resource: str, detail: str = None):
        super().__init__(f"Ressource introuvable : {resource}", 404, detail)
