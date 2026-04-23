import * as readline from 'readline';
import type { CitationResult } from '../src/modules/chat/dto/chat.dto.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const SESSION_ID = `cli-session-${Date.now()}`;
const CHAT_URL = 'http://localhost:3000/chat';

console.log('\n========================================================');
console.log('🤖 Q-A Agent CLI Tester (Streaming + Citations)');
console.log(`Session ID: ${SESSION_ID}`);
console.log('Type "exit" or "quit" to stop.');
console.log('========================================================\n');

function askQuestion() {
  rl.question('You: ', (query) => {
    void (async () => {
      if (!query.trim()) {
        askQuestion();
        return;
      }

      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }

      try {
        process.stdout.write('\nAgent: ');

        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query, sessionId: SESSION_ID }),
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No readable stream returned');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process Server-Sent Events from the buffer
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() || '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);

                if (parsed.type === 'text-delta') {
                  process.stdout.write(parsed.delta);
                } else if (parsed.type === 'data-citations') {
                  const citationsData = parsed.data as CitationResult;
                  console.log('\n\n📚 SOURCES EXTRACTED:');
                  if (
                    citationsData.citations &&
                    citationsData.citations.length > 0
                  ) {
                    citationsData.citations.forEach((c) => {
                      console.log(
                        `\n  [ Chunk ${c.chunkIndex} ] ${c.sourceTitle}`,
                      );
                      console.log(`      "${c.claim}"`);
                    });
                  } else {
                    console.log(
                      '  No external sources were referenced for this answer.',
                    );
                  }

                  if (
                    citationsData.uncitedClaims &&
                    citationsData.uncitedClaims.length > 0
                  ) {
                    console.log(
                      '\n⚠️  UNVERIFIED CLAIMS (Potential Hallucinations):',
                    );
                    citationsData.uncitedClaims.forEach((c: string) => {
                      console.log(`  - ${c}`);
                    });
                  }
                } else if (parsed.type === 'error') {
                  console.log(
                    `\n❌ Error from server: ${parsed.errorText || dataStr}`,
                  );
                }
              } catch {
                // Ignore parse errors for unhandled events
              }
            }
          }
        }

        console.log(
          '\n\n--------------------------------------------------------\n',
        );
        askQuestion();
      } catch (err) {
        console.error(
          '\n❌ Could not connect or stream failed:',
          (err as Error).message,
        );
        console.error(
          'Make sure "pnpm start:dev" is running in another terminal!',
        );
        console.log(
          '\n--------------------------------------------------------\n',
        );
        askQuestion();
      }
    })();
  });
}

askQuestion();
