# Development Workflow

Guide for daily development practices.

## Development Cycle

### Feature Development
Create feature branch from main, implement changes, write tests, run local tests, commit frequently with clear messages.

### Code Quality
Run linters before committing, format code consistently, type checking with mypy for Python, type checking with TypeScript, fix warnings and errors.

### Testing
Write tests for new features, update tests for changes, run full test suite locally, verify all tests pass, add integration tests if needed.

### Documentation
Update documentation for changes, keep README current, document new APIs or features, update architecture docs if needed.

## Local Development

### Backend Development
Run backend with hot reload, automatic restart on changes, debug logging enabled, use debugger for troubleshooting.

### Frontend Development
Run Vite dev server, hot module replacement, fast refresh, browser DevTools for debugging.

### Database Changes
Create Alembic migration, test upgrade and downgrade, verify data integrity, document schema changes.

## Code Review

Submit pull request with description, respond to review feedback, update code as requested, ensure CI passes, merge when approved.

## Related Documentation

- [Getting Started](./getting-started.md) - Environment setup
- [Testing Guide](./testing.md) - Test practices
- [Code Standards](./standards.md) - Conventions
