# StudentsBudget
Budget app for students new to a city: see where your money goes across all your accounts and cash, check whether your budget is realistic for your city, and log spending in seconds. Installable web app; data stays on your phone.

## Project notes
`docs/` is an Obsidian vault (open the folder as a vault). Read in this order:

1. [Student Budget App](docs/Student%20Budget%20App.md): the idea, research and risks
2. [Concept](docs/Student%20Budget%20App%20-%20Concept.md): what the app does, phases, and the P1 scope
3. [Tech Stack](docs/Student%20Budget%20App%20-%20Tech%20Stack.md): stack choice, alternatives, learning path
4. [Repo Setup](docs/Student%20Budget%20App%20-%20Repo%20Setup.md): GitHub settings checklist
5. [Kickoff](docs/Student%20Budget%20App%20-%20Kickoff.md): repo layout and how a build day runs
6. [P1 plan](docs/superpowers/plans/2026-10-16-p1-test-project.md): the 4-day build plan, task by task

## Development
Needs Node 24 and npm. Run `npm install` once, then:

- `npm run dev`: start the app on http://localhost:3000
- `npm test`: unit tests (Vitest)
- `npm run test:e2e`: end-to-end tests (Playwright, desktop Chrome and iPhone WebKit; install the browsers once with `npx playwright install chromium webkit`)
- `npm run typecheck`: TypeScript check
- `npm run lint`: ESLint
