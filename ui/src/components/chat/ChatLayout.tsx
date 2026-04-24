import { useState, useCallback, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSessionManager } from '../../hooks/useSessionManager';
import { useMessagePersistence } from '../../hooks/useMessagePersistence';
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

  const { loadMessages, saveMessages, clearMessages } = useMessagePersistence();

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

  // Restore persisted messages whenever the active session changes
  useEffect(() => {
    const stored = loadMessages(activeSessionId);
    setMessages(stored);
    setSelectedCitation(null);
  }, [activeSessionId, loadMessages, setMessages]);

  // Persist messages to localStorage after each complete response
  useEffect(() => {
    if (status === 'ready') {
      saveMessages(activeSessionId, messages);
    }
  }, [status, messages, activeSessionId, saveMessages]);

  const handleSelectSession = useCallback((id: string) => {
    switchSession(id);
    // Message loading + citation reset are handled by the activeSessionId effect
  }, [switchSession]);

  const handleNewChat = useCallback(() => {
    createSession();
    // Message loading + citation reset are handled by the activeSessionId effect
  }, [createSession]);

  const handleDeleteSession = useCallback((id: string) => {
    clearMessages(id);
    deleteSession(id);
    if (id === activeSessionId) {
      setSelectedCitation(null);
    }
  }, [clearMessages, deleteSession, activeSessionId]);

  const handleSend = useCallback(
    (text: string) => {
      // If this is a brand-new session, update its title
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

  return (
    <div className="flex flex-col h-screen bg-navy-950 overflow-hidden font-sans">
      <TopBar
        status={status}
        onToggleSidebar={() => setIsSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden relative min-w-0">
        <ConversationSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isOpen={isSidebarOpen}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setIsSidebarOpen(false)}
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
