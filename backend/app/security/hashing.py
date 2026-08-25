"""
Password hashing and verification utilities.
"""

from passlib.context import CryptContext

# CryptContext configured with bcrypt backend
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.

    Args:
        password: The plain text password to hash.

    Returns:
        The hashed password string.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a stored hash.

    Args:
        plain_password: The plain text password to check.
        hashed_password: The stored password hash.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)
