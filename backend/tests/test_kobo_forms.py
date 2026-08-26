import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio
from app.models.credential import Credential
from app.services.kobo_service import KoboService
from app.schemas.kobo import KoboFormRead

class TestKoboForms(unittest.TestCase):
    def test_kobo_form_read_schema(self):
        form_data = {
            "uid": "aSurveyUid123",
            "name": "Formulaire Test",
            "asset_type": "survey",
            "owner_username": "phaos_user",
            "submissions_count": 42,
            "date_modified": "2026-08-20T10:00:00Z",
            "has_deployment": True,
        }
        form_obj = KoboFormRead(**form_data)
        self.assertEqual(form_obj.uid, "aSurveyUid123")
        self.assertEqual(form_obj.submissions_count, 42)
        self.assertEqual(form_obj.name, "Formulaire Test")

    def test_list_forms_extraction(self):
        async def run_test():
            fake_cred = MagicMock(spec=Credential)
            fake_cred.base_url = "https://kf.kobotoolbox.org"
            fake_cred.username = "test_user"
            fake_cred.encrypted_password = b"dummy"

            fake_kobo_payload = {
                "results": [
                    {
                        "uid": "form1",
                        "name": "Projet A",
                        "asset_type": "survey",
                        "owner__username": "test_user",
                        "deployment__submission_count": 150,
                        "date_modified": "2026-08-25T12:00:00Z",
                        "has_deployment": True
                    },
                    {
                        "uid": "form2",
                        "name": "Projet B (sans soumission)",
                        "asset_type": "survey",
                        "owner__username": "test_user",
                        "deployment__submission_count": None,
                        "date_modified": "2026-08-24T10:00:00Z",
                        "has_deployment": True
                    },
                    {
                        "uid": "block1",
                        "name": "Question Block",
                        "asset_type": "block",
                        "owner__username": "test_user"
                    }
                ]
            }

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_response.json.return_value = fake_kobo_payload

            with patch("app.services.kobo_service.security_manager.decrypt", return_value="plain_pass"):
                with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                    mock_get.return_value = mock_response
                    forms = await KoboService.list_forms(fake_cred)

            self.assertEqual(len(forms), 2)
            self.assertEqual(forms[0]["uid"], "form1")
            self.assertEqual(forms[0]["submissions_count"], 150)
            self.assertEqual(forms[0]["name"], "Projet A")
            self.assertEqual(forms[1]["uid"], "form2")
            self.assertEqual(forms[1]["submissions_count"], 0)

        asyncio.run(run_test())

    def test_test_connection_success_and_failures(self):
        async def run_test():
            fake_cred = MagicMock(spec=Credential)
            fake_cred.base_url = "https://kf.kobotoolbox.org"
            fake_cred.username = "test_user"
            fake_cred.encrypted_password = b"dummy"

            # Case 1: Success 200
            mock_200 = MagicMock()
            mock_200.status_code = 200

            with patch("app.services.kobo_service.security_manager.decrypt", return_value="plain_pass"):
                with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                    mock_get.return_value = mock_200
                    success, message = await KoboService.test_connection(fake_cred)
                    self.assertTrue(success)
                    self.assertIn("succès", message)

            # Case 2: 401 Unauthorized
            mock_401 = MagicMock()
            mock_401.status_code = 401

            with patch("app.services.kobo_service.security_manager.decrypt", return_value="plain_pass"):
                with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
                    mock_get.return_value = mock_401
                    success, message = await KoboService.test_connection(fake_cred)
                    self.assertFalse(success)
                    self.assertIn("invalides", message)

        asyncio.run(run_test())

    def test_account_update_schema(self):
        from app.schemas.kobo import KoboAccountUpdate
        update_data = KoboAccountUpdate(name="Nouveau Nom", password=None)
        self.assertEqual(update_data.name, "Nouveau Nom")
        self.assertIsNone(update_data.password)


if __name__ == "__main__":
    unittest.main()
