import unicodedata

class TextNormalizer:
    @staticmethod
    def normalize(text: str) -> str:
        if not text or not isinstance(text, str):
            return str(text or "").strip()
        # Supprime les accents
        s = unicodedata.normalize('NFD', text)
        s = "".join([c for c in s if not unicodedata.combining(c)])
        # Nettoyage standard : majuscules, sans espaces
        return s.strip().upper().replace(" ", "_")
