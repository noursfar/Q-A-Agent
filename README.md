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

---

*Note: Prompt Engineering strategies and Evaluation Results will be populated in Phase 4.*
