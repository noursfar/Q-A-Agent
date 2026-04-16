# AI Engineer Challenge at Tappz

# Take-Home Challenge

## Build a Document Q&A Agent with RAG and Evaluation

**Timeline:** 1 week
**Submission:** GitHub repo + evaluation report 

---

## Overview

You’re building an **intelligent Q&A agent** that answers questions over a corpus of documents using RAG (Retrieval-Augmented Generation). The agent retrieves relevant context, cites its sources, and maintains conversation history. You’ll also build an evaluation harness to measure answer quality.

---

## Tech Stack

| Layer | Required | Your choice |
| --- | --- | --- |
| Backend framework | **NestJS** with **Fastify** adapter | — |
| LLM integration | **Vercel AI SDK** (`ai`) | — |
| Structured output | **Zod** schemas with AI SDK’s `generateObject` | — |
| Streaming | AI SDK’s `streamText` over Fastify response | — |
| Language | **TypeScript** (strict mode) | — |
| LLM provider | — | Any (OpenAI, Anthropic, OpenRouter, Ollama, Google, etc.) |
| Vector database | — | Any (Pinecone, ChromaDB, Weaviate, Qdrant, pgvector, etc.) |
| Embedding model | — | Any (OpenAI, Cohere, local models, provider built-in, etc.) |
| Frontend | — | Optional — any approach works |

**What’s fixed:** NestJS + Fastify, Vercel AI SDK, Zod, TypeScript.

**What’s your call:** LLM provider, vector database, embedding model. Use whatever you prefer — free or paid. **Document your choices and reasoning in your README.**

---

## Requirements

### 1. Document Ingestion

- Pick a corpus: 30–50 Wikipedia articles on a coherent topic, a public dataset, or synthetic documents with verifiable facts
- Build a processing pipeline that chunks documents, generates embeddings, and upserts vectors with metadata (`sourceTitle`, `sourceType`, `chunkIndex`, `text`)
- Include a runnable script: `pnpm ingest`

### 2. RAG Chat Endpoint

- `POST /chat` — accepts `{ message, sessionId }`, streams the response via `FastifyReply`
- Retrieve relevant chunks from the vector DB, inject them as context, and generate a streamed answer using `streamText`
- The model must produce **inline citations** (e.g., `[1]`, `[2]`) referencing sources
- After the streamed response, return a structured **citations block** via `generateObject`:

```tsx
const CitationSchema = z.object({
  citations: z.array(z.object({
    id: z.number(),
    sourceTitle: z.string(),
    excerpt: z.string(),
  })),
});
```

### 3. Conversation Memory

- Maintain conversation history per session (in-memory is fine)
- Sliding window of the last 10 messages
- Use conversation context to handle follow-up questions properly (e.g., “What about its economy?” should work after asking about a country)

### 4. Prompt Engineering

- Design a system prompt with: role definition, citation format with few-shot examples, guardrails for no-result / out-of-scope / ambiguous cases, and dynamic parameters (collection name, user name) injected at runtime
- Store prompts in a `prompts/` directory, not inline in service code

### 5. Evaluation Harness

Build a standalone script (`pnpm evaluate`) that measures your pipeline:

- Define **at least 10 test cases** in a JSON file — mix of simple factual, multi-document, follow-up, and out-of-scope questions
- Score each response on:
    - **Relevance** — does it answer the question? (LLM-as-judge, 1–5)
    - **Groundedness** — is it supported by retrieved context only? (LLM-as-judge, 1–5)
    - **Citation accuracy** — are citations present and correct? (programmatic check)
- Output a results table and save to JSON

---

## Bonus (Not Required)

Pick any if time allows — these are where strong candidates stand out:

- **Re-ranking:** two-stage retrieval (broad fetch → LLM or heuristic re-rank to top-K)
- **Tool use:** give the agent tools via the AI SDK (e.g., `searchDocuments`, `getDocumentSummary`) and let it decide when to use them
- **Query rewriting:** rewrite the user’s query using conversation context before retrieval
- **Chat UI:** a simple frontend using `@ai-sdk/react`’s `useChat` hook with citations displayed
- **Hybrid search:** combine vector similarity with keyword/BM25 filtering

---

## What We Evaluate

| Area | What we look for |
| --- | --- |
| **RAG architecture** | Retrieval quality, chunking decisions, namespace/collection design |
| **AI SDK proficiency** | Correct use of `streamText`, `generateObject`, tool definitions if used |
| **Prompt engineering** | Well-structured, parameterized, handles edge cases, few-shot examples |
| **Structured output** | Robust Zod schemas, graceful handling of malformed LLM output |
| **Evaluation** | Thoughtful test cases, meaningful metrics, reproducible harness |
| **Streaming** | Correct implementation, error handling mid-stream |
| **Code architecture** | Clean separation of retrieval / generation / evaluation / prompts |
| **Technical choices** | Reasoning behind provider/DB/model selections, awareness of trade-offs |
| **Documentation** | Clear README with architecture rationale, prompt reasoning, eval analysis |

---

## Submission

- [ ]  GitHub repository
- [ ]  README with: setup instructions, architecture overview, **why you chose your LLM/vector DB/embedding model**, chunking rationale, prompt design reasoning, evaluation results analysis
- [ ]  Runnable `pnpm ingest` and `pnpm evaluate` scripts
- [ ]  Evaluation results JSON committed to the repo
