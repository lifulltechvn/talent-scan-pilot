"""Seed test user."""
import asyncio

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session
from app.models import User


async def seed():
    async with async_session() as db:
        existing = await db.execute(select(User).where(User.email == "hr@test.com"))
        if not existing.scalar_one_or_none():
            db.add(User(
                email="hr@test.com",
                hashed_password=hash_password("test1234"),
                full_name="HR Manager",
            ))
            await db.commit()
        print("✅ User: hr@test.com / test1234")
        print("   Dashboard: http://localhost")
        print("   Swagger:   http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
