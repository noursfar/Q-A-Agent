import * as readline from 'readline';

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
  rl.question('You: ', async (query) => {
    if (!query.trim()) {
      return askQuestion();
    }

    if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      rl.close();
      return process.exit(0);
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

          if (line.startsWith('event: ')) {
            const eventName = line.substring(7);
            const dataLine = lines[i + 1]?.trim() || '';
            
            if (dataLine.startsWith('data: ')) {
              const dataStr = dataLine.substring(6);
              i++; // Skip the data line since we processed it

              if (eventName === 'text') {
                // Stream text chunk instantly to standard out
                try {
                   const chunk = JSON.parse(dataStr);
                   process.stdout.write(chunk);
                } catch {
                   process.stdout.write(dataStr);
                }
              } 
              else if (eventName === 'citations') {
                try {
                  const parsed = JSON.parse(dataStr);
                  console.log('\n\n📚 SOURCES EXTRACTED:');
                  if (parsed.citations && parsed.citations.length > 0) {
                    parsed.citations.forEach((c: any) => {
                      console.log(`\n  [${c.id}] ${c.sourceTitle}`);
                      console.log(`      "${c.excerpt}"`);
                    });
                  } else {
                    console.log('  No external sources were referenced for this answer.');
                  }
                } catch {
                  console.log('\n\n📚 SOURCES EXTRACTED:', dataStr);
                }
              }
              else if (eventName === 'error') {
                console.log(`\n❌ Error from server: ${dataStr}`);
              }
              else if (eventName === 'done') {
                // Done event, do nothing
              }
            }
          }
        }
      }
      
      console.log('\n\n--------------------------------------------------------\n');
      askQuestion();

    } catch (err) {
      console.error('\n❌ Could not connect or stream failed:', (err as Error).message);
      console.error('Make sure "pnpm start:dev" is running in another terminal!');
      console.log('\n--------------------------------------------------------\n');
      askQuestion();
    }
  });
}

askQuestion();
