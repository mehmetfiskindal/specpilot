# SpecPilot AI Developer Skill

This skill guides AI coding assistants to enforce OpenAPI-first coding practices.

## How to use SpecPilot
1. Always analyze API compliance before starting code modifications.
2. Run `specpilot analyze` to view the API Gap Report.
3. Fix issues listed in the "Suggested Next Tasks" in order:
   - **Missing in code**: Build missing endpoints exactly according to the spec definitions.
   - **Risky endpoints**: Ensure auth middleware (Guards) and validation pipelines match schemas.
   - **Missing tests**: Create corresponding unit/integration tests.
4. After implementation, run `specpilot analyze` again to verify zero contract gaps.
