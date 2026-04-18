import fs from 'fs';
import path from 'path';

// ─── Article list ─────────────────────────────────────────────────────────────

const AI_ARTICLES = [
  // AI Foundations
  'Artificial intelligence',
  'Machine learning',
  'Deep learning',
  'Neural network (machine learning)',
  'Natural language processing',
  'Transformer (machine learning model)',
  'Large language model',
  'Reinforcement learning',

  // Landmark Models & Systems
  'GPT-4',
  'ChatGPT',
  'BERT (language model)',
  'AlphaGo',
  'DALL-E',
  'Gemini (language model)',
  'Claude (language model)',
  'Llama (language model)',

  // Key Companies
  'OpenAI',
  'Anthropic',
  'Google DeepMind',
  'Meta AI',
  'Hugging Face',
  'NVIDIA',
  'Microsoft Azure',

  // Core Techniques & Concepts
  'Retrieval-augmented generation',
  'Prompt engineering',
  'Fine-tuning (deep learning)',
  'Attention mechanism',
  'Generative adversarial network',
  'Convolutional neural network',
  'Recurrent neural network',
  'Word2vec',
  'Embedding (machine learning)',

  // AI Ethics & Society
  'AI safety',
  'Algorithmic bias',
  'Hallucination (artificial intelligence)',
  'AI alignment',
  'Existential risk from artificial general intelligence',

  // Infrastructure & Tools
  'TensorFlow',
  'PyTorch',
  'Hugging Face',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WikiApiResponse {
  query: {
    pages: Record<
      string,
      {
        title: string;
        extract?: string;
        missing?: string;
      }
    >;
  };
}

interface RawArticle {
  title: string;
  sourceType: 'wikipedia';
  fetchedAt: string;
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArticle(title: string): Promise<string | null> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('titles', title);
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('explaintext', 'true');
  url.searchParams.set('redirects', '1'); // follow redirects automatically

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Q-A-Agent/1.0 (educational project)' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for "${title}"`);
  }

  const data = (await res.json()) as WikiApiResponse;
  const pages = data.query.pages;
  const page = Object.values(pages)[0];

  if ('missing' in page || !page.extract || page.extract.trim().length === 0) {
    return null;
  }

  return page.extract.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outputDir = path.resolve('data/raw');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n📚 Fetching ${AI_ARTICLES.length} Wikipedia articles...\n`);

  let success = 0;
  let failed = 0;
  const failedTitles: string[] = [];

  for (const title of AI_ARTICLES) {
    const slug = slugify(title);
    const outputPath = path.join(outputDir, `${slug}.json`);

    // Skip if already fetched
    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭  Skipping "${title}" (already exists)`);
      success++;
      continue;
    }

    try {
      const content = await fetchArticle(title);

      if (!content) {
        console.warn(`  ⚠  No content found for "${title}"`);
        failed++;
        failedTitles.push(title);
        continue;
      }

      const article: RawArticle = {
        title,
        sourceType: 'wikipedia',
        fetchedAt: new Date().toISOString(),
        content,
      };

      fs.writeFileSync(outputPath, JSON.stringify(article, null, 2), 'utf-8');
      console.log(`  ✓  "${title}" → ${slug}.json (${content.length} chars)`);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗  Failed "${title}": ${message}`);
      failed++;
      failedTitles.push(title);
    }

    // Respect Wikipedia rate limits — 200ms between requests
    await sleep(200);
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Done: ${success} succeeded, ${failed} failed`);
  if (failedTitles.length > 0) {
    console.log(`\nFailed articles:`);
    failedTitles.forEach((t) => console.log(`  - ${t}`));
  }
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
