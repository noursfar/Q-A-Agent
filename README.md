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

7. **Install Frontend Dependencies**
   ```bash
   cd ui && pnpm install
   ```

8. **Start the Frontend Dev Server**
   ```bash
   cd ui && pnpm dev
   ```
   The Vite dev server proxies `/chat` requests to `localhost:3000` (the NestJS backend).

---

## 🏗️ Architecture Overview

**Framework:** NestJS wrapped with the high-performance **FastifyAdapter**.

**Type Safety & Configuration:** `@nestjs/config` combined with Zod schema validation ensures the application fails-fast on startup if the environment variables are misconfigured.

**Logging System:** A global **Winston** structured logger (`nest-winston`) outputs colored, human-readable logs in development (`nestLike`) and machine-parseable JSON logs in production.

**Agnostic LLM Configuration:** Provider interactions pass through a factory (`src/common/utils/llm-provider.factory.ts`), generating isolated `LanguageModel` instances. This strictly decouples the application code from specific underlying Generative AI APIs.

**Idempotent Ingestion:** The `IngestionService` converts documents into vector representations and upserts them to Qdrant with deterministic MD5 UUIDs, avoiding point duplication on pipeline reruns.

**Two-Stage Retrieval Pipeline:** The `RetrievalService` implements a modern retrieve-and-rerank architecture. It first queries Qdrant for a broad net of top-20 semantic matches, then passes them through Voyage AI's `rerank-2` cross-encoder to distill down to the 5 most precise context chunks.

**Modular Prompt Engineering:** Three pure-function prompt builders (`system.prompt.ts`, `citation.prompt.ts`, `evaluation.prompt.ts`) handle RAG generation, citation auditing, and LLM-as-judge scoring respectively. Zero NestJS coupling makes them independently testable.

**Streaming Chat Endpoint (UI Message Stream Protocol):** A `POST /chat` endpoint uses the AI SDK's `createUIMessageStream` to create a structured message stream. Text generation is merged via `writer.merge(streamResult.toUIMessageStream())`, and after the stream completes, citations are appended as a typed `data-citations` part. The response is piped to Fastify via `pipeUIMessageStreamToResponse`. The frontend consumes this stream through `@ai-sdk/react`'s `useChat` hook, which handles streaming, message state, and optimistic UI updates automatically.

**Frontend:** A React 19 single-page application built with Vite and Tailwind CSS v4. The UI uses `@ai-sdk/react`'s `useChat` hook with a `DefaultChatTransport` for seamless streaming consumption. Key components include `ChatLayout` (state orchestrator), `MessageBubble` (rendering with inline citation extraction), `SourcesPanel` (side-by-side citation details drawer), `MarkdownRenderer` (rich text with clickable citation badges), and `ConversationSidebar` (multi-session management with localStorage persistence).

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
- **UI Message Stream Protocol:** The backend uses `createUIMessageStream` from the AI SDK to create a structured message stream. The `ChatService.chat()` method returns a two-phased result: a live `streamResult` for immediate text streaming, and a lazy `getCitations()` callback that generates the structured citation block after the stream completes. The controller merges the text stream via `writer.merge(streamResult.toUIMessageStream())` and appends citations as a typed `data-citations` part — all over a single HTTP response piped via `pipeUIMessageStreamToResponse`.
- **Frontend Consumption:** The React frontend uses `useChat` from `@ai-sdk/react` with a `DefaultChatTransport` that intercepts message preparation to send only `{ message, sessionId }` to the backend, keeping the API surface minimal. The SDK handles streaming text rendering, message state management, and optimistic UI updates. Citation data arrives as a `data-citations` part in the message, which `MessageBubble` extracts and renders as clickable inline badges and a bottom source bar.

### 8. Frontend Architecture
- **Stack:** React 19, Vite, Tailwind CSS v4, `@ai-sdk/react`, `react-markdown`, `remark-gfm`
- **Dev Proxy:** Vite proxies `/chat` to `localhost:3000` for local development (`vite.config.ts`)
- **Component Tree:** `ChatLayout` → `TopBar` + `ConversationSidebar` + `MessageList` → `MessageBubble` → `MarkdownRenderer` + `CitationPopover` | `SourcesPanel`
- **Session Management:** Multi-conversation support via `useSessionManager` hook backed by `localStorage`. Each session has its own `useChat` instance keyed by `activeSessionId`.
- **Citation UX:** Inline numbered badges (①②③) are clickable — they open a side-by-side `SourcesPanel` drawer showing source title, chunk index, and the exact cited claim. The panel squeezes the chat area on desktop (no overlay) and supports click-away closing.
- **Branding:** The UI is branded as **TAP-Q — Document Intelligence** with a consistent teal (`#14B8A6`) accent color across the TopBar, EmptyState, message avatars, and the "New chat" button.

### 9. Evaluation Harness

#### 9.1 Architecture

The evaluation harness runs as a **standalone offline script** (`scripts/evaluate.ts`) triggered by `pnpm evaluate`. Rather than making HTTP calls to the running server, it bootstraps the full NestJS dependency injection context directly via `NestFactory.createApplicationContext`, giving it access to the same `RetrievalService`, `ConfigService`, and LLM factory that the production pipeline uses. This eliminates network variability and guarantees that evaluation measures the core RAG logic in isolation from HTTP/streaming transport concerns.

#### 9.2 Test Case Design

The test suite (`evaluation/data/test-cases.json`) contains **40 manually authored test cases** divided across four categories, each targeting a different capability of the RAG pipeline:

| Category | Count | What It Tests |
|----------|-------|---------------|
| **Factual** | 15 | Single-source fact retrieval — can the system find and cite the right article for a direct question? |
| **Multi-Document** | 10 | Cross-source synthesis — can the system pull context from 2–4 different articles and produce a coherent, multi-cited answer? |
| **Follow-up** | 8 | Conversation memory — do pairs of questions sharing a `sessionId` correctly resolve pronouns and anaphoric references (e.g., *"Was it used to train AlphaGo?"* after defining Reinforcement Learning)? |
| **Out-of-Scope** | 7 | Hallucination refusal — does the system correctly decline questions outside its AI/ML domain (e.g., *"How do you bake a chocolate cake?"*) without fabricating citations? |

**`expectedSourceTitles` design:** Each non-refusal test case lists **all corpus articles that could validly answer the question**, not just the single most obvious one. For example, *"Who created the Claude language model series?"* accepts both `"Claude (language model)"` and `"Anthropic"` — because both articles contain the answer. This prevents false negatives when the RAG system retrieves an equally correct but different article across runs.

**`shouldRefuse` flag:** Out-of-scope cases use an explicit boolean flag rather than inferring refusal from empty `expectedSourceTitles`, cleanly separating "we don't know which sources to expect" from "the system should produce zero citations."

#### 9.3 Metrics & Rationale

The harness scores every response on three complementary metrics, each chosen to measure a distinct failure mode:

**1. Relevance (LLM-as-judge, 1–5)**

*What it measures:* Does the answer actually address what the user asked?

*Why this metric:* A RAG system can retrieve perfect context and cite it flawlessly, yet still produce an answer that misses the user's intent (e.g., answering "what is X?" when asked "who invented X?"). Relevance catches this failure mode. The 1–5 Likert scale (with mandatory reasoning) gives granularity beyond pass/fail — a partially relevant answer scores 3, not 0.

*Implementation:* `buildEvaluationPrompt` instructs the LLM judge to evaluate Answer Relevance as one of three RAGAS-inspired dimensions, mapped to `answerRelevance.score` in the structured output.

**2. Groundedness (LLM-as-judge, 1–5)**

*What it measures:* Is every claim in the answer supported by the retrieved context, or did the LLM hallucinate from its training data?

*Why this metric:* **Hallucination is the most critical failure mode in production RAG.** A user trusts that cited answers come from real documents — if the system invents facts while appearing grounded, it's worse than saying "I don't know." This is why Faithfulness carries 40% weight in the overall score (tied with Relevance, ahead of Completeness at 20%).

*Implementation:* The judge LLM receives the full retrieved context chunks alongside the generated answer and scores whether each claim traces back to a specific chunk. The `faithfulness.reasoning` field provides an auditable explanation.

**3. Citation Accuracy (programmatic, 0.0–1.0)**

*What it measures:* Are the cited source titles correct, and are all expected sources covered?

*Why this metric:* Unlike relevance and groundedness (which require LLM judgment), citation accuracy is **deterministically verifiable** — we know exactly which articles exist in the corpus, and we can programmatically check whether the system cited the right ones. This provides a hard, reproducible signal that doesn't depend on LLM judge consistency.

*Why precision + recall (not just recall):*
- **Recall alone** would reward a system that cites every article in the corpus — it would always score 100%.
- **Precision alone** would reward a system that cites just one correct source and ignores the rest.
- The **balanced average** (similar to F1-score) `(precision + recall) / 2` penalizes both missing citations *and* spurious/wrong citations, giving a fair measure of citation quality.

*Dual-layer citation verification:*
The harness extracts citations from two independent sources:
1. **Inline parsing** — Regex extraction of `[Source: Title]` markers from the raw answer text (`inlineCitedSources`)
2. **Structured block** — A separate `generateObject` call using `CitationSchema` that decomposes the answer into atomic claims and maps each to a source (`citedSources`), plus flags unattributed claims as hallucination signals (`uncitedClaims`)

The structured block is the **authoritative source for accuracy scoring**, because it mirrors exactly what the production `ChatService.generateCitations()` returns to the client. The inline parsing serves as a secondary cross-check.

#### 9.4 Reproducibility

The harness is designed to produce consistent, auditable results:

- **Fixed test corpus:** All 40 cases are committed to version control in `evaluation/data/test-cases.json` — no random generation.
- **Identical services:** The script bootstraps the same NestJS DI context as the production app, ensuring `RetrievalService`, embedding models, and reranker configuration are identical.
- **Deterministic IDs:** The ingestion pipeline uses MD5-based deterministic UUIDs, so the same corpus always produces the same Qdrant collection state.
- **Saved results:** Every run writes a timestamped JSON report to `evaluation/results/evaluation-results.json` with full per-case details (answer text, scores, reasoning, retrieved sources, cited sources, uncited claims, duration).
- **Single command:** `pnpm evaluate` rebuilds the TypeScript project and runs the full sweep — no manual steps required.

---

## 🧪 Running the Evaluation

To execute the offline evaluation sweep (requires Qdrant to be running and collection populated):

```bash
pnpm evaluate
```

This command will:
1. Rebuild the latest NestJS context via `nest build`.
2. Bootstrap the DI container and resolve `RetrievalService` + LLM model.
3. Run all 40 test cases sequentially — for each: retrieve → generate → extract citations → LLM-as-judge → programmatic scoring.
4. Print a live results table to stdout with per-case and per-category averages.
5. Save the full structured JSON report to `evaluation/results/evaluation-results.json`.

### Evaluation Results Analysis

Latest run results (40/40 cases successful, 0 failures):

| Category | Cases | Relevance | Groundedness | Citation Accuracy |
|----------|-------|-----------|--------------|-------------------|
| **Factual** | 15 | 5.00 / 5 | 4.87 / 5 | 68.3% |
| **Multi-Document** | 10 | 5.00 / 5 | 4.40 / 5 | 68.5% |
| **Follow-up** | 8 | 5.00 / 5 | 4.88 / 5 | 41.2% |
| **Out-of-Scope** | 7 | 5.00 / 5 | 5.00 / 5 | 100.0% |
| **Overall** | **40** | **5.00 / 5** | **4.78 / 5** | **68.5%** |

#### Key Observations

**Relevance (5.00/5 overall):** The system achieves a perfect relevance score across all categories. The combination of two-stage retrieval (broad vector search → cross-encoder reranking) and a tightly scoped system prompt ensures that answers consistently address the user's actual question.

**Groundedness (4.78/5 overall):** Near-ceiling faithfulness scores confirm that the system rarely hallucinates. The slight dip in multi-document questions (4.40) is expected — synthesizing information across multiple articles introduces more opportunity for the LLM to subtly paraphrase or generalize beyond what any single chunk explicitly states. Factual (4.87) and follow-up (4.88) questions, which typically draw from 1–2 focused chunks, remain highly grounded.

**Out-of-scope (5.00 / 5.00 / 100%):** The system perfectly refuses all 7 off-topic questions without fabricating citations. This validates the system prompt's domain-scoping guardrails and the "insufficient context" refusal instruction.

**Citation accuracy — the honest gap (68.5% overall):** This is the weakest metric and the most informative. The gap comes from two sources:
1. **Precision loss:** The LLM sometimes cites the same source article multiple times for different claims but occasionally also cites articles that aren't in the expected set (e.g., citing "Recurrent neural network" for a transformer question — tangentially related but not in the expected list).
2. **Recall loss on follow-ups (41.2%):** Follow-up questions are the hardest for citation accuracy because the pronoun-resolved query (e.g., *"Why are GPUs important?"* after discussing NVIDIA) may retrieve different context chunks than the original question. The system sometimes correctly refuses with "I don't have sufficient information" — which scores 0% citation accuracy but 5/5 groundedness, because refusing is the honest thing to do when context is insufficient.

**Overall takeaway:** The pipeline excels at answering questions accurately and honestly (relevance + groundedness), with room for improvement in citation precision — particularly for follow-up scenarios where retrieval context shifts between turns.
