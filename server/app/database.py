from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, pool_size=20, max_overflow=10, pool_pre_ping=True, pool_timeout=30)
async_session = async_sessionmaker(engine, expire_on_commit=False)
async_session_factory = async_session  # alias for scheduler


async def get_db():
    async with async_session() as session:
        yield session
