"""Security dependencies — JWT extraction & RBAC enforcement for FastAPI."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """FastAPI dependency that extracts and validates the Bearer JWT.

    Returns the authenticated ``User`` ORM instance.
    Raises 401 if the token is missing/invalid/expired or the user doesn't exist.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )
    return user


def require_roles(*roles: str | UserRole):
    """Return a FastAPI dependency that restricts access to the given roles.

    Usage::

        @router.get(
            "/admin/dashboard",
            dependencies=[Depends(require_roles("admin"))],
        )
        async def admin_dashboard(...):
            ...
    """
    allowed = {r.value if isinstance(r, UserRole) else r for r in roles}

    async def _check(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role.value}' is not authorized for this endpoint",
            )
        return user

    return _check
