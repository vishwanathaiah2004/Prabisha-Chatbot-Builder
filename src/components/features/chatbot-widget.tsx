'use client';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useEffect, useState } from 'react';
import {
  Loader2,
  Zap,
  XIcon,
  MicIcon,
  MicOffIcon,
  RefreshCw,
  Send,
  UserPlus,
  CheckCircle2,
  VolumeX,
  Volume2,
  MessageCircle,
  SmilePlus,
} from 'lucide-react';
import { Message } from '@/types/chat';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from '@/components/ui/shadcn-io/ai/prompt-input';
import { useChatbot } from '@/hooks/useChatbot';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useLeadGeneration } from '@/hooks/useLeadGeneration';
import { LeadForm } from '@/components/forms/lead-form';
import { Button } from '@/components/ui/button';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { EmojiClickData } from 'emoji-picker-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChatbotWidgetProps {
  chatbotId: string;
  initialChatbotData?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/** Sanitize LLM HTML and force all links to open in a new tab. */
const sanitizeHtml = (html: string): string => {
  const clean = DOMPurify.sanitize(html);
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared small components
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
);

const LoadingSpinner = () => (
  <div className="flex flex-col h-full min-h-[400px] bg-background">
    <div className="flex items-stretch p-4 border-b gap-3">
      <SkeletonBlock className="w-16 h-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 flex flex-col justify-center">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-48" />
      </div>
    </div>
    <div className="flex-1 p-4 space-y-4">
      <div className="flex gap-3">
        <SkeletonBlock className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mt-6">
        <SkeletonBlock className="h-3 w-24" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-28 rounded-lg" />
          <SkeletonBlock className="h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
    <div className="border-t p-3 flex gap-2">
      <SkeletonBlock className="flex-1 h-12 rounded-xl" />
      <SkeletonBlock className="h-12 w-12 rounded-xl" />
    </div>
  </div>
);

const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center p-4">
      <p className="text-destructive">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-2">Retry</Button>
      )}
    </div>
  </div>
);

const ErrorBanner = ({ error }: { error: string }) => (
  <div className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-in slide-in-from-bottom">
    <p className="text-sm text-destructive flex items-center gap-2">
      <XIcon className="h-3 w-3 shrink-0" />
      {error}
    </p>
  </div>
);

const LeadFormOverlay = ({
  activeLeadForm, chatbotId, conversationId, onClose, onSuccess, onSubmitLead,
}: {
  activeLeadForm: any;
  chatbotId: string;
  conversationId: string;
  onClose: () => void;
  onSuccess: () => void;
  onSubmitLead: (formData: Record<string, string>) => Promise<boolean>;
}) => (
  <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
      <LeadForm
        config={activeLeadForm}
        chatbotId={chatbotId}
        conversationId={conversationId}
        onClose={onClose}
        onSuccess={onSuccess}
        onSubmitLead={onSubmitLead}
      />
    </div>
  </div>
);

const Picker = dynamic(() => import('emoji-picker-react'), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// ChatbotWidget — root export
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatbotWidget({ chatbotId, initialChatbotData }: ChatbotWidgetProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveTheme, setLiveTheme] = useState<any>(null);

  // ── Lead generation ───────────────────────────────────────────────────────
  // Determines whether to use modal (EMBEDDED) or chat-based (MESSAGES) mode.
  const {
    activeLeadForm,
    isLeadFormVisible,
    shouldShowLeadForm,
    isLoadingLeadConfig,
    hasSubmittedLead,
    conversationalLeadConfig,  // non-null when leadFormStyle === 'MESSAGES'
    isConversationalMode,      // true → collect via chat, false → show modal
    showLeadForm,
    hideLeadForm,
    submitLeadForm,
    checkLeadRequirements,
    markLeadAsSubmitted,
  } = useLeadGeneration({
    chatbotId,
    conversationId: null,
    onLeadCollected: (data) => console.log('Lead collected:', data),
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  // Pass conversationalLeadConfig so useChatbot can wire useConversationalLead
  // internally and intercept user messages during field collection.
  const {
    chatbot,
    isLoadingChatbot,
    chatbotError,
    text,
    setText,
    status,
    messages,
    loading,
    error,
    hasLoadedInitialMessages,
    quickQuestions,
    conversationId,
    mode,
    setMode,
    handleSubmit,
    handleQuickQuestion,
    handleNewChat,
    formatTime,
    messagesEndRef,
    inputRef,
    chatContainerRef,
    startLeadCollection,
    isAwaitingLeadAnswer,
    leadCollectionStatus,
  } = useChatbot({
    chatbotId,
    initialChatbotData,
    conversationalLeadConfig: isConversationalMode ? conversationalLeadConfig : null,
    onLeadCollected: (data) => {
      console.log('Conversational lead submitted:', data);
      markLeadAsSubmitted();
    },
  });

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'theme-update') setLiveTheme(e.data.theme);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!chatbotId) return;
    const sid =
      localStorage.getItem(`chatbot_session_${chatbotId}`) ||
      `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(`chatbot_session_${chatbotId}`, sid);
    setIsInitialized(true);
    window.parent.postMessage({ type: 'chatbot-loaded', chatbotId }, '*');
  }, [chatbotId]);

  useEffect(() => {
    if (messages.length > 0 && !hasSubmittedLead && conversationId) {
      checkLeadRequirements();
    }
  }, [messages, hasSubmittedLead, conversationId, checkLeadRequirements]);

  useEffect(() => {
    if (!shouldShowLeadForm || !activeLeadForm || isLeadFormVisible || loading) return;
    const timer = setTimeout(() => {
      if (isConversationalMode) startLeadCollection();
      else showLeadForm();
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    shouldShowLeadForm, activeLeadForm, isLeadFormVisible, loading,
    isConversationalMode, startLeadCollection, showLeadForm,
  ]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isInitialized || isLoadingChatbot) return <LoadingSpinner />;
  if (chatbotError) return <ErrorDisplay error="Failed to load chatbot" onRetry={() => window.location.reload()} />;
  if (!chatbot) return null;

  const effectiveChatbot = liveTheme
    ? { ...chatbot, theme: { ...chatbot.theme, ...liveTheme } }
    : chatbot;

  return (
    <ChatBot
      chatbot={effectiveChatbot}
      onClose={() => window.parent.postMessage({ type: 'chatbot-close', chatbotId }, '*')}
      text={text}
      setText={setText}
      status={status}
      messages={messages}
      loading={loading}
      error={error}
      hasLoadedInitialMessages={hasLoadedInitialMessages}
      quickQuestions={quickQuestions}
      conversationId={conversationId}
      mode={mode}
      setMode={setMode}
      handleSubmit={handleSubmit}
      handleQuickQuestion={handleQuickQuestion}
      handleNewChat={handleNewChat}
      formatTime={formatTime}
      messagesEndRef={messagesEndRef}
      inputRef={inputRef}
      chatContainerRef={chatContainerRef}
      activeLeadForm={activeLeadForm}
      isLeadFormVisible={isLeadFormVisible}
      isLoadingLeadConfig={isLoadingLeadConfig}
      hasSubmittedLead={hasSubmittedLead}
      isConversationalMode={isConversationalMode}
      isAwaitingLeadAnswer={isAwaitingLeadAnswer}
      leadCollectionStatus={leadCollectionStatus}
      showLeadForm={showLeadForm}
      hideLeadForm={hideLeadForm}
      submitLeadForm={submitLeadForm}
      startLeadCollection={startLeadCollection}
      markLeadAsSubmitted={markLeadAsSubmitted}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatBot — layout shell
// ─────────────────────────────────────────────────────────────────────────────

interface ChatBotProps {
  chatbot: any;
  onClose: () => void;
  text: string;
  setText: (text: string) => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  messages: Message[];
  loading: boolean;
  error: string;
  hasLoadedInitialMessages: boolean;
  quickQuestions: string[];
  conversationId: string | null;
  mode: 'streaming' | 'standard';
  setMode: (mode: 'streaming' | 'standard') => void;
  handleSubmit: (e?: React.FormEvent, overrideText?: string) => Promise<void>;
  handleQuickQuestion: (question: string) => Promise<void>;
  handleNewChat: () => void;
  formatTime: (date?: Date) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  activeLeadForm: any;
  isLeadFormVisible: boolean;
  isLoadingLeadConfig: boolean;
  hasSubmittedLead: boolean;
  isConversationalMode: boolean;
  isAwaitingLeadAnswer: boolean;
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  showLeadForm: () => void;
  hideLeadForm: () => void;
  submitLeadForm: (formData: Record<string, string>) => Promise<boolean>;
  startLeadCollection: () => void;
  markLeadAsSubmitted: () => void;
}

function ChatBot({
  chatbot, onClose,
  text, setText, status, messages, loading, error,
  hasLoadedInitialMessages, quickQuestions, conversationId, mode, setMode,
  handleSubmit, handleQuickQuestion, handleNewChat, formatTime,
  messagesEndRef, inputRef, chatContainerRef,
  activeLeadForm, isLeadFormVisible, isLoadingLeadConfig, hasSubmittedLead,
  isConversationalMode, isAwaitingLeadAnswer, leadCollectionStatus,
  showLeadForm, hideLeadForm, submitLeadForm, startLeadCollection, markLeadAsSubmitted,
}: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;

  const {
    transcript, startListening, stopListening,
    resetTranscript, browserSupportsSpeechRecognition,
    policyBlocked, policyMessage,
  } = useSpeechToText({ continuous: true, lang: 'en-US' });
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);
  const [parentPolicyInfo, setParentPolicyInfo] = useState<{
    blocked: boolean;
    permission?: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const blocked = params.get('parent_policy_blocked');
      const permission = params.get('parent_permission');
      if (blocked === 'true' || permission === 'denied') {
        setParentPolicyInfo({ blocked: blocked === 'true', permission: permission || undefined });
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isEmbedded) return;
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100vh';
    document.documentElement.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';
  }, [isEmbedded]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (transcript) { setText(transcript); resetTranscript(); }
  }, [transcript, resetTranscript, setText]);

  useEffect(() => {
    if (isMicrophoneOn) startListening();
    else { stopListening(); resetTranscript(); }
  }, [isMicrophoneOn, startListening, stopListening, resetTranscript]);

  const handleClose = () => {
    if (isEmbedded) { onClose(); return; }
    setIsClosing(true);
    setTimeout(() => { setIsOpen(false); setIsClosing(false); }, 300);
  };

  const handleLeadAction = () => {
    if (isConversationalMode) startLeadCollection();
    else showLeadForm();
  };

  const primaryLight = chatbot.theme?.primaryLight || '#E6F0FF'; // light blue
  const borderColor = chatbot.theme?.borderColor || '#D6E4FF';

  const shellClass = [
    isMobile || isEmbedded
      ? 'w-full h-full rounded-none'
      : 'w-[95vw] sm:w-[420px] h-[600px] rounded-2xl',
    'flex flex-col relative overflow-hidden',
  ].join(' ');

  const positionClass = isEmbedded
    ? 'w-full h-full'
    : `fixed ${isMobile ? 'inset-0' : 'bottom-6 right-6'} z-50`;

  if (!hasLoadedInitialMessages) {
    return (
      <div className={positionClass}>
        <div className={shellClass}><LoadingSpinner /></div>
      </div>
    );
  }

  return (
    <div className={positionClass}>
      {/* show banners if the parent page blocks microphone or if the widget detected a policy denial */}
      {parentPolicyInfo && (
        <ErrorBanner error={`Embedding site blocks microphone (parent permission=${parentPolicyInfo.permission || 'unknown'}). Please allow microphone for the iframe on the host page.`} />
      )}
      {policyBlocked && policyMessage && <ErrorBanner error={policyMessage} />}
      {isOpen ? (
        <div
          className={[
            shellClass,
            'transition-all duration-300 ease-out',
            isClosing ? 'animate-out slide-out-to-bottom-full' : 'animate-in slide-in-from-bottom-full',
          ].join(' ')}
          style={{
            backgroundColor: primaryLight,
            border: `1px solid ${borderColor}`,
          }}
        >
          <ChatHeader
            onClose={handleClose}
            chatbot={chatbot}
            isMobile={isMobile}
            isEmbedded={isEmbedded}
          />

          {/* Modal overlay — EMBEDDED mode only */}
          {isLeadFormVisible && activeLeadForm && !isConversationalMode && (
            <LeadFormOverlay
              activeLeadForm={activeLeadForm}
              chatbotId={chatbot.id}
              conversationId={conversationId || ''}
              onClose={hideLeadForm}
              onSuccess={markLeadAsSubmitted}
              onSubmitLead={submitLeadForm}
            />
          )}

          <ChatMessages
            messages={messages}
            loading={loading}
            status={status}
            quickQuestions={quickQuestions}
            onQuickQuestion={handleQuickQuestion}
            chatContainerRef={chatContainerRef}
            messagesEndRef={messagesEndRef}
            formatTime={formatTime}
            chatbot={chatbot}
            hasSubmittedLead={hasSubmittedLead}
            isConversationalMode={isConversationalMode}
            leadCollectionStatus={leadCollectionStatus}
            onLeadAction={!hasSubmittedLead && activeLeadForm ? handleLeadAction : undefined}
          />

          {error && <ErrorBanner error={error} />}

          <ChatInput
            text={text}
            setText={setText}
            loading={loading}
            isMicrophoneOn={isMicrophoneOn}
            browserSupportsSpeechRecognition={browserSupportsSpeechRecognition}
            onSubmit={handleSubmit}
            onNewChat={handleNewChat}
            status={status}
            inputRef={inputRef}
            onToggleMicrophone={() => {
              if (browserSupportsSpeechRecognition) setIsMicrophoneOn(p => !p);
            }}
            hasLeadForm={!hasSubmittedLead && !!activeLeadForm}
            onLeadAction={handleLeadAction}
            isLoadingLeadConfig={isLoadingLeadConfig}
            isAwaitingLeadAnswer={isAwaitingLeadAnswer}
            isConversationalMode={isConversationalMode}
            chatbot={chatbot}
          />

          <div className="flex items-center justify-end gap-1.5 p-1 mr-4">
            <span className="text-xs font-medium tracking-wide text-gray-400 lowercase">
              Powered by
            </span>
            <Link target="_blank" rel="noopener noreferrer" href='https://prabisha.com/' className="cursor-pointer text-sm font-bold text-[#1320AA] hover:text-[#1320AA] transition-colors">
              Prabisha
            </Link>
          </div>
        </div>
      ) : (
        !isEmbedded && !isMobile && (
          <ChatToggleButton onClick={() => setIsOpen(true)} chatbot={chatbot} />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatHeader
function ChatHeader({
  onClose,
  chatbot,
  isMobile,
  isEmbedded,
}: {
  onClose: () => void;
  chatbot: any;
  isMobile?: boolean;
  isEmbedded?: boolean;
}) {
  const headerBg = chatbot?.theme?.primaryColor || '#3B82F6'; // Light Blue default
  const headerText = chatbot?.theme?.headerTextColor || '#ffffff';
  const accentColor = chatbot?.theme?.inputButtonColor || '#F97316'; // light orange
  return (
    <div
      className={[
        'flex items-center justify-between px-5 py-4 border-b border-black/10',
        isMobile || isEmbedded ? 'rounded-none' : 'rounded-t-2xl',
      ].join(' ')}
      style={{
        backgroundColor: headerBg,
        color: headerText,
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-4 min-w-0">
        <Image
          src={chatbot.avatar || '/icons/logo.png'}
          height={48}
          width={48}
          alt={chatbot.name || 'Assistant'}
          className="h-12 w-12 rounded-xl object-cover border border-black/10"
          unoptimized
        />

        <div className="min-w-0">
          {/* Name + Live */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold truncate">
              {chatbot.name || 'Customer Support'}
            </h3>

            {/* Live Indicator */}
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50"
                  style={{
                    animation: 'softPulse 2s ease-in-out infinite',
                  }}
                ></span>

                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>
              </span>

              <span className="text-xs font-semibold truncate tracking-wide">
                Live
              </span>

              <style jsx>{`
    @keyframes softPulse {
      0% {
        transform: scale(1);
        opacity: 0.5;
      }
      50% {
        transform: scale(1.8);
        opacity: 0.2;
      }
      100% {
        transform: scale(1);
        opacity: 0.5;
      }
    }
  `}</style>
            </span>
          </div>

          <p
           className="text-xs font-semibold truncate mt-0.5"
            style={{ color: accentColor }}
          >
            {chatbot.description || 'Typically replies instantly'}
          </p>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="h-9 w-9 rounded-full bg-[#F97316] text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
        aria-label="Close chat"
      >
        <XIcon size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatToggleButton
// ─────────────────────────────────────────────────────────────────────────────

function ChatToggleButton({ onClick, chatbot }: { onClick: () => void; chatbot: any }) {
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileScreen(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const size = isMobileScreen
    ? (chatbot.theme?.widgetSizeMobile || 60)
    : (chatbot.theme?.widgetSize || 70);

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
      aria-label="Open chatbot"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: chatbot.theme?.widgetBgColor || '#FFFFFF',
        border: `3px solid ${chatbot.theme?.widgetColor || '#3b82f6'}`,
      }}
    >
      <Image
        src={chatbot.avatar || chatbot.icon || '/character1.png'}
        height={size} width={size}
        alt={chatbot.name || 'Chat'}
        className="rounded-full w-full h-full object-contain"
      />
      {/* <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full font-bold animate-pulse">
        Chat
      </div> */}
      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatMessages
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  quickQuestions: string[];
  onQuickQuestion: (q: string) => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  formatTime: (date?: Date) => string;
  chatbot: any;
  hasSubmittedLead: boolean;
  isConversationalMode: boolean;
  leadCollectionStatus: 'idle' | 'collecting' | 'submitting' | 'done' | 'error';
  onLeadAction?: () => void;
}

function ChatMessages({
  messages, loading, status, quickQuestions, onQuickQuestion,
  chatContainerRef, messagesEndRef, formatTime, chatbot,
  hasSubmittedLead, isConversationalMode, leadCollectionStatus, onLeadAction,
}: ChatMessagesProps) {
  const { speak, stop, isPlaying } = useTextToSpeech();
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const t = chatbot.theme;
  const botBg = t?.botMessageBgColor || '#FFFFFF';
  const botText = t?.botMessageTextColor || '#1E293B';

  const userBg = t?.userMessageBgColor || '#3B82F6'; // blue
  const userText = t?.userMessageTextColor || '#ffffff';

  const accentColor = t?.inputButtonColor || '#F97316'; // orange
  const suggBg = t?.quickSuggestionBgColor || '#ffffff';
  const suggText = t?.quickSuggestionTextColor || '#0f172a';
  // const accentColor = t?.inputButtonColor || '#DD692E';

  const hasUserMessages = messages.some(m => m.senderType === 'USER');
  const hasMultipleMessages = messages.length >= 2;

  const handleSpeak = async (id: string, content: string) => {
    if (activeSpeakingId === id && isPlaying) { stop(); setActiveSpeakingId(null); }
    else { setActiveSpeakingId(id); await speak(content); }
  };

  // ── Avatar ────────────────────────────────────────────────────────────────

  const ChatbotAvatar = ({ small = false }: { small?: boolean }) => (
    <div className={`shrink-0 flex flex-col items-center ${small ? '' : 'w-12'}`}>
      <Image
        src={chatbot.icon || '/icons/logo1.png'}
        height={small ? 32 : 50}
        width={small ? 32 : 50}
        alt={chatbot.name || 'Assistant'}
        className={`${small ? 'p-0.5' : 'p-1'} rounded-full bg-primary/10`}
      />
      {!small && (
        <span className="text-[10px] text-center break-words w-full leading-tight mt-1">
          {chatbot.name || 'Assistant'}
        </span>
      )}
    </div>
  );

  // ── Message bubble ────────────────────────────────────────────────────────

  const MessageBubble = ({
    message, isUser, index,
  }: { message: Message; isUser: boolean; index: number }) => {
    const id = `msg-${index}`;
    const isSpeaking = activeSpeakingId === id && isPlaying;

    return (
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && <ChatbotAvatar />}

        {/*
          min-w-0 lets the flex child shrink below its content width.
          max-w-[85%] caps the bubble so it never touches the edge.
        */}
        <div className={`relative group min-w-0 ${isUser ? 'ml-auto max-w-[85%]' : 'max-w-[85%]'}`}>
          <div
            className={[
              'rounded-2xl px-5 py-3.5 text-[14.5px] leading-relaxed',
              'transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
              isUser
                ? 'bg-black text-white rounded-tr-md shadow-[0_4px_16px_rgba(0,0,0,0.15)]'
                : 'bg-white border border-black/5 rounded-tl-md shadow-[0_4px_16px_rgba(0,0,0,0.05)]',
            ].join(' ')}
            style={{
              backgroundColor: isUser ? userBg : botBg,
              color: isUser ? userText : botText,
            }}
          >
            {/*
              Overflow guards for LLM HTML (source cards, flex rows, URLs, tables):
              - overflow-hidden + min-w-0         keep content inside the bubble
              - [&_*]:max-w-full                  every child respects parent width
              - [&_pre]:whitespace-pre-wrap        code blocks wrap
              - [&_a]:break-words                 long URLs wrap
              - [&_table]:overflow-x-auto         tables scroll horizontally
              - [&_div]:box-border               inline divs count padding in width
            */}
            <div
              className="prose prose-sm max-w-none text-[13px] overflow-hidden min-w-0 [&_*]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_a]:break-words [&_img]:h-auto [&_img]:block [&_table]:block [&_table]:overflow-x-auto [&_div]:box-border"
              style={{ color: isUser ? userText : botText }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
            />

            <div className="flex items-center justify-between mt-2 gap-4">
              {message.createdAt && (
                <div className="text-[10px] opacity-70">{formatTime(message.createdAt)}</div>
              )}
              {!isUser && (
                <button
                  onClick={() => handleSpeak(id, message.content)}
                  className={[
                    'p-1.5 rounded-full transition-all duration-200',
                    isSpeaking
                      ? 'bg-primary/20 text-primary scale-110'
                      : 'hover:bg-primary/10 text-muted-foreground opacity-0 group-hover:opacity-100',
                  ].join(' ')}
                  title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                >
                  {isSpeaking
                    ? <VolumeX className="h-3.5 w-3.5" />
                    : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Loading indicator ─────────────────────────────────────────────────────

  const LoadingDots = ({ text: label, small }: { text: string; small?: boolean }) => (
    <div className="flex items-center gap-3 animate-in fade-in">
      <ChatbotAvatar small={small} />
      <div className="bg-card border rounded-2xl rounded-tl-none p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {small ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium">{label}</p>
            </>
          ) : (
            <>
              <div className="flex space-x-1.5">
                {[0, 150, 300].map(delay => (
                  <div
                    key={delay}
                    className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent animate-pulse">
                {label}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Lead nudge card ───────────────────────────────────────────────────────

  const LeadCard = () => {
    const isCollecting = leadCollectionStatus === 'collecting' || leadCollectionStatus === 'submitting';
    if (leadCollectionStatus === 'done' || hasSubmittedLead) return null;

    return (
      <div className="flex justify-center animate-in fade-in zoom-in-95">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 w-full">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {isConversationalMode
                ? <MessageCircle className="h-5 w-5 text-primary" />
                : <UserPlus className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">
                {isCollecting ? 'Collecting your details…' : 'Ready to get started?'}
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                {isConversationalMode
                  ? isCollecting
                    ? 'Please answer the questions in the chat above.'
                    : "I'll ask you a few quick questions right here in the chat."
                  : "Share your details and we'll help you get the best solution."}
              </p>
              {!isCollecting && (
                <button
                  onClick={onLeadAction}
                  className="w-full py-2 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: accentColor, color: '#ffffff' }}
                >
                  {isConversationalMode
                    ? <><MessageCircle className="h-4 w-4" /> Start Chat Form</>
                    : <><CheckCircle2 className="h-4 w-4" /> Get Started Now</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /*
      overflow-x-hidden on the scroll container is the final safety net.
      Nothing can widen the list even if something escapes a bubble.
    */
    <div
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden bg-linear-to-b from-background to-muted/30 relative"
    >
      <div className="p-4 space-y-6">

        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            index={index}
            message={message}
            isUser={message.senderType === 'USER'}
          />
        ))}

        {/* Lead nudge card appears after the first full exchange */}
        {onLeadAction && hasMultipleMessages && !hasSubmittedLead && !loading && (
          <LeadCard />
        )}

        {loading && status === 'submitted' && <LoadingDots text="Thinking" />}
        {loading && status === 'streaming' && <LoadingDots text="Searching…" small />}

        {/* Quick suggestions — only shown before first user message */}
        {!hasUserMessages && quickQuestions.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onQuickQuestion(q)}
                disabled={loading}
                className="
          w-full
          py-3
          px-6
          rounded-full
          border-2
          border-black
          bg-white
          text-black
          text-sm
          font-medium
          transition-colors
          hover:bg-black
          hover:text-white
        "
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatInput
// ─────────────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  text: string;
  setText: (text: string) => void;
  loading: boolean;
  isMicrophoneOn: boolean;
  browserSupportsSpeechRecognition: boolean;
  onSubmit: (e?: React.FormEvent) => Promise<void>;
  onNewChat: () => void;
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onToggleMicrophone: () => void;
  hasLeadForm: boolean;
  onLeadAction: () => void;
  isLoadingLeadConfig: boolean;
  isAwaitingLeadAnswer: boolean;
  isConversationalMode: boolean;
  chatbot?: any;
}

function ChatInput({
  text, setText, loading, isMicrophoneOn, browserSupportsSpeechRecognition,
  onSubmit, onNewChat, status, inputRef, onToggleMicrophone,
  hasLeadForm, onLeadAction, isLoadingLeadConfig,
  isAwaitingLeadAnswer, isConversationalMode, chatbot,
}: ChatInputProps) {
  const accentColor = chatbot?.theme?.inputButtonColor || '#DD692E';
  const primaryLight = chatbot?.theme?.primaryLight || '#E6F4FF'; // light blue shell
  const inputBg = chatbot?.theme?.inputBgColor || '#FFF4E6'; // light orange
  const borderColor = chatbot?.theme?.borderColor || '#D6E4FF';
  const [showPicker, setShowPicker] = useState(false);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText(text + emojiData.emoji);
  };

  return (
    <div
      className="border-t px-4 py-4 shrink-0 relative transition-all duration-200"
      style={{
        backgroundColor: inputBg,
        borderColor: borderColor,
      }}
    >

      {/* 1. Responsive Picker Container */}
      {showPicker && (
        <div className="absolute bottom-full left-0 w-full z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col border-t bg-card shadow-2xl">

            {/* 2. Custom Picker Header with Close Option */}
            <div className="flex items-center justify-between p-2 border-b bg-muted/50">
              <span className="text-xs font-medium px-2">Select Emoji</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full"
                onClick={() => setShowPicker(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* 3. Dynamic Width/Height Picker */}
            <Picker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              width="100%"
              height="60vh"
              previewConfig={{ showPreview: false }} // Hides large emoji preview to save space
              skinTonesDisabled
              searchPlaceHolder="Search..."
            />
          </div>
        </div>
      )}

      <PromptInput
        onSubmit={async (e: React.FormEvent) => {
          e.preventDefault();
          // Ensure picker closes on message send
          setShowPicker(false);
          await onSubmit(e);
        }}
      >
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <PromptInputTextarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isAwaitingLeadAnswer ? 'Type your answer…' : 'Type your message here…'}
              disabled={loading || isMicrophoneOn}
              className="min-h-10 max-h-32 text-[14px] bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />

            <PromptInputToolbar>
              <PromptInputTools>
                {/* 4. Emoji Toggle - Added type="button" to prevent auto-submit */}
                <PromptInputButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPicker(!showPicker);
                  }}
                  className={showPicker ? 'bg-muted' : ''}
                >
                  <SmilePlus className="h-4 w-4" />
                </PromptInputButton>

                {/* Voice & Other Actions */}
                {browserSupportsSpeechRecognition && (
                  <PromptInputButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onToggleMicrophone}
                    className={isMicrophoneOn ? 'bg-destructive/10 text-destructive' : ''}
                  >
                    {isMicrophoneOn ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
                  </PromptInputButton>
                )}

                <PromptInputButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`rounded-full ${isMicrophoneOn
                    ? 'bg-red-100 text-red-600'
                    : 'hover:bg-gray-100'
                    }`}
                  onClick={onNewChat}
                >
                  <RefreshCw className="h-4 w-4" />
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </div>

          <PromptInputSubmit
            size="icon"
            disabled={(!text.trim() && !isMicrophoneOn) || loading}
            status={status}
            className="h-12 w-12 rounded-full m-1 shadow-lg hover:scale-105 transition-all"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </PromptInputSubmit>
        </div>
      </PromptInput>
    </div>
  );
}