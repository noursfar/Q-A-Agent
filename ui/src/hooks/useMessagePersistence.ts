import { useCallback } from 'react';
import type { ChatUIMessage } from '../types/chat';

const KEY_PREFIX = 'qa-agent-messages-';

/**
 * Provides helpers to persist and restore chat messages per session
 * in localStorage, so conversation history survives page refreshes
 * and session switches.
 */
export function useMessagePersistence() {
  const loadMessages = useCallback((sessionId: string): ChatUIMessage[] => {
    try {
      const saved = localStorage.getItem(`${KEY_PREFIX}${sessionId}`);
      if (saved) {
        return JSON.parse(saved) as ChatUIMessage[];
      }
    } catch (error) {
      console.warn('Failed to load messages from localStorage:', error);
    }
    return [];
  }, []);

  const saveMessages = useCallback(
    (sessionId: string, messages: ChatUIMessage[]) => {
      if (messages.length === 0) return;
      try {
        localStorage.setItem(
          `${KEY_PREFIX}${sessionId}`,
          JSON.stringify(messages),
        );
      } catch (error) {
        console.warn('Failed to save messages to localStorage:', error);
      }
    },
    [],
  );

  const clearMessages = useCallback((sessionId: string) => {
    try {
      localStorage.removeItem(`${KEY_PREFIX}${sessionId}`);
    } catch (error) {
      console.warn('Failed to clear messages from localStorage:', error);
    }
  }, []);

  return { loadMessages, saveMessages, clearMessages };
}
