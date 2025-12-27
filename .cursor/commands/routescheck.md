Server is always running at http://localhost:3000/ and ready for testing routes.

Use PowerShell syntax for any commands to interact with the server, scripts, or file operations.

Do not run the build process unless explicitly asked.

For every route or endpoint in the project:

Check functionality by sending requests and verifying responses.

Compare actual results with expected behavior or intended output.

Identify mismatches, inconsistencies, or potential improvements (e.g., naming, parameters, HTTP methods, return types, status codes, error handling).

Detect unused, duplicate, or unreachable routes.

For each issue found:

Determine the root cause.

Apply a robust fix, ensuring that changes do not break other routes or dependencies.

Verify the fix by testing the route again.

Ensure that all routes are:

Properly aligned with project standards and conventions.

Fully functional, accessible, and returning correct responses.

Consistent with any authentication, middleware, or API contracts.

After working on each route, run lint across the project to ensure no issues were introduced.

Continue this process route by route until all endpoints are verified, improved, and aligned.

Do not generate summaries or ask follow-up questions. Focus only on robustly fixing and aligning all routes.

Constraints:

The analysis and fixes run on the local project folder in development mode.

Changes must preserve functionality and server behavior.

The goal is a fully functional, aligned, and robust routing system for the project.