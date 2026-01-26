"""Tests for security module."""

from datetime import timedelta

from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    """Tests for password hashing."""

    def test_hash_password_creates_hash(self):
        """Test that hash_password creates a hash different from input."""
        password = "mysecretpassword"
        hashed = hash_password(password)

        assert hashed != password
        assert len(hashed) > 0

    def test_hash_password_different_each_time(self):
        """Test that hashing the same password twice gives different results."""
        password = "mysecretpassword"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # bcrypt uses random salt, so hashes should be different
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Test that verify_password returns True for correct password."""
        password = "mysecretpassword"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test that verify_password returns False for wrong password."""
        password = "mysecretpassword"
        hashed = hash_password(password)

        assert verify_password("wrongpassword", hashed) is False


class TestJWT:
    """Tests for JWT token handling."""

    def test_create_access_token(self):
        """Test that create_access_token creates a non-empty token."""
        token = create_access_token(data={"sub": "testuser"})

        assert token is not None
        assert len(token) > 0
        assert token.count(".") == 2  # JWT has 3 parts

    def test_decode_token_valid(self):
        """Test that decode_token correctly decodes a valid token."""
        data = {"sub": "testuser", "extra": "data"}
        token = create_access_token(data=data)

        decoded = decode_token(token)

        assert decoded is not None
        assert decoded["sub"] == "testuser"
        assert decoded["extra"] == "data"
        assert "exp" in decoded

    def test_decode_token_invalid(self):
        """Test that decode_token returns None for invalid token."""
        invalid_token = "invalid.token.here"

        decoded = decode_token(invalid_token)

        assert decoded is None

    def test_decode_token_expired(self):
        """Test that decode_token returns None for expired token."""
        # Create token that expired 1 hour ago
        token = create_access_token(
            data={"sub": "testuser"},
            expires_delta=timedelta(hours=-1),
        )

        decoded = decode_token(token)

        assert decoded is None

    def test_create_access_token_custom_expiry(self):
        """Test that custom expiry is applied."""
        short_token = create_access_token(
            data={"sub": "testuser"},
            expires_delta=timedelta(minutes=5),
        )
        long_token = create_access_token(
            data={"sub": "testuser"},
            expires_delta=timedelta(days=30),
        )

        # Both should be valid
        assert decode_token(short_token) is not None
        assert decode_token(long_token) is not None
