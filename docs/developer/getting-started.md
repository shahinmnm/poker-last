# Getting Started

Guide for setting up your development environment.

## Prerequisites

### Required Software
Python 3.11 or higher, Node.js 18 or higher, PostgreSQL 15 or higher, Redis 7 or higher, Git for version control.

### Optional Tools
Docker and Docker Compose for container-based development, code editor with Python and TypeScript support, database client for PostgreSQL.

## Environment Setup

### Clone Repository
Clone the repository from GitHub, navigate to project directory, review README and documentation.

### Python Environment
Create virtual environment, activate virtual environment, install backend dependencies, install development dependencies.

### Frontend Environment
Navigate to frontend directory, install Node dependencies, configure environment variables, verify build works.

### Database Setup
Create PostgreSQL database, configure database connection, run migrations to create schema, optionally load test data.

### Redis Setup
Start Redis server, configure connection, verify connectivity, optional: configure persistence.

## Configuration

Copy environment template, fill required values, configure Telegram bot token, set database and Redis URLs, configure API base URL.

## Verification

Run backend server, verify API responds, run frontend development server, verify UI loads, run test suite, verify all tests pass.

## Related Documentation

- [Development Workflow](./workflow.md) - Daily practices
- [Testing Guide](./testing.md) - Test execution
- [Deployment](../deployment/overview.md) - Production setup
