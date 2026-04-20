import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { generateText, generateObject } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

import { AppModule } from '../src/app.module.js';
import { RetrievalService } from '../src/modules/retrieval/retrieval.service.js';
import type { RerankResult } from '../src/modules/retrieval/dto/retrieval.dto.js';
import { buildSystemPrompt } from '../src/common/prompts/system.prompt.js';
import { buildCitationPrompt } from '../src/common/prompts/citation.prompt.js';
import { buildEvaluationPrompt } from '../src/common/prompts/evaluation.prompt.js';
import { createLlmModel } from '../src/common/utils/llm-provider.factory.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  category: 'factual' | 'multi-doc' | 'followup' | 'out-of-scope';
  question: string;
  expectedSourceTitles?: string[];
  sessionId?: string;
}

interface TestResult {
  id: string;
  category: string;
  question: string;
  answer: string;
  relevanceScore: number; // LLM-as-judge: answerRelevance 1–5
  groundednessScore: number; // LLM-as-judge: faithfulness 1–5
  citationAccuracy: number; // Programmatic: 0.0–1.0
  evalReasoning: {
    relevance: string;
    groundedness: string;
  };
  retrievedSources: string[];
  citedSources: string[];
  durationMs: number;
  error?: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

/**
 * Zod schema for parsing the LLM-as-judge output from buildEvaluationPrompt.
 * Maps to the EvaluationResult interface in evaluation.prompt.ts.
 */
const EvaluationSchema = z.object({
  faithfulness: z.object({
    score: z.number().int().min(1).max(5),
    reasoning: z.string(),
  }),
  answerRelevance: z.object({
    score: z.number().int().min(1).max(5),
    reasoning: z.string(),
  }),
  completeness: z.object({
    score: z.number().int().min(1).max(5),
    reasoning: z.string(),
  }),
  overallScore: z.number(),
});

/**
 * Zod schema for the structured citation extraction block.
 * Matches CitationSchema in chat.dto.ts but standalone for this script.
 */
const CitationExtractSchema = z.object({
  citations: z.array(
    z.object({
      claim: z.string(),
      sourceTitle: z.string(),
      chunkIndex: z.number(),
    }),
  ),
  uncitedClaims: z.array(z.string()),
});

// ─── Citation Accuracy ────────────────────────────────────────────────────────

/**
 * Programmatic citation accuracy check per PROJECT_GOAL.md §5.
 *
 * For factual / multi-doc: measures overlap between cited source titles
 * and expected source titles (fuzzy substring match).
 *
 * For out-of-scope: a correct behavior is citing NOTHING — the agent
 * should have declined to answer. So zero citations = 1.0 accuracy.
 */
function computeCitationAccuracy(
  citedSources: string[],
  expectedSources: string[] | undefined,
  category: string,
): number {
  const isOutOfScope =
    category === 'out-of-scope' ||
    !expectedSources ||
    expectedSources.length === 0;

  if (isOutOfScope) {
    // Correct behavior = no citations made
    return citedSources.length === 0 ? 1.0 : 0.0;
  }

  if (citedSources.length === 0) return 0.0;

  // Fuzzy match: check if each expected title appears (as substring) in any cited title
  const matched = expectedSources.filter((expected) =>
    citedSources.some(
      (cited) =>
        cited.toLowerCase().includes(expected.toLowerCase().slice(0, 25)) ||
        expected.toLowerCase().includes(cited.toLowerCase().slice(0, 25)),
    ),
  ).length;

  return Math.min(matched / expectedSources.length, 1.0);
}

// ─── Output Formatting ────────────────────────────────────────────────────────

function printResultsTable(results: TestResult[]): void {
  const W = 110;
  const line = '═'.repeat(W);
  const thin = '─'.repeat(W);

  console.log(`\n${line}`);
  console.log('  📊 EVALUATION RESULTS');
  console.log(line);

  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

  const header = `  ${pad('ID', 22)} │ ${pad('Category', 12)} │ ${pad('Relevance', 9)} │ ${pad('Groundedness', 12)} │ ${pad('Citation Acc', 12)} │ Duration`;
  console.log(header);
  console.log(thin);

  for (const r of results) {
    const status = r.error ? '❌' : '✓';
    const row = `  ${status} ${pad(r.id, 20)} │ ${pad(r.category, 12)} │ ${pad(`${r.relevanceScore}/5`, 9)} │ ${pad(`${r.groundednessScore}/5`, 12)} │ ${pad(`${(r.citationAccuracy * 100).toFixed(0)}%`, 12)} │ ${r.durationMs}ms`;
    console.log(row);
  }

  console.log(line);
  console.log('\n  AVERAGES BY CATEGORY\n');

  const categories: Array<TestCase['category']> = [
    'factual',
    'multi-doc',
    'followup',
    'out-of-scope',
  ];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat && !r.error);
    if (catResults.length === 0) continue;

    const avgR = (
      catResults.reduce((s, r) => s + r.relevanceScore, 0) / catResults.length
    ).toFixed(2);
    const avgG = (
      catResults.reduce((s, r) => s + r.groundednessScore, 0) /
      catResults.length
    ).toFixed(2);
    const avgC = (
      (catResults.reduce((s, r) => s + r.citationAccuracy, 0) /
        catResults.length) *
      100
    ).toFixed(1);
    console.log(
      `  ${cat.padEnd(14)} → Relevance: ${avgR}/5  │  Groundedness: ${avgG}/5  │  Citation Acc: ${avgC}%`,
    );
  }

  const valid = results.filter((r) => !r.error);
  const oR = (
    valid.reduce((s, r) => s + r.relevanceScore, 0) / valid.length
  ).toFixed(2);
  const oG = (
    valid.reduce((s, r) => s + r.groundednessScore, 0) / valid.length
  ).toFixed(2);
  const oC = (
    (valid.reduce((s, r) => s + r.citationAccuracy, 0) / valid.length) *
    100
  ).toFixed(1);
  console.log(
    `\n  ${'OVERALL'.padEnd(14)} → Relevance: ${oR}/5  │  Groundedness: ${oG}/5  │  Citation Acc: ${oC}%`,
  );
  console.log(line);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function bootstrap() {
  console.log('\n🧪 Bootstrapping NestJS context for Evaluation...\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const retrievalService = app.get(RetrievalService);

  // Create LLM model directly from factory (not via DI, since LLM_MODEL is scoped to ChatModule)
  const model = createLlmModel(configService);

  // ── Load test cases ──────────────────────────────────────────────────────────
  const testCasesPath = path.resolve(
    'evaluation/data/test-cases.json',
  );
  if (!fs.existsSync(testCasesPath)) {
    console.error(`❌ Test cases file not found: ${testCasesPath}`);
    process.exit(1);
  }
  const testCases: TestCase[] = JSON.parse(
    fs.readFileSync(testCasesPath, 'utf-8'),
  );
  console.log(`📋 Loaded ${testCases.length} test cases.\n`);

  // ── Session memory for follow-up questions ───────────────────────────────────
  // Follow-up test cases share a sessionId so the agent sees prior conversation context.
  const sessionHistory = new Map<string, ModelMessage[]>();

  // ── Run each test case ───────────────────────────────────────────────────────
  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const progressLabel = `[${i + 1}/${testCases.length}] ${tc.id}`;
    console.log(`  ⏳ ${progressLabel} — "${tc.question.slice(0, 60)}..."`);

    const startMs = Date.now();

    try {
      // ── Stage 1: Retrieve context ──────────────────────────────────────────
      const context: RerankResult[] = await retrievalService.retrieve(
        tc.question,
      );
      const retrievedSources = [...new Set(context.map((c) => c.sourceTitle))];

      // ── Stage 2: Generate answer (generateText, not streamText) ───────────
      const systemPrompt = buildSystemPrompt(context, tc.question);
      const history: ModelMessage[] = tc.sessionId
        ? (sessionHistory.get(tc.sessionId) ?? [])
        : [];

      const userMessage: ModelMessage = { role: 'user', content: tc.question };

      const { text: answer } = await generateText({
        model,
        system: systemPrompt,
        messages: [...history, userMessage],
      });

      // Persist to session history if this is a follow-up scenario
      if (tc.sessionId) {
        const updated = [
          ...history,
          userMessage,
          { role: 'assistant' as const, content: answer },
        ];
        // Sliding window: keep last 10
        sessionHistory.set(tc.sessionId, updated.slice(-10));
      }

      // ── Stage 3: Citation extraction (structured, via generateObject) ──────
      const citationPrompt = buildCitationPrompt(answer, context);
      const { object: citationObj } = await generateObject({
        model,
        schema: CitationExtractSchema,
        prompt: citationPrompt,
      });
      const citedSources = citationObj.citations.map((c) => c.sourceTitle);

      // ── Stage 4: LLM-as-Judge (reuse buildEvaluationPrompt from Phase 4) ──
      const evalPrompt = buildEvaluationPrompt(tc.question, answer, context);
      const { object: evalResult } = await generateObject({
        model,
        schema: EvaluationSchema,
        prompt: evalPrompt,
      });

      // ── Stage 5: Programmatic citation accuracy ────────────────────────────
      const citationAccuracy = computeCitationAccuracy(
        citedSources,
        tc.expectedSourceTitles,
        tc.category,
      );

      const durationMs = Date.now() - startMs;

      const result: TestResult = {
        id: tc.id,
        category: tc.category,
        question: tc.question,
        answer,
        relevanceScore: evalResult.answerRelevance.score,
        groundednessScore: evalResult.faithfulness.score,
        citationAccuracy,
        evalReasoning: {
          relevance: evalResult.answerRelevance.reasoning,
          groundedness: evalResult.faithfulness.reasoning,
        },
        retrievedSources,
        citedSources,
        durationMs,
      };

      results.push(result);
      console.log(
        `  ✅ ${progressLabel} — Relevance: ${result.relevanceScore}/5  Groundedness: ${result.groundednessScore}/5  Citations: ${(citationAccuracy * 100).toFixed(0)}%  (${durationMs}ms)\n`,
      );
    } catch (err) {
      const durationMs = Date.now() - startMs;
      console.error(`  ❌ ${progressLabel} — FAILED: ${String(err)}\n`);
      results.push({
        id: tc.id,
        category: tc.category,
        question: tc.question,
        answer: '',
        relevanceScore: 0,
        groundednessScore: 0,
        citationAccuracy: 0,
        evalReasoning: { relevance: '', groundedness: '' },
        retrievedSources: [],
        citedSources: [],
        durationMs,
        error: String(err),
      });
    }
  }

  // ── Print results table ──────────────────────────────────────────────────────
  printResultsTable(results);

  // ── Save results JSON ────────────────────────────────────────────────────────
  const validResults = results.filter((r) => !r.error);
  const outputDir = path.resolve('evaluation/results');
  const outputPath = path.join(outputDir, 'evaluation-results.json');

  fs.mkdirSync(outputDir, { recursive: true });

  const output = {
    timestamp: new Date().toISOString(),
    totalCases: testCases.length,
    successfulCases: validResults.length,
    failedCases: results.filter((r) => r.error).length,
    aggregates: {
      overall: {
        relevance: Number(
          (
            validResults.reduce((s, r) => s + r.relevanceScore, 0) /
            validResults.length
          ).toFixed(2),
        ),
        groundedness: Number(
          (
            validResults.reduce((s, r) => s + r.groundednessScore, 0) /
            validResults.length
          ).toFixed(2),
        ),
        citationAccuracy: Number(
          (
            validResults.reduce((s, r) => s + r.citationAccuracy, 0) /
            validResults.length
          ).toFixed(4),
        ),
      },
      byCategory: Object.fromEntries(
        (['factual', 'multi-doc', 'followup', 'out-of-scope'] as const).map(
          (cat) => {
            const catR = validResults.filter((r) => r.category === cat);
            return [
              cat,
              catR.length === 0
                ? null
                : {
                    count: catR.length,
                    relevance: Number(
                      (
                        catR.reduce((s, r) => s + r.relevanceScore, 0) /
                        catR.length
                      ).toFixed(2),
                    ),
                    groundedness: Number(
                      (
                        catR.reduce((s, r) => s + r.groundednessScore, 0) /
                        catR.length
                      ).toFixed(2),
                    ),
                    citationAccuracy: Number(
                      (
                        catR.reduce((s, r) => s + r.citationAccuracy, 0) /
                        catR.length
                      ).toFixed(4),
                    ),
                  },
            ];
          },
        ),
      ),
    },
    results,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}\n`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
