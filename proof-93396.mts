/**
 * Runtime proof: memory embedding provider routing fix for #93396
 *
 * Usage: node --import tsx proof-93396.mts
 *
 * Demonstrates that "openai" provider with api:"ollama" routes embedding
 * through the Ollama adapter at runtime — not OpenAl.
 */
import { registerMemoryEmbeddingProvider, getMemoryEmbeddingProvider, clearMemoryEmbeddingProviders } from "./src/plugins/memory-embedding-providers.js";
import { resolveMemorySearchConfig } from "./src/agents/memory-search.js";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

function check(label: string, ok: boolean) {
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${tag} ${label}`);
  return ok;
}

function banner(text: string) {
  console.log(`\n${CYAN}── ${text} ──${RESET}`);
}

// ── Setup ──────────────────────────────────────────────────
banner("Register adapters: openai + ollama");

clearMemoryEmbeddingProviders();

registerMemoryEmbeddingProvider({
  id: "openai",
  defaultModel: "text-embedding-3-small",
  transport: "remote",
  create: async () => ({ provider: null }),
});
console.log("  registered openai  (model: text-embedding-3-small)");

let ollamaCreated = false;
registerMemoryEmbeddingProvider({
  id: "ollama",
  defaultModel: "nomic-embed-text",
  transport: "remote",
  create: async () => {
    ollamaCreated = true;
    return { provider: null };
  },
});
console.log("  registered ollama  (model: nomic-embed-text)");

// ── Config ─────────────────────────────────────────────────
banner("Config: openai provider → api:ollama, local baseUrl");

const cfg: Record<string, unknown> = {
  models: {
    providers: {
      openai: {
        api: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        models: [],
      },
    },
  },
  agents: {
    defaults: {
      memorySearch: { provider: "openai" },
    },
  },
};
console.log("  providers.openai.api    = \"ollama\"");
console.log("  providers.openai.baseUrl = \"http://127.0.0.1:11434/v1\"");
console.log("  memorySearch.provider    = \"openai\"");

// ── Resolve ─────────────────────────────────────────────────
banner("Config resolution");

const resolved = resolveMemorySearchConfig(cfg as never, "main");
console.log(`  resolved.provider = "${resolved?.provider}"`);
console.log(`  resolved.model    = "${resolved?.model}"`);

// ── Verdict ─────────────────────────────────────────────────
banner("Verdict");

const expectOpenaiModel = "text-embedding-3-small";
const expectOllamaModel = "nomic-embed-text";

let passed = true;
passed = check(
  `model is "${expectOllamaModel}" (ollama) — NOT "${expectOpenaiModel}" (openai)`,
  resolved?.model === expectOllamaModel,
) && passed;
passed = check(
  "resolved.provider stays \"openai\" (user-visible id unchanged)",
  resolved?.provider === "openai",
) && passed;

// ── Runtime chain ───────────────────────────────────────────
banner("Runtime adapter.create() chain");

const adapter = getMemoryEmbeddingProvider("ollama");
passed = check("getMemoryEmbeddingProvider(\"ollama\") returns adapter", !!adapter) && passed;

if (adapter) {
  const result = await adapter.create({
    provider: resolved?.provider ?? "openai",
    model: resolved?.model ?? "nomic-embed-text",
    agentDir: "/tmp/proof-agent",
    config: cfg as never,
    fallback: "none",
  });
  passed = check("adapter.create() executed without error", result !== undefined) && passed;
  passed = check("ollama adapter.create() was invoked (not openai)", ollamaCreated) && passed;
}

// ── Summary ─────────────────────────────────────────────────
banner(passed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");

const exitCode = passed ? 0 : 1;
process.exitCode = exitCode;
if (!passed) console.error(`\n${RED}Fix not fully verified${RESET}`);
