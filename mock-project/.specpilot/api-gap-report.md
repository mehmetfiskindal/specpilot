# API Gap Report - SpecPilot

*Generated on 2026-05-20T12:33:36.337Z*
- **Spec file**: `openapi.yaml`
- **Source folder**: `src`
- **Framework**: `EXPRESS`

## Missing in Code
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/refresh` | Refresh Token |

## Missing in OpenAPI Spec
✔ No extra endpoints found in code.

## Missing Tests
| Method | Path | Expected Test Location |
|---|---|---|
| `POST` | `/auth/login` | `src/controllers/auth.controller.test.ts` |
| `GET` | `/items` | `src/controllers/item.controller.test.ts` |

## Risky Endpoints
| Severity | Method | Path | Mismatch Issue |
|---|---|---|---|
| **HIGH** | `POST` | `/items` | Requires auth in spec, but auth middleware/guard was not detected in code. |
| **MEDIUM** | `POST` | `/items` | Defines validation in spec, but input validation/Body decorator was not detected in code. |

## Suggested Next Tasks
- 1. Implement endpoint: POST /auth/refresh
- 2. Fix high risk: Add auth guard/middleware to POST /items
- 3. Create tests: Add validation/integration test for POST /auth/login (e.g. in src/controllers/auth.controller.test.ts)
- 4. Create tests: Add validation/integration test for GET /items (e.g. in src/controllers/item.controller.test.ts)
- 5. Add validation schema to code: POST /items
