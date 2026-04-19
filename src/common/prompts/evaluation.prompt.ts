import { RerankResult } from '../../modules/retrieval/dto/retrieval.dto.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single scored evaluation metric with mandatory reasoning.
 */
export interface MetricScore {
  score: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
}

/**
 * The full structured output produced by the evaluation prompt.
 * Mirrors the RAGAS evaluation dimensions.
 */
export interface EvaluationResult {
  faithfulness: MetricScore; // Are all claims grounded in the provided context?
  answerRelevance: MetricScore; // Does the answer directly address the question?
  completeness: MetricScore; // Did the answer use all relevant information from context?
  overallScore: number; // Weighted average: faithfulness(40%) + relevance(40%) + completeness(20%)
}

// ─── Context Formatter ────────────────────────────────────────────────────────

function formatContextForJudge(chunks: RerankResult[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: "${c.sourceTitle}" | Chunk: ${c.chunkIndex} | Relevance: ${c.relevanceScore.toFixed(3)}\n` +
        `    ${c.text.replace(/\n/g, '\n    ')}`,
    )
    .join('\n\n');
}

// ─── Evaluation Prompt Builder ────────────────────────────────────────────────

/**
 * Builds an LLM-as-judge evaluation prompt that scores a RAG answer
 * across three RAGAS-inspired dimensions:
 *
 *   1. Faithfulness   — Are claims grounded in context? (hallucination check)
 *   2. Answer Relevance — Does the answer address the user's actual question?
 *   3. Completeness   — Did the answer leverage all relevant available context?
 *
 * Each dimension is scored 1–5 with a mandatory reasoning field.
 * An overallScore (weighted average) is also computed by the judge.
 *
 * Weights: faithfulness 40% + answerRelevance 40% + completeness 20%
 * (Faithfulness is weighted highest because hallucinations are the most critical failure mode.)
 */
export function buildEvaluationPrompt(
  query: string,
  answer: string,
  context: RerankResult[],
): string {
  const contextBlock = formatContextForJudge(context);

  return `You are an impartial, expert AI evaluation judge. Your task is to rigorously assess the quality of an AI-generated answer in a RAG (Retrieval-Augmented Generation) system across three critical dimensions.

══════════════════════════════════════════════════════
EVALUATION DIMENSIONS
══════════════════════════════════════════════════════

You will score the answer on the following three metrics (1 = worst, 5 = best):

┌─────────────────────────────────────────────────────────────────────┐
│ METRIC 1: FAITHFULNESS (Weight: 40%)                                │
│                                                                     │
│ Definition: Are ALL factual claims in the answer directly           │
│ supported by the provided context? A faithful answer contains       │
│ zero fabricated facts — even if those facts are true in the         │
│ real world, they must be present in the context to count.           │
│                                                                     │
│ 1 — Most claims are fabricated or contradict the context            │
│ 2 — Several unsupported claims; significant hallucination           │
│ 3 — Mostly grounded with 1–2 unsupported claims                     │
│ 4 — Fully grounded with minor imprecisions                          │
│ 5 — Every claim is directly traceable to the provided context       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ METRIC 2: ANSWER RELEVANCE (Weight: 40%)                            │
│                                                                     │
│ Definition: Does the answer directly and completely address         │
│ what the user actually asked? A relevant answer is on-topic,        │
│ does not go on unnecessary tangents, and satisfies the user's       │
│ actual intent.                                                      │
│                                                                     │
│ 1 — Completely off-topic or does not address the question           │
│ 2 — Tangentially related but misses the core question               │
│ 3 — Partially relevant; addresses some but not all aspects          │
│ 4 — Mostly relevant with minor off-topic content                    │
│ 5 — Precisely and completely addresses the user's question          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ METRIC 3: COMPLETENESS (Weight: 20%)                                │
│                                                                     │
│ Definition: Did the answer leverage all the relevant information    │
│ available in the provided context? A complete answer does not       │
│ leave important facts unused when they would improve the response.  │
│                                                                     │
│ 1 — Ignores most relevant context; extremely sparse                 │
│ 2 — Uses little of the available relevant context                   │
│ 3 — Uses some context but misses several important details          │
│ 4 — Uses most relevant context; minor omissions                     │
│ 5 — Fully synthesizes all relevant context into a cohesive answer   │
└─────────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════
SCORING RULES
══════════════════════════════════════════════════════

1. REASONING FIRST: For each metric, write your reasoning BEFORE assigning your score. You must justify every score — do not assign a score without explanation.

2. BE STRICT ON FAITHFULNESS: When in doubt about whether a claim is supported, score it as unsupported. The cost of hallucination is high.

3. JUDGE THE ANSWER, NOT THE CONTEXT: Even if the context is poor, evaluate the answer for what it does with the context it was given.

4. OVERALL SCORE FORMULA: Compute as follows (rounded to 2 decimal places):
   overallScore = (faithfulness.score × 0.40) + (answerRelevance.score × 0.40) + (completeness.score × 0.20)

5. RESPOND WITH VALID JSON ONLY. No preamble, no markdown code fences, no text outside the JSON object.

══════════════════════════════════════════════════════
OUTPUT FORMAT (strict JSON)
══════════════════════════════════════════════════════

{
  "faithfulness": {
    "score": <1|2|3|4|5>,
    "reasoning": "<Your detailed reasoning for this score>"
  },
  "answerRelevance": {
    "score": <1|2|3|4|5>,
    "reasoning": "<Your detailed reasoning for this score>"
  },
  "completeness": {
    "score": <1|2|3|4|5>,
    "reasoning": "<Your detailed reasoning for this score>"
  },
  "overallScore": <weighted average, e.g. 4.20>
}

══════════════════════════════════════════════════════
FEW-SHOT EXAMPLE
══════════════════════════════════════════════════════

User Question: "What is reinforcement learning?"

Context Provided:
  [1] Source: "Reinforcement learning" | Chunk: 0
      Reinforcement learning (RL) is an area of machine learning where an agent learns
      to make decisions by interacting with an environment to maximize a reward signal.

Generated Answer:
  "Reinforcement learning is a machine learning paradigm where an agent learns
   through trial and error to maximize rewards [Source: Reinforcement learning].
   It was first developed at MIT in the 1950s and is widely used in game playing."

Correct Evaluation:
{
  "faithfulness": {
    "score": 2,
    "reasoning": "The claim that RL 'maximizes rewards' is supported. However, 'first developed at MIT in the 1950s' and 'widely used in game playing' are not present in the provided context and appear to be fabricated or drawn from internal knowledge."
  },
  "answerRelevance": {
    "score": 4,
    "reasoning": "The answer directly addresses the definition of RL, which is what was asked. The off-topic historical claim slightly reduces relevance."
  },
  "completeness": {
    "score": 3,
    "reasoning": "The answer captures the core definition but doesn't include the detail about 'interacting with an environment' from the context."
  },
  "overallScore": 2.80
}

══════════════════════════════════════════════════════
INPUTS TO EVALUATE
══════════════════════════════════════════════════════

USER QUESTION:
${query}

RETRIEVED CONTEXT:
${contextBlock}

GENERATED ANSWER:
${answer}

══════════════════════════════════════════════════════

Now perform your evaluation. Respond with valid JSON only:`;
}
