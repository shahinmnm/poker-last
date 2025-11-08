"""Setup script for the Telegram Poker Bot package."""

from setuptools import setup, find_packages

setup(
    name="telegram-poker-bot",
    version="1.0.0",
    description="Production-grade Telegram Poker Bot with Mini App",
    author="Your Name",
    packages=find_packages(),
    install_requires=[
        "python-telegram-bot==20.7",
        "fastapi==0.109.0",
        "uvicorn[standard]==0.27.0",
        "sqlalchemy==2.0.25",
        "alembic==1.13.1",
        "asyncpg==0.29.0",
        "redis==5.0.1",
        "pydantic==2.5.3",
        "pydantic-settings==2.1.0",
        "structlog==24.1.0",
    ],
    python_requires=">=3.11",
)
