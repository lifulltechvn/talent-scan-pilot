"""PII encryption using Fernet (cryptography package)."""
import json
import os

from cryptography.fernet import Fernet

KEY_FILE = os.path.join(os.path.dirname(__file__), "pii.key")


def _get_fernet() -> Fernet:
    if os.path.exists(KEY_FILE):
        key = open(KEY_FILE, "rb").read()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
    return Fernet(key)


def encrypt_pii(pii_dict: dict) -> str:
    return _get_fernet().encrypt(json.dumps(pii_dict).encode()).decode()


def decrypt_pii(encrypted: str) -> dict:
    return json.loads(_get_fernet().decrypt(encrypted.encode()))
