Perform a complete, file-by-file codebase audit of this project. For every file and folder, identify its purpose, exported functions/classes, public methods, call sites, inputs/outputs, side effects, and external dependencies. Include whether tests exist and their coverage, highlight performance or structure hotspots, and suggest actionable remediations, refactors, or simplifications.

In addition, pay special attention to:

Next.js config & structure: next.config.js, app/ or pages/, api/ routes, middleware, layouts, dynamic routing, and SSR/ISR usage.

Tailwind setup: tailwind.config.js, globals.css, custom utilities, and how Tailwind classes are applied across components.

shadcn/ui components: usage, composition, styling, and consistency across the project.

Docker & DevOps: Dockerfile, docker-compose.yml, .dockerignore, environment configs, and how they relate to local development and production builds.

Deliverables:

A per-file summary table (path | purpose | exports | usage | tests | notes).

A dependency graph of modules and their relationships.

Suggested quick fixes or refactors, with example patches where relevant.

Constraints:

The analysis runs on the local project folder in development mode.

Do not include bug/security scans.

Do not generate an overall summary or ask follow-up questions.

The goal is only to ensure full understanding of the entire project and its configuration.