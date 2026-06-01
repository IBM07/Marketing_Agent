# Contributing to HyperDrive AI

First off, thank you for considering contributing to HyperDrive AI! It's people like you that make open-source software such a great community.

## 🤝 How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue on GitHub. Before creating a new issue, please search the existing issues to ensure it hasn't already been reported.

### Suggesting Enhancements
Enhancement suggestions are highly encouraged! If you have an idea for a new feature or an improvement, please open a feature request issue.

### Pull Requests
We welcome pull requests for bug fixes, new features, and documentation improvements.

1. **Fork the repo** and create your branch from `main`.
2. **Create a feature branch:** `git checkout -b feat/my-new-feature` or `git checkout -b fix/issue-number`.
3. **Write tests** for your code if applicable (unit tests via Vitest).
4. **Make sure the test suite passes:** `npm run test` and `npm run lint`.
5. **Commit your changes:** Follow the conventional commits standard. Example: `feat: add new LLM provider` or `fix: resolve API timeout issue`.
6. **Push to your fork:** `git push origin feat/my-new-feature`.
7. **Submit a pull request** providing a detailed explanation of your changes.

## 💻 Development Setup

To run the project locally, please refer to the "Getting Started" section in the main [README.md](README.md).

### Code Style
- We use **TypeScript** with strict mode enabled.
- We use **ESLint** for code linting. Please ensure `npm run lint` passes before submitting a PR.
- We use **Prettier** for code formatting.

### Architecture Guidelines
- **API Routes:** Use the `withApiHandler` utility in `src/lib/api-handler.ts` for all Next.js API routes to ensure consistent error handling and standard responses.
- **Database:** Do not write raw SQL unless absolutely necessary. Use the Prisma client (`src/lib/prisma.ts`). If you change the schema, ensure you run `npx prisma generate`.
- **UI Components:** We rely on Tailwind CSS and Framer Motion. Ensure new components are fully responsive and support both light and dark mode contexts where applicable.

Thank you for contributing!
