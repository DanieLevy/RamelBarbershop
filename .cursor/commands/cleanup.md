Perform a complete, file-by-file cleanup audit of this project. For every file and folder, detect and list:

Unused functions, classes, or methods inside components.

Components that are never imported or referenced anywhere in the project.

Leftover code fragments, commented-out blocks, obsolete imports, or duplicate utilities.

Deprecated or redundant configuration entries (in next.config.js, tailwind.config.js, docker-compose.yml, etc.).

Stale assets (images, CSS, fonts, icons) not referenced in the codebase.

Deliverables:

A per-file cleanup table (path | unused items | notes | suggested removal).

A list of components/functions safe to remove with reasoning.

Example patches (unified diffs) showing the minimal safe removal of each unused element.

Constraints:

The analysis runs on the local project folder in development mode.

Do not include bug/security scans.

Do not generate an overall summary or ask follow-up questions.

The goal is only to ensure the project is fully cleaned of unused or leftover code and configurations.