# Security policy

Library of College stores people's personal essay material, so security reports are taken seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Report privately through GitHub:
**Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it, and the impact you expect. You'll get an acknowledgement within a few days. Please give reasonable time for a fix before disclosing publicly.

## Scope

- The code in this repo (`app.html`, `login.html`, `index.html`, `backend/index.mjs`, `api/clerk-proxy.mjs`).
- The hosted instance at liboc.vercel.app — test only against **your own** account. Don't access other people's data, run load tests, or burn through the AI endpoints.

Clerk publishable keys (`pk_…`) and the API Gateway URL in the frontend are public by design; they're not vulnerabilities on their own.
