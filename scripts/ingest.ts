import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module.js';
import { IngestionService } from '../src/modules/ingestion/ingestion.service.js';
import { RawArticle } from '../src/modules/ingestion/dto/ingestion.dto.js';

async function bootstrap() {
  console.log('🚀 Bootstrapping NestJS Context for Ingestion...\n');

  // Create the app context (background process, no HTTP server needed)
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  // Use our global Winston logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const ingestionService = app.get(IngestionService);

  try {
    // 1. Ensure Qdrant collection exists before we push anything
    await ingestionService.ensureCollection();

    // 2. Read all files in data/raw
    const rawDir = path.resolve('data/raw');
    if (!fs.existsSync(rawDir)) {
      throw new Error(`Data directory not found: ${rawDir}`);
    }

    const files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.json'));
    logger.log(`Found ${files.length} articles to ingest.`);

    let totalChunks = 0;

    // 3. Process each article
    for (const file of files) {
      const filePath = path.join(rawDir, file);
      const article = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawArticle;

      logger.log(`[Processing] ${article.title}...`);

      // a) Chunk
      const chunks = ingestionService.chunkText(article.content, article.title);
      if (chunks.length === 0) {
        logger.warn(`No valid chunks generated for ${article.title}. Skipping.`);
        continue;
      }

      // b) Embed
      const vectors = await ingestionService.embedChunks(chunks);

      // c) Upsert
      await ingestionService.upsertToQdrant(chunks, vectors);

      totalChunks += chunks.length;
      logger.log(`✓ [Done] ${article.title} — Upserted ${chunks.length} chunks.\n`);
    }

    logger.log(`🎉 Ingestion Complete! Processed ${files.length} files into ${totalChunks} total chunks.`);
  } catch (error) {
    logger.error('Ingestion failed:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();
