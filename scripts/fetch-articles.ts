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

/**
 * Strip Wikipedia boilerplate sections that add no value to RAG retrieval:
 * == See also ==, == References ==, == Further reading ==, == External links ==, etc.
 * Anything from the first occurrence of a top-level section separator onwards.
 */
function cleanContent(text: string): string {
  // Match the first == Section == header that marks end-of-body content
  const boilerplatePattern =
    /\n\n\n?== (?:See also|References|Notes|Further reading|External links|Bibliography|Footnotes) ==/i;
  const idx = text.search(boilerplatePattern);
  return (idx !== -1 ? text.slice(0, idx) : text).trim();
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
      const rawContent = await fetchArticle(title);
      const content = rawContent ? cleanContent(rawContent) : null;

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

  // ─── Post-process: clean already-downloaded files ──────────────────────────
  console.log(
    '\n🧹 Cleaning existing files (stripping boilerplate sections)...',
  );
  const existing = fs.readdirSync(outputDir).filter((f) => f.endsWith('.json'));
  let cleaned = 0;
  for (const file of existing) {
    const filePath = path.join(outputDir, file);
    const article = JSON.parse(
      fs.readFileSync(filePath, 'utf-8'),
    ) as RawArticle;
    const cleanedContent = cleanContent(article.content);
    if (cleanedContent !== article.content) {
      fs.writeFileSync(
        filePath,
        JSON.stringify({ ...article, content: cleanedContent }, null, 2),
        'utf-8',
      );
      cleaned++;
    }
  }
  console.log(`  ✓  ${cleaned} file(s) updated`);

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
