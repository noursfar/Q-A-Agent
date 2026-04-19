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

4. **Download the Wikipedia Corpus**
   Fetch the raw `.json` articles from Wikipedia:
   ```bash
   pnpm fetch-articles
   ```

5. **Start the Ingestion Pipeline**
   Build the app and upsert text chunks to Qdrant:
   ```bash
   pnpm ingest
   ```

6. **Start the Application**
   ```bash
   pnpm start:dev
   ```

---

## 🏗️ Architecture Overview

**Framework:** NestJS wrapped with the high-performance **FastifyAdapter**.

**Type Safety & Configuration:** `@nestjs/config` combined with Zod schema validation ensures the application fails-fast on startup if the environment variables are misconfigured.

**Logging System:** A global **Winston** structured logger (`nest-winston`) outputs colored, human-readable logs in development (`nestLike`) and machine-parseable JSON logs in production.

**Agnostic LLM Configuration:** Provider interactions pass through a factory (`src/common/utils/llm-provider.factory.ts`), generating isolated `LanguageModel` instances. This strictly decouples the application code from specific underlying Generative AI APIs.

**Idempotent Ingestion:** The `IngestionService` converts documents into vector representations and upserts them to Qdrant with deterministic MD5 UUIDs, avoiding point duplication on pipeline reruns.

**Two-Stage Retrieval Pipeline:** The `RetrievalService` implements a modern retrieve-and-rerank architecture. It first queries Qdrant for a broad net of top-20 semantic matches, then passes them through Voyage AI's `rerank-2` cross-encoder to distill down to the 5 most precise context chunks.

**Modular Prompt Engineering:** Three pure-function prompt builders (`system.prompt.ts`, `citation.prompt.ts`, `evaluation.prompt.ts`) handle RAG generation, citation auditing, and LLM-as-judge scoring respectively. Zero NestJS coupling makes them independently testable.
**Streaming Chat Endpoint:** A `POST /chat` endpoint uses Server-Sent Events (SSE) to multiplex the Vercel AI SDK `streamText` response with a trailing structured citations block (via `generateObject`) and includes sliding-window session memory.

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

### 4. Chunking Strategy & Ingestion Workflow
- **Document Isolation (No Merging):** The ingestion pipeline processes documents strictly **file-by-file**. Documents are *never* merged together before chunking. This guarantees that a single chunk will never accidentally contain text from two different Wikipedia articles, preserving strict semantic boundaries and accurate source mapping.
- **Mechanism:** Recursive character text splitting (Fallback hierarchy: End-of-paragraph `\n\n` -> Line `\n` -> Sentence `. ` -> Word -> Char).
- **Sizing:** `500 Characters` size.
- **Overlap:** `100 Characters` (~20%).
- **Rationale:** Preserving semantic boundaries (by heavily preferring natural paragraph and sentence splits over hard cuts) guarantees that concepts stay grouped. The `500/100` combo restricts text to concise factual units for precise semantic matching, while offering enough overlap boundary to not bisect multi-sentence thoughts. Each chunk inherits the metadata of its parent article (`sourceTitle`, `sourceType`), providing the LLM with exact provenance during the retrieval phase.

### 5. Two-Stage Retrieval Workflow (Retrieve → Rerank)
**Why Two-Stage Retrieval?**
Pure vector similarity (Dense Retrieval) is incredibly fast but approximate, as it squashes entire chunks into single points in space. To combat this, we utilize a two-stage retrieval pipeline:
1.  **Retrieve:** We query Qdrant to fetch the *top-20* nearest candidates, casting a wide net to guarantee high **recall**.
2.  **Rerank:** We pass the user's query and those 20 candidates into the `rerank-2` Voyage cross-encoder. The cross-encoder applies deep, explicit attention mechanisms between the query's tokens and each candidate's tokens. It scores them based on true semantic reasoning, surfacing the *top-5* most genuinely relevant chunks.
    **Result:** This dramatically improves precision without sacrificing recall, guaranteeing that the LLM is fed the highest-quality context possible.

### 6. Prompts Strategy
Three dedicated prompt builders live in `src/common/prompts/`:

| File | Role |
|------|------|
| `system.prompt.ts` | Injects retrieved context via XML delimiters, enforces `[Source: Title]` inline citation format, provides two few-shot examples (answerable + refusal), and layers 6 guardrails (context-only, no hallucination, domain scope, prompt injection defense) |
| `citation.prompt.ts` | Acts as a citation auditor — decomposes the answer into atomic claims, maps each to a source chunk, and flags any uncited claims as hallucination signals in an `uncitedClaims[]` array |
| `evaluation.prompt.ts` | LLM-as-judge with three RAGAS-inspired metrics: **Faithfulness** (40%) / **Answer Relevance** (40%) / **Completeness** (20%). Each scored 1–5 with mandatory reasoning. Outputs `overallScore` as a weighted average |

Faithfulness is weighted highest (40%) because hallucination is the most critical failure mode in a production RAG system.

### 7. Chat & Streaming Architecture
- **In-Memory Session Memory:** Follow-up questions are supported by maintaining a strict sliding window of the last 10 messages (`Map<string, ModelMessage[]>`). Older token-heavy context is pruned to keep requests cost-effective.
- **Server-Sent Events (SSE):** We bypass traditional static HTTP responses and use SSE to multiplex two different streams over a single connection. The LLM generative text uses the `event: text` channel (via `streamText`), and immediately after it finishes, an isolated `event: citations` channel delivers a structured JSON citations array (via `generateObject`).

### 8. Evaluation Harness
- **Offline Batch Architecture:** Evaluation runs as a standalone script (`scripts/evaluate.ts`) that bootstraps the NestJS DI context directly. It runs independently of the Fastify HTTP loop.
- **Test Corpus:** 40+ manually crafted test cases (`evaluation/data/test-cases.json`) mapped against the exact AI/ML Wikipedia snapshot. Cases are divided into four specific targets: **Factual**, **Multi-Document** (synthesis), **Follow-up** (tests sliding-window memory using `sessionId` injection), and **Out-of-Scope** (tests hallucination refusal boundaries).
- **Scoring Pipeline:**
  1. **Relevance (1-5):** Derived using LLM-as-a-judge (`buildEvaluationPrompt`) looking exactly at Answer Relevance.
  2. **Groundedness (1-5):** Derived using LLM-as-a-judge mapped to the Faithfulness dimension.
  3. **Citation Accuracy (0-100%):** Programmatic exact-string fuzzy check comparing the generated `[Source: ...]` block output from `generateObject` against the known ground-truth `expectedSourceTitles` array.

---

## 🧪 Running the Evaluation

To execute the offline evaluation sweep (requires Qdrant to be running and collection populated):

```bash
pnpm evaluate
```

This command will:
1. Rebuild the latest NestJS context.
2. Spin up a direct RAG pipeline.
3. Test all 40+ cases sequentially while running LLM-as-judge assessments.
4. Print a live formatting table to standard out.
5. Save a rigid structured JSON report to `evaluation/results/evaluation-results.json`.
