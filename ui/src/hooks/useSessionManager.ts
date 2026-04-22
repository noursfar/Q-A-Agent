import { useState, useCallback, useEffect } from 'react';
import type { SessionInfo } from '../types/chat';

export function useSessionManager() {
  // Initialize sessions from localStorage, guaranteeing at least one session
  const [sessions, setSessions] = useState<SessionInfo[]>(() => {
    const saved = localStorage.getItem('qa-agent-sessions');
    const parsed = saved ? JSON.parse(saved) : [];
    if (parsed.length === 0) {
      return [{ id: crypto.randomUUID(), title: 'New Chat', createdAt: Date.now() }];
    }
    return parsed;
  });
  
  // Initialize active session based on the initialized sessions array
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  // Persist sessions to localStorage when they change
  useEffect(() => {
    localStorage.setItem('qa-agent-sessions', JSON.stringify(sessions));
  }, [sessions]);

  const createSession = useCallback(() => {
    const newId = crypto.randomUUID();
    setSessions((prev) => [
      { id: newId, title: 'New Chat', createdAt: Date.now() },
      ...prev,
    ]);
    setActiveSessionId(newId);
    return newId;
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      
      if (next.length === 0) {
        const newId = crypto.randomUUID();
        setActiveSessionId(newId);
        return [{ id: newId, title: 'New Chat', createdAt: Date.now() }];
      }
      
      if (activeSessionId === id) {
        setActiveSessionId(next[0].id);
      }
      
      return next;
    });
  }, [activeSessionId]);

  const updateSessionTitle = useCallback((id: string, firstMessage: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id && s.title === 'New Chat') {
          const title = firstMessage.length > 35 
            ? firstMessage.substring(0, 35) + '...' 
            : firstMessage;
          return { ...s, title };
        }
        return s;
      })
    );
  }, []);

  return {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
    updateSessionTitle,
  };
}
