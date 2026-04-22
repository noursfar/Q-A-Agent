import { useState, useCallback, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSessionManager } from '../../hooks/useSessionManager';
import type { Citation, ChatUIMessage } from '../../types/chat';

import TopBar from './TopBar';
import ConversationSidebar from './ConversationSidebar';
import MessageList from './MessageList';
import Composer from './Composer';
import SourcesPanel from './SourcesPanel';

export default function ChatLayout() {
  const {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
    updateSessionTitle,
  } = useSessionManager();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const { messages, status, sendMessage, setMessages } = useChat<ChatUIMessage>({
    id: activeSessionId,
    transport: new DefaultChatTransport({
      api: '/chat',
      prepareSendMessagesRequest: ({ messages }) => {
        // Send only the latest user message and the active session ID to the backend
        const lastMessage = messages[messages.length - 1];
        const textContent = lastMessage.parts
          ? lastMessage.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as { type: 'text'; text: string }).text)
              .join('')
          : '';

        return {
          body: {
            message: textContent,
            sessionId: activeSessionId,
          },
        };
      },
    }),
  });

  // When activeSessionId changes (due to user switching sessions), we should clear messages
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCitation(null);
  }, [activeSessionId, setMessages]);

  const handleSend = useCallback(
    (text: string) => {
      // If this is a brand new session, update its title
      const currentSession = sessions.find((s) => s.id === activeSessionId);
      if (currentSession && currentSession.title === 'New Chat') {
        updateSessionTitle(activeSessionId, text);
      }
      sendMessage({ text });
    },
    [activeSessionId, sessions, sendMessage, updateSessionTitle]
  );

  const handleCitationClick = useCallback((citation: Citation) => {
    setSelectedCitation(citation);
  }, []);

  const currentSessionTitle =
    sessions.find((s) => s.id === activeSessionId)?.title || 'New Chat';

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden font-sans">
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        onNewChat={createSession}
        onSelectSession={switchSession}
        onDeleteSession={deleteSession}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col relative min-w-0">
        <TopBar
          status={status}
          sessionTitle={currentSessionTitle}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <div 
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out ${selectedCitation !== null ? 'lg:mr-[380px]' : ''}`}
          >
            <MessageList
              messages={messages}
              status={status}
              onCitationClick={handleCitationClick}
              onSuggestionClick={handleSend}
            />

            <Composer onSend={handleSend} disabled={status !== 'ready' && status !== 'error'} />
          </div>

          <SourcesPanel
            citation={selectedCitation}
            isOpen={selectedCitation !== null}
            onClose={() => setSelectedCitation(null)}
          />
        </div>
      </div>
    </div>
  );
}
