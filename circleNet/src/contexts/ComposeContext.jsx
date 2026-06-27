// src/contexts/ComposeContext.jsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const ComposeContext = createContext();

export function ComposeProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialText, setInitialText] = useState('');
  const [groupId, setGroupId] = useState(null);

  const openCompose = useCallback((text = '', group = null) => {
    setInitialText(text);
    setGroupId(group);
    setIsOpen(true);
  }, []);

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    setInitialText('');
    setGroupId(null);
  }, []);

  const value = {
    isOpen,
    initialText,
    groupId,
    openCompose,
    closeCompose,
  };

  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
}

export function useCompose() {
  const context = useContext(ComposeContext);
  if (!context) {
    throw new Error('useCompose must be used within a ComposeProvider');
  }
  return context;
}