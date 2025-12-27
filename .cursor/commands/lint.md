Perform a complete linting and cleanup of this project. For every file and folder:

Run ESLint with the --fix flag to automatically address fixable issues.

Identify unused imports, functions, variables, and commented-out code across the entire project.

Remove the identified unused code and imports safely, ensuring no side effects or breakage.

Generate a detailed to-do list for each identified issue, including:

File path

Type of issue (e.g., unused import, unused function)

Suggested fix

Dependencies affected

Apply fixes step-by-step, verifying after each change that:

The application still runs correctly.

No new linting issues are introduced.

After each fix, run lint to ensure no errors or warnings remain.

Document all changes made, including:

Reason for removal

Any refactoring done

Tests affected or added

Ensure that all changes align with the project's coding standards and best practices.

Constraints:

The analysis and fixes run on the local project folder in development mode.

Do not include bug/security scans.

Do not generate overall summaries or ask follow-up questions.

The goal is to produce a clean, maintainable, and efficient codebase with all unused code removed.