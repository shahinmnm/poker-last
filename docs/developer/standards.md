# Code Standards

Coding conventions and best practices.

## General Principles

Write clear and maintainable code, follow language idioms, document complex logic, avoid premature optimization, refactor when needed.

## Python Standards

### Style
Follow PEP 8 style guide, use Black for formatting, use Ruff for linting, type hints for all functions, docstrings for modules and classes.

### Async Code
Use async/await properly, avoid blocking operations, handle exceptions in async code, cleanup resources properly.

### Imports
Organize imports logically, absolute imports preferred, group by standard library, third-party, local.

## TypeScript Standards

### Style
Follow TypeScript conventions, use ESLint for linting, Prettier for formatting, strict type checking, avoid any type.

### React Code
Functional components preferred, hooks for state and effects, proper dependency arrays, clear component boundaries.

### Types
Define types for all data, use interfaces for objects, type all function parameters, avoid implicit any.

## Database Code

Use SQLAlchemy ORM consistently, avoid raw SQL queries, use transactions properly, handle migrations carefully.

## API Design

RESTful endpoint design, consistent response formats, proper HTTP status codes, clear error messages, versioning when needed.

## Related Documentation

- [Getting Started](./getting-started.md) - Environment
- [Development Workflow](./workflow.md) - Practices
- [Testing Guide](./testing.md) - Test standards
