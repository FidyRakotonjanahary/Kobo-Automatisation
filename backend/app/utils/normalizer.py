import re
import unicodedata


class TextNormalizer:
    @staticmethod
    def normalize(text: str) -> str:
        if not text or not isinstance(text, str):
            return str(text or "").strip()
        # Supprime les accents
        s = unicodedata.normalize("NFD", text)
        s = "".join([c for c in s if not unicodedata.combining(c)])
        # Nettoyage standard : majuscules, sans espaces
        normalized = s.strip().upper().replace(" ", "_")
        normalized = re.sub(r"_+", "_", normalized).strip("_")

        # Dictionnaire des corrections orthographiques et synonymes des sites
        corrections = {
            "ANKONDROMEN": "ANKONDROMENA",
            "ANKODROMEN": "ANKONDROMENA",
            "ANKODROMENA": "ANKONDROMENA",
            "ANKONDROMENINA": "ANKONDROMENA",
        }

        # Remplacement exact
        if normalized in corrections:
            return corrections[normalized]

        # Remplacement si préfixe (ex: ANKONDROMEN_NORD -> ANKONDROMENA_NORD)
        for orig, corr in corrections.items():
            if normalized.startswith(orig + "_"):
                return normalized.replace(orig + "_", corr + "_", 1)

        return normalized
