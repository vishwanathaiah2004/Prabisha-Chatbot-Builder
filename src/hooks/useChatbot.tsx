'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConversationalLead, ConversationalLeadConfig } from './useConversationalLead';
import { Message } from '@/types/chat';

interface ChatbotData {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  icon?: string;
  greeting?: string;
  suggestions?: string[];
  workspace?: {
    logo?: string;
    name?: string;
  };
  [key: string]: any;
}

interface UseChatbotProps {
  chatbotId: string;
  initialChatbotData?: ChatbotData;
  /** Pass the lead form config to enable conversational lead collection */
  conversationalLeadConfig?: ConversationalLeadConfig | null;
  /** Called when lead is fully collected */
  onLeadCollected?: (data: Record<string, string>) => void;
  /**
   * BCP-47 language code selected by the user (e.g. 'en', 'ja', 'ar').
   * Sent to the backend so the AI responds in the correct language.
   * Defaults to 'en' when omitted.
   */
  language?: string;
}

interface UseChatbotReturn {
  chatbot: ChatbotData | null;
  isLoadingChatbot: boolean;
  chatbotError: string | null;
  text: string;
  setText: (text: string) => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  messages: Message[];
  loading: boolean;
  error: string;
  conversationId: string | null;
  hasLoadedInitialMessages: boolean;
  quickQuestions: string[];
  mode: 'streaming' | 'standard';
  setMode: (mode: 'streaming' | 'standard') => void;
  handleSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  /** Start conversational lead collection (replaces modal showLeadForm) */
  startLeadCollection: () => void;
  /** True while the bot is waiting for a lead field answer */
  isAwaitingLeadAnswer: boolean;
  /** Current lead collection status */
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  refetchChatbot: () => Promise<void>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Simple timer utility
function timer(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const ms = (performance.now() - start).toFixed(1);
      console.log(`⏱️ [${label}]: ${ms}ms`);
      return parseFloat(ms);
    }
  };
}

export function useChatbot({
  chatbotId,
  initialChatbotData,
  conversationalLeadConfig,
  onLeadCollected,
  language = 'en',
}: UseChatbotProps): UseChatbotReturn {
  const [chatbot, setChatbot] = useState<ChatbotData | null>(initialChatbotData || null);
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(!initialChatbotData);
  const [chatbotError, setChatbotError] = useState<string | null>(null);

  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasLoadedInitialMessages, setHasLoadedInitialMessages] = useState<boolean>(false);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
  const [mode, setMode] = useState<'streaming' | 'standard'>('standard');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Keep a ref so streaming/standard handlers always read the latest value
  // without needing to be re-created when language changes.
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  // ── Conversational lead: inject a BOT message directly into chat ──────────
  const onBotMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      senderType: 'BOT',
      content,
      createdAt: new Date(),
    }]);
  }, []);

  const conversationalLead = useConversationalLead({
    chatbotId,
    conversationId,
    config: conversationalLeadConfig ?? null,
    onBotMessage,
    onLeadCollected,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const t = timer('loadConversationMessages');
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
        setConversationId(null);
        showWelcomeMessage();
        return;
      }

      if (response.ok) {
        const msgs = await response.json();
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs.map((msg: any) => ({
            senderType: msg.senderType,
            content: msg.content,
            createdAt: new Date(msg.createdAt),
          })));
        } else {
          showWelcomeMessage();
        }
      } else {
        throw new Error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
      setConversationId(null);
      showWelcomeMessage();
    } finally {
      t.end();
      setHasLoadedInitialMessages(true);
    }
  }, [chatbotId]);

  const showWelcomeMessage = useCallback(() => {
    if (!chatbot) return;
    setMessages([{
      senderType: 'BOT',
      content: chatbot.greeting || "👋 Hello! How can I help you today?",
      createdAt: new Date(),
    }]);
    setHasLoadedInitialMessages(true);
  }, [chatbot]);

  const fetchChatbotData = useCallback(async () => {
    if (!chatbotId) return;
    const t = timer('fetchChatbotData');
    setIsLoadingChatbot(true);
    setChatbotError(null);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/chatbots/${chatbotId}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error(`Failed to fetch chatbot: ${response.status}`);
      const data = await response.json();
      setChatbot(data);
      setQuickQuestions(
        data.suggestions?.length
          ? data.suggestions
          : ["How can you help me?", "What are your features?", "Tell me about pricing", "How do I get started?"]
      );
    } catch (error) {
      console.error('Error fetching chatbot:', error);
      setChatbotError(error instanceof Error ? error.message : 'Failed to load chatbot');
    } finally {
      t.end();
      setIsLoadingChatbot(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    if (!initialChatbotData && chatbotId) {
      fetchChatbotData();
    } else if (initialChatbotData) {
      setChatbot(initialChatbotData);
      if (initialChatbotData.suggestions) setQuickQuestions(initialChatbotData.suggestions);
      setIsLoadingChatbot(false);
    }
  }, [chatbotId, initialChatbotData, fetchChatbotData]);

  useEffect(() => {
    if (!chatbot) return;
    const savedConversationId = localStorage.getItem(`chatbot_${chatbotId}_conversation`);
    if (savedConversationId) {
      setConversationId(savedConversationId);
      loadConversationMessages(savedConversationId);
    } else {
      showWelcomeMessage();
    }
  }, [chatbot, chatbotId, loadConversationMessages, showWelcomeMessage]);

  useEffect(() => {
    if (hasLoadedInitialMessages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [messages, loading, hasLoadedInitialMessages]);

  useEffect(() => {
    if (inputRef.current && hasLoadedInitialMessages) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [hasLoadedInitialMessages]);

  // ─────────────────────────────────────────────────────────────────────────
  // Streaming submit
  // ─────────────────────────────────────────────────────────────────────────

  const handleStreamingSubmit = async (searchQuery: string) => {
    const tTotal = timer('handleStreamingSubmit [total]');

    setMessages(prev => [...prev, {
      senderType: 'BOT',
      content: '...',
      createdAt: new Date(),
    }]);

    try {
      const tFetch = timer('streaming: fetch /api/chat/stream');
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: searchQuery,
          conversationId,
          chatbotId,
          // Tell the AI which language to reply in
          language: languageRef.current,
        }),
      });
      tFetch.end();

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const newConversationId = response.headers.get('X-Conversation-Id');
      if (newConversationId && newConversationId !== conversationId) {
        setConversationId(newConversationId);
        localStorage.setItem(`chatbot_${chatbotId}_conversation`, newConversationId);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      setStatus('streaming');

      const tStream = timer('streaming: reading stream chunks');
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            senderType: 'BOT',
            content: accumulated,
            createdAt: new Date(),
          };
          return updated;
        });
      }

      const streamMs = tStream.end();
      console.log(`   └─ chunks received: ${chunkCount}, total chars: ${accumulated.length}`);

      setStatus('ready');
      setLoading(false);

    } catch (err) {
      console.error('Streaming error:', err);
      setStatus('error');
      setLoading(false);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          senderType: 'BOT',
          content: 'Sorry, I encountered an error. Please try again.',
          createdAt: new Date(),
        };
        return updated;
      });
      setError(err instanceof Error ? err.message : 'Failed to send message.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Standard submit
  // ─────────────────────────────────────────────────────────────────────────

  const handleStandardSubmit = async (searchQuery: string) => {
    const tTotal = timer('handleStandardSubmit [total]');

    try {
      const tFetch = timer('standard: fetch /api/chat');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: searchQuery,
          conversationId,
          chatbotId,
          // Tell the AI which language to reply in
          language: languageRef.current,
        }),
      });
      tFetch.end();

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const tParse = timer('standard: parse JSON response');
      const data = await response.json();
      tParse.end();

      console.log('Chat response:', data);

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(`chatbot_${chatbotId}_conversation`, data.conversationId);
      }

      setStatus('streaming');
      setMessages(prev => [...prev, {
        senderType: 'BOT',
        content: data.message || data.response,
        createdAt: new Date(),
      }]);

      setTimeout(() => {
        setStatus('ready');
        setLoading(false);
      }, 500);

    } catch (err) {
      console.error('Chat error:', err);
      setStatus('error');
      setLoading(false);
      setMessages(prev => [...prev, {
        senderType: 'BOT',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date(),
      }]);
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
      setTimeout(() => setStatus('ready'), 3000);
    } finally {
      tTotal.end();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (searchQuery: string) => {
    console.group(`🚀 sendMessage [mode=${mode}] — "${searchQuery.substring(0, 40)}..."`);
    const tSubmit = timer('sendMessage [total including UI updates]');

    setMessages(prev => [...prev, { senderType: 'USER', content: searchQuery, createdAt: new Date() }]);
    setLoading(true);
    setStatus('submitted');
    setError('');
    setText('');
    setTimeout(() => inputRef.current?.focus(), 50);

    if (mode === 'streaming') {
      await handleStreamingSubmit(searchQuery);
    } else {
      await handleStandardSubmit(searchQuery);
    }

    tSubmit.end();
    console.groupEnd();
  }, [mode]);

  useEffect(() => {
    if (conversationalLead.status === 'done' && pendingMessage) {
      const t = setTimeout(() => {
        sendMessage(pendingMessage);
        setPendingMessage(null);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [conversationalLead.status, pendingMessage, sendMessage]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleSubmit (public API)
  // ─────────────────────────────────────────────────────────────────────────

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (overrideText || text).trim();
    if (!searchQuery) { setError('Please enter a message'); return; }

    // ── Conversational lead intercept ────────────────────────────────────────
    if (conversationalLead.isAwaitingLeadAnswer) {
      setMessages(prev => [...prev, { senderType: 'USER', content: searchQuery, createdAt: new Date() }]);
      setText('');
      setTimeout(() => inputRef.current?.focus(), 50);
      await conversationalLead.handleUserMessage(searchQuery);
      return;
    }

    // ── Auto-start lead collection if needed ─────────────────────────────────
    if (conversationalLeadConfig && conversationalLead.status === 'idle') {
      setPendingMessage(searchQuery);
      setText('');
      setTimeout(() => inputRef.current?.focus(), 50);
      conversationalLead.startLeadCollection();
      return;
    }

    await sendMessage(searchQuery);
  };

  const handleQuickQuestion = async (question: string) => {
    if (loading) return;
    setText(question);
    await handleSubmit(undefined, question);
  };

  const handleNewChat = () => {
    localStorage.removeItem(`chatbot_${chatbotId}_conversation`);
    setConversationId(null);
    setText('');
    setError('');
    setStatus('ready');
    setMessages([]);
    showWelcomeMessage();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const refetchChatbot = async () => { await fetchChatbotData(); };

  return {
    chatbot,
    isLoadingChatbot,
    chatbotError,
    text,
    setText,
    status,
    messages,
    loading,
    error,
    conversationId,
    hasLoadedInitialMessages,
    quickQuestions,
    mode,
    setMode,
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    startLeadCollection: conversationalLead.startLeadCollection,
    isAwaitingLeadAnswer: conversationalLead.isAwaitingLeadAnswer,
    leadCollectionStatus: conversationalLead.status,
    formatTime,
    refetchChatbot,
    messagesEndRef,
    inputRef,
    chatContainerRef,
  };
}