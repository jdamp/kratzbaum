"""Database connection and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

async_session_factory = sessionmaker(  # type: ignore
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db() -> None:
    """Create all database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

        # Lightweight schema drift fix for existing deployments without migrations.
        # New installs already get this column from SQLModel metadata.
        if conn.dialect.name == "sqlite":
            result = await conn.exec_driver_sql("PRAGMA table_info(settings)")
            column_names = {row[1] for row in result.fetchall()}
            if "plantnet_api_key" not in column_names:
                await conn.exec_driver_sql(
                    "ALTER TABLE settings ADD COLUMN plantnet_api_key VARCHAR(255)"
                )
        else:
            await conn.exec_driver_sql(
                "ALTER TABLE settings ADD COLUMN IF NOT EXISTS plantnet_api_key VARCHAR(255)"
            )


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get an async database session."""
    async with async_session_factory() as session:
        yield session
