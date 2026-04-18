# Q-A-Agent: Document RAG & Evaluation Pipeline

Build an intelligent Q&A agent that answers questions over a corpus of documents using RAG, maintains conversation history, and evaluates its own answer quality using an LLM-as-a-judge system.

---

## 🚀 Setup Instructions

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Run Qdrant Vector Database**
   This project relies on Qdrant as an embedded/local vector search engine via Docker.
   ```bash
   docker compose up -d
   ```

3. **Configure Environment**
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   *Required Keys:*
   *   `OPENROUTER_API_KEY`: Or the API key of the Mistral provider if modified in code.
   *   `VOYAGE_API_KEY`: Required for embeddings.

4. **Start the Application**
   ```bash
   pnpm start:dev
   ```

---

## 🏗️ Architecture Overview (Phase 1)

**Framework:** NestJS wrapped with the high-performance **FastifyAdapter**.
**Type Safety & Configuration:** `@nestjs/config` combined with Zod schema validation ensures the application fails-fast on startup if the environment variables are misconfigured.
**Logging System:** A global **Winston** structured logger (`nest-winston`) outputs colored, human-readable logs in development (`nestLike`) and machine-parseable JSON logs in production.
**Agnostic LLM Configuration:** Provider interactions pass through a factory (`src/common/utils/llm-provider.factory.ts`), generating isolated `LanguageModel` instances. This strictly decouples the application code from specific underlying Generative AI APIs.

---

## 🧠 Technical Choices

### 1. Vector Database: Qdrant
**Why Qdrant?** 
Qdrant is extremely easy to implement via a local Docker container for development while offering robust multi-tenant capabilities, sub-millisecond retrieval efficiency via HNSW indexing, and an intuitive native TypeScript client (`@qdrant/js-client-rest`).

### 2. LLM Provider: OpenRouter (gpt-oss-120b:free)
**Why OpenRouter & GPT-OSS?**
OpenRouter grants us an ecosystem wrapper; we do not suffer from provider lock-in and can access a diverse myriad of models. Using `openai/gpt-oss-120b:free` guarantees that text generation costs are minimized during aggressive development and RAG evaluation sweeps, while preserving high instruction compliance for JSON-structured outputs.

### 3. Embedding Model: Voyage AI (voyage-4-lite)
**Why Voyage AI?**
Voyage AI specifically optimizes its models for retrieval quality on semantic search tasks over long-context documents. The `voyage-4-lite` variation provides a stellar tradeoff between high-fidelity dense vector outputs, minimal infrastructural footprints (lower dimension sizes), and extreme sub-second latency generation.

---

*Note: Chunking rationale, Prompt Engineering strategies, and Evaluation Results will be populated in subsequent phases.*
