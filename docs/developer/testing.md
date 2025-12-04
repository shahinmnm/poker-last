# Testing Guide

Guide for running and writing tests.

## Test Organization

### Test Structure
Tests organized by domain (backend, runtime, flows, API, integration), test fixtures in conftest files, shared utilities for testing, clear test naming.

### Test Types
Unit tests for isolated components, integration tests for workflows, API tests for endpoints, end-to-end tests for full scenarios.

## Running Tests

### Full Suite
Run all tests with pytest, specify test directory or file, use markers for test selection, parallel execution for speed.

### Specific Tests
Run single test file, run specific test function, run tests matching pattern, skip slow tests during development.

### Coverage
Generate coverage report, view HTML coverage, identify untested code, maintain coverage levels.

## Writing Tests

### Test Structure
Use arrange-act-assert pattern, clear test names describing what's tested, fixtures for setup and teardown, assertions verify expected behavior.

### Best Practices
Tests are independent and isolated, no test order dependencies, mock external services, use factories for test data, cleanup after tests.

### Template-Driven Tests
Use template factories, validate template propagation, test variant configurations, verify persistent vs expiring behavior.

## Test Data

Fixture provides test users, test tables from templates, isolated database per test, cleanup automatic.

## Related Documentation

- [Getting Started](./getting-started.md) - Environment
- [Development Workflow](./workflow.md) - Daily practices
- [Code Standards](./standards.md) - Conventions
