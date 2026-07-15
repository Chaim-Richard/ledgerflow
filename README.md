# Enterprise Financial Ledger

Welcome to the Enterprise Financial Ledger application. 

This application is built for maximum efficiency and maintainability, using:
- **Vite** for blazing fast HMR and optimized builds
- **React.lazy** for dynamic component splitting and fast load times
- **Zustand** for zero-boilerplate, highly efficient state management
- **D3/Recharts** for hardware-accelerated SVG and Canvas visual intelligence

## Fast Modification Guides
To make sure any change you want to make is easy and fast, check out our dedicated architecture guidelines:

- 📖 **[Architecture & Modification Guide](README-ARCHITECTURE.md)**: Details on where to find things, how the plugins work, and where the single source of truth is stored.
- 🤖 **[Agent Instructions](AGENTS.md)**: Identical instructions formatted specifically for AI and AI Studio context windows so AI assistants always know exactly how to alter this repo.

## CLI Scaffolding (New!)
We've added a CLI tool to make adding new features extremely fast without copy/pasting files.

**To add a new View / Plugin:**
```bash
npm run scaffold:plugin MyNewView
```
*This automatically generates the component in `src/plugins/` and it gets immediately picked up by the navigation registry!*

**To add a new Financial Algorithm:**
```bash
npm run scaffold:algo my-new-algorithm
```
*This creates a new tool in `src/lib/algorithms/`. Import it to `index.ts` and it will appear in the Sandbox automatically.*
