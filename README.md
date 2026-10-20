# Ex2Bundle demo

Interactive demo of example-driven focused text snippet extraction
([Ex2Bundle, arXiv:2605.19246](https://arxiv.org/abs/2605.19246)).

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # development server with hot reload → http://localhost:3000
```

For a production build:

```bash
npm run build
npm start          # → http://localhost:3000 (use `npm start -- -p 4000` for another port)
```

## Using the demo

1. **Document selection** — mark each document as a *Source* (you pick example sentences from it) or a *Target* (a snippet is extracted from it).
2. **Source documents** — open each source tab and click sentences to build an example snippet.
3. **Retrieve snippets** — learns topic bounds from your examples, relaxes them until each target is feasible, and extracts the most informative matching snippet (term-frequency merit) from every target.
4. **Topic importance** — move a slider toward *Less* / *More* to tighten or shift that topic's bounds; results update immediately.

## Code map

- `src/data/documents.ts` — documents and per-sentence topic scores (hand-assigned stand-ins for the topic model).
- `src/lib/ex2bundle.ts` — bound synthesis, relaxation (Algorithm 1), slider ↔ bound mapping, and the snippet solver.
- `src/components/` — the four page sections.
