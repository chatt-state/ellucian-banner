# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-13

### Added

- Ethos Integration client with typed CRUD operations and EEDM versioned headers
- 19 typed resource accessors (persons, students, courses, sections, academic-periods, grades, section-registrations, instructional-events, student-academic-credentials, financial-aid, finance, HR)
- Change notification consumer with single poll and async generator polling
- GraphQL client for Ethos GraphQL endpoint
- QAPI (POST-based search) client with pagination
- Criteria filtering and named query support
- Native Banner REST client (StudentApi, BannerAdminBPAPI) with Basic Auth
- OpenAPI/Swagger codegen CLI for generating typed clients from specs
- Ethos JWT authentication with auto-refresh and env var fallback
- Banner Basic Auth with env var fallback and validation
- HTTP client with auth injection, configurable timeouts, and debug logging
- Retry logic with exponential backoff for 429/5xx responses
- Typed error hierarchy (BannerError, AuthError, NotFoundError, RateLimitError, ValidationError, ServerError)
- Reusable pagination utilities with async generators
- EEDM type definitions for all major domains
- ESM + CJS dual output
- GitHub Actions CI (Node 18.x + 22.x)
