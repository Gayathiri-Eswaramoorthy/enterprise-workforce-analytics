"""
JWT revocation (denylist) helpers backed by the revoked_tokens table.
"""

from datetime import datetime, timezone

from app.models import RevokedToken
from app.schemas.token import TokenPayload
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session


def is_token_revoked(db: Session, jti: str) -> bool:
    """
    Check whether a token ID has been revoked.
    """
    stmt = select(RevokedToken.id).where(RevokedToken.jti == jti)
    return db.execute(stmt).first() is not None


def revoke_token(db: Session, payload: TokenPayload) -> bool:
    """
    Add a token to the denylist. Does not commit.

    Returns:
        True if the token was newly revoked, False if it was already revoked.
        The insert is atomic, so two concurrent revocations of the same token
        cannot both return True (used to detect refresh-token reuse).
    """
    stmt = (
        insert(RevokedToken)
        .values(
            jti=payload.jti,
            user_id=payload.sub,
            expires_at=datetime.fromtimestamp(payload.exp, tz=timezone.utc),
        )
        .on_conflict_do_nothing(index_elements=["jti"])
        .returning(RevokedToken.id)
    )
    return db.execute(stmt).first() is not None


def purge_expired_revocations(db: Session) -> None:
    """
    Delete denylist entries whose tokens have expired anyway. Does not commit.
    """
    db.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
