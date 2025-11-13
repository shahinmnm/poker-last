# Copilot Instructions for PokerKit Repository

## Overview

This repository contains **PokerKit**, an open-source Python library for poker game simulations, hand evaluations, and statistical analysis. It also includes a **Telegram Poker Bot** application that provides a web-based poker interface with Telegram integration.

### Repository Structure

- `pokerkit/` - Core poker library (Python package)
  - Game logic for major and minor poker variants
  - High-speed hand evaluation
  - Customizable game states and parameters
  - Extensive unit tests and doctests
- `telegram_poker_bot/` - Telegram poker bot application
  - `bot/` - Telegram bot handlers and logic
  - `api/` - FastAPI backend
  - `frontend/` - Web UI components
  - `game_core/` - Game engine integration
  - `migrations/` - Database migrations
  - `tests/` - Test suite
- `deploy/` - Deployment scripts and Docker configurations
- `docs/` - Documentation source files
- `docker/` - Docker-related files
- `.github/workflows/` - CI/CD workflows

## Python Version

This project requires **Python 3.11 or higher**. All code should be compatible with Python 3.11, 3.12, and 3.13.

## Setup and Installation

### For PokerKit Library Development

1. Clone the repository
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
4. Install development dependencies: `pip install -r requirements.txt`

### For Telegram Bot Development

1. Copy the example environment file: `cp .env.example .env`
2. Edit `.env` with your configuration
3. Install runtime dependencies: `pip install -r telegram_poker_bot/requirements.txt`

### Using Docker

- First deployment: `make deploy` (builds images, runs migrations, starts services)
- Development mode: `make compose-dev`
- Update deployment: `make update`
- View logs: `make compose-logs`
- Stop services: `make compose-down`

See `deploy/README.md` and `telegram_poker_bot/SETUP.md` for detailed deployment instructions.

## Code Style and Standards

### Style Guidelines

- Follow **PEP 8** Python style guide strictly
- Use type hints for all functions and methods
- Write clear, descriptive docstrings for all public APIs
- Keep code coverage high (target: 99%)

### Linting and Formatting

For the PokerKit library:
- Style checking: `flake8 pokerkit`
- Static type checking: `mypy --strict pokerkit`
- Docstring coverage: `interrogate -f 100 -i -m -n -p -s -r '^\w+TestCase' pokerkit`

For the Telegram Bot:
- Linting: `ruff check pokerkit telegram_poker_bot`
- Formatting check: `black --check pokerkit telegram_poker_bot`
- Format code: `black pokerkit telegram_poker_bot`

**Run linting before committing any changes.**

## Testing

### Running Tests

- PokerKit unit tests: `python -m unittest`
- PokerKit doctests: `python -m doctest pokerkit/*.py`
- Combined tests (using Makefile): `make test` (runs `pytest pokerkit telegram_poker_bot/tests`)
- All validations combined: Run all linting and testing commands listed above

### Test Requirements

- All new features must have unit tests
- Maintain high code coverage (aim for 99%)
- Tests should pass both unit tests and doctests
- Static type checking with `--strict` flag must pass

## Building and Documentation

- Build package: `python -m build`
- Documentation is built with Sphinx (see `docs/` directory)
- Documentation is hosted on ReadTheDocs: https://pokerkit.readthedocs.io/en/latest/

## Contributing Guidelines

### Before Submitting a Pull Request

1. **Run all validation checks** (in order):
   - `flake8 pokerkit` - Style checking
   - `mypy --strict pokerkit` - Static type checking
   - `interrogate -f 100 -i -m -n -p -s -r '^\w+TestCase' pokerkit` - Docstring coverage
   - `python -m unittest` - Unit tests
   - `python -m doctest pokerkit/*.py` - Doctests
   - For Telegram Bot: `ruff check` and `black --check`

2. **All checks must pass** before creating a pull request

3. **Write comprehensive tests** for any new functionality

4. **Update documentation** if adding new features or changing APIs

5. **Follow commit conventions**: Write clear, descriptive commit messages

### Code Review Standards

- PRs should be focused and atomic
- Include tests with all code changes
- Ensure backward compatibility when possible
- Document breaking changes clearly

## CI/CD

The repository uses GitHub Actions for continuous integration:
- Workflow: `.github/workflows/checks.yml`
- Runs on: Pull requests and pushes
- Checks: Style checking, static type checking, unit tests, doctests

All CI checks must pass before merging.

## Deployment

### Production Deployment

The repository includes production-ready Docker Compose configurations:
- See `deploy/README.md` for deployment guide
- Use `make deploy` for initial bootstrap
- Use `make update` to pull latest changes and restart
- Database migrations are in `telegram_poker_bot/migrations/`

### Environment Variables

- Copy `.env.example` to `.env` before running
- Configure database, Telegram tokens, and other settings in `.env`

## Important Notes

- **Never commit secrets** or credentials to the repository
- Use `.env` files for local configuration (`.env` is in `.gitignore`)
- The library (`pokerkit/`) is published to PyPI as `pokerkit`
- The Telegram bot is a separate application that uses the PokerKit library
- Static type checking with strict mode is mandatory for the core library
- All public APIs must have complete docstrings

## Package Distribution

- Package name: `pokerkit`
- Current version: 0.6.4 (check `setup.py` for latest)
- Published to PyPI: https://pypi.org/project/pokerkit/
- License: MIT

## Resources

- Documentation: https://pokerkit.readthedocs.io/en/latest/
- Source: https://github.com/uoftcprg/pokerkit
- Issues: https://github.com/uoftcprg/pokerkit/issues
- Contributing Guide: See `CONTRIBUTING.rst`
- Changelog: See `CHANGELOG.rst`
