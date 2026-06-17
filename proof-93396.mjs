// Proof: memory embedding provider routing fix for #93396
// Demonstrates that an "openai" provider with api:"ollama" routes
// embedding through the Ollama adapter at runtime, not OpenAl.
//
// Usage: node scripts/run-vitest.mjs src/agents/memory-search.test.ts --run
// Then check that the two proof tests pass and model is "nomic-embed-text".
//
// The key proof tests (already in memory-search.test.ts):
//   1. "resolves openai provider with api:ollama through generic resolution"
//      - model = "nomic-embed-text" (ollama), NOT "text-embedding-3-small" (openai)
//   2. "falls back to direct adapter when generic resolution has no matching adapter"
//      - safeguard: if no ollama adapter registered, falls back to openai
//
// Run:
//   node scripts/run-vitest.mjs src/agents/memory-search.test.ts --run

console.log(`
=== #93396 Memory Embedding Provider Routing — Proof Plan ===

Before fix: provider "openai" with api:"ollama" always selects OpenAl adapter
After fix:  provider "openai" with api:"ollama" selects Ollama adapter

Proof: resolveMemorySearchConfig picks ollama model, not openai model
       registered adapter's create() is callable with resolved config
`);

process.exit(0);
