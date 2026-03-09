'use client';
import Image from 'next/image';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
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
  ChevronDown,
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
// i18n — isolated instance (won't collide with your app's i18n)
// ─────────────────────────────────────────────────────────────────────────────

const chatbotI18n = i18n.createInstance();

chatbotI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        online: 'Online • Typically replies instantly',
        thinking: 'Thinking',
        searching: 'Searching…',
        quickSuggestions: 'Quick suggestions',
        typeMessage: 'Type your message here…',
        typeAnswer: 'Type your answer…',
        readyToStart: 'Ready to get started?',
        collectingDetails: 'Collecting your details…',
        shareDetails: "Share your details and we'll help you get the best solution.",
        askQuestions: "I'll ask you a few quick questions right here in the chat.",
        answerAbove: 'Please answer the questions in the chat above.',
        startChatForm: 'Start Chat Form',
        getStarted: 'Get Started Now',
        selectEmoji: 'Select Emoji',
        search: 'Search...',
        poweredBy: 'Powered by',
        openChat: 'Open chatbot',
        closeChat: 'Close chat',
        live: 'Live',
      },
    },
    ja: {
      translation: {
        online: 'オンライン • すぐに返信します',
        thinking: '考え中',
        searching: '検索中…',
        quickSuggestions: 'クイック提案',
        typeMessage: 'メッセージを入力してください…',
        typeAnswer: '回答を入力してください…',
        readyToStart: '始める準備はできていますか？',
        collectingDetails: '詳細を収集中…',
        shareDetails: '詳細を共有してください。最適なソリューションを提供します。',
        askQuestions: 'チャットでいくつか質問させていただきます。',
        answerAbove: '上のチャットの質問に答えてください。',
        startChatForm: 'チャットフォームを開始',
        getStarted: '今すぐ始める',
        selectEmoji: '絵文字を選択',
        search: '検索...',
        poweredBy: 'Powered by',
        openChat: 'チャットを開く',
        closeChat: 'チャットを閉じる',
        live: 'ライブ',
      },
    },
    hi: {
      translation: {
        online: 'ऑनलाइन • तुरंत जवाब देता है',
        thinking: 'सोच रहा है',
        searching: 'खोज रहा है…',
        quickSuggestions: 'त्वरित सुझाव',
        typeMessage: 'यहाँ अपना संदेश लिखें…',
        typeAnswer: 'अपना उत्तर लिखें…',
        readyToStart: 'शुरू करने के लिए तैयार हैं?',
        collectingDetails: 'विवरण एकत्र हो रहा है…',
        shareDetails: 'अपना विवरण साझा करें और हम आपको सर्वोत्तम समाधान दिलाएंगे।',
        askQuestions: 'मैं यहीं चैट में कुछ त्वरित प्रश्न पूछूंगा।',
        answerAbove: 'कृपया ऊपर चैट के प्रश्नों का उत्तर दें।',
        startChatForm: 'चैट फॉर्म शुरू करें',
        getStarted: 'अभी शुरू करें',
        selectEmoji: 'इमोजी चुनें',
        search: 'खोजें...',
        poweredBy: 'Powered by',
        openChat: 'चैट खोलें',
        closeChat: 'चैट बंद करें',
        live: 'लाइव',
      },
    },
    fr: {
      translation: {
        online: 'En ligne • Répond instantanément',
        thinking: 'En train de réfléchir',
        searching: 'Recherche…',
        quickSuggestions: 'Suggestions rapides',
        typeMessage: 'Tapez votre message ici…',
        typeAnswer: 'Tapez votre réponse…',
        readyToStart: 'Prêt à commencer ?',
        collectingDetails: 'Collecte de vos informations…',
        shareDetails: 'Partagez vos coordonnées et nous vous aiderons à trouver la meilleure solution.',
        askQuestions: 'Je vais vous poser quelques questions rapides ici dans le chat.',
        answerAbove: 'Veuillez répondre aux questions dans le chat ci-dessus.',
        startChatForm: 'Démarrer le formulaire de chat',
        getStarted: 'Commencer maintenant',
        selectEmoji: 'Sélectionner un emoji',
        search: 'Rechercher...',
        poweredBy: 'Propulsé par',
        openChat: 'Ouvrir le chat',
        closeChat: 'Fermer le chat',
        live: 'En direct',
      },
    },
    es: {
      translation: {
        online: 'En línea • Responde al instante',
        thinking: 'Pensando',
        searching: 'Buscando…',
        quickSuggestions: 'Sugerencias rápidas',
        typeMessage: 'Escribe tu mensaje aquí…',
        typeAnswer: 'Escribe tu respuesta…',
        readyToStart: '¿Listo para empezar?',
        collectingDetails: 'Recopilando tus datos…',
        shareDetails: 'Comparte tus datos y te ayudaremos a encontrar la mejor solución.',
        askQuestions: 'Te haré algunas preguntas rápidas aquí en el chat.',
        answerAbove: 'Por favor responde las preguntas en el chat de arriba.',
        startChatForm: 'Iniciar formulario de chat',
        getStarted: 'Empezar ahora',
        selectEmoji: 'Seleccionar emoji',
        search: 'Buscar...',
        poweredBy: 'Desarrollado por',
        openChat: 'Abrir chat',
        closeChat: 'Cerrar chat',
        live: 'En vivo',
      },
    },
    ar: {
      translation: {
        online: 'متصل • يرد فورًا',
        thinking: 'يفكر',
        searching: 'يبحث…',
        quickSuggestions: 'اقتراحات سريعة',
        typeMessage: 'اكتب رسالتك هنا…',
        typeAnswer: 'اكتب إجابتك…',
        readyToStart: 'هل أنت مستعد للبدء؟',
        collectingDetails: 'جاري جمع بياناتك…',
        shareDetails: 'شارك بياناتك وسنساعدك في الحصول على أفضل حل.',
        askQuestions: 'سأطرح عليك بعض الأسئلة السريعة هنا في الدردشة.',
        answerAbove: 'يرجى الإجابة على الأسئلة في الدردشة أعلاه.',
        startChatForm: 'بدء نموذج الدردشة',
        getStarted: 'ابدأ الآن',
        selectEmoji: 'اختر رمزًا تعبيريًا',
        search: 'بحث...',
        poweredBy: 'مدعوم من',
        openChat: 'فتح الدردشة',
        closeChat: 'إغلاق الدردشة',
        live: 'مباشر',
      },
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChatbotWidgetProps {
  chatbotId: string;
  initialChatbotData?: any;
  /** Called whenever the user picks a new language; send this to your backend */
  onLanguageChange?: (languageCode: string) => void;
}

const LANGUAGES = [
  { name: 'English', code: 'en', img: '/flags/en.svg', dir: 'ltr' },
  { name: '日本語', code: 'ja', img: '/flags/ja.svg', dir: 'ltr' },
  { name: 'हिन्दी', code: 'hi', img: '/flags/hi.svg', dir: 'ltr' },
  { name: 'Français', code: 'fr', img: '/flags/fr.svg', dir: 'ltr' },
  { name: 'Español', code: 'es', img: '/flags/es.svg', dir: 'ltr' },
  { name: 'العربية', code: 'ar', img: '/flags/ar.svg', dir: 'rtl' },
] as const;

type LanguageCode = typeof LANGUAGES[number]['code'];

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

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
// LanguageSelector
// ─────────────────────────────────────────────────────────────────────────────

function LanguageSelector({
  currentLang,
  onChange,
}: {
  currentLang: LanguageCode;
  onChange: (code: LanguageCode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = LANGUAGES.find(l => l.code === currentLang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const DROPDOWN_HEIGHT = LANGUAGES.length * 44;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceAbove > DROPDOWN_HEIGHT || spaceAbove > spaceBelow;

    setDropdownStyle(
      openUpward
        ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, zIndex: 99999 }
        : { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 99999 }
    );
  }, [open]);

  const dropdownEl = open ? (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setOpen(false)} />
      <div
        style={dropdownStyle}
        className="bg-popover border border-border rounded-xl shadow-2xl overflow-hidden w-44 animate-in fade-in zoom-in-95"
      >
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            type="button"
            onClick={() => { onChange(lang.code as LanguageCode); setOpen(false); }}
            className={[
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left cursor-pointer',
              lang.code === currentLang
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground',
            ].join(' ')}
          >
            <Image src={lang.img} width={18} height={14} alt={lang.name} className="rounded-sm object-cover shrink-0" unoptimized />
            <span>{lang.name}</span>
            {lang.code === currentLang && (
              <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
            )}
          </button>
        ))}
      </div>
    </>
  ) : null;

  return (
    <div className="relative m-2 hover:bg-muted transition-colors">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-4 w-4 flex items-center justify-center aspect-square rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Select language"
      >
        <Image
          fill
          src={current.img}
          alt={current.name}
          className="rounded-full object-cover"
          unoptimized
        />
        <span className="hidden">{current.name}</span>
      </button>

      {typeof document !== 'undefined' && dropdownEl
        ? createPortal(dropdownEl, document.body)
        : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatbotWidget — root export
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatbotWidget({ chatbotId, initialChatbotData, onLanguageChange }: ChatbotWidgetProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [liveTheme, setLiveTheme] = useState<any>(null);
  const [selectedLang, setSelectedLang] = useState<LanguageCode>('en');

  const handleLanguageChange = (code: LanguageCode) => {
    setSelectedLang(code);
    chatbotI18n.changeLanguage(code);
    onLanguageChange?.(code);
  };

  // ── Lead generation ───────────────────────────────────────────────────────
  const {
    activeLeadForm,
    isLeadFormVisible,
    shouldShowLeadForm,
    isLoadingLeadConfig,
    hasSubmittedLead,
    conversationalLeadConfig,
    isConversationalMode,
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
    language: selectedLang,
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
      selectedLang={selectedLang}
      onLanguageChange={handleLanguageChange}
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
  selectedLang: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
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
  selectedLang, onLanguageChange,
}: ChatBotProps) {
  const { t } = useTranslation('translation', { i18n: chatbotI18n });
  const [isOpen, setIsOpen] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isEmbedded = typeof window !== 'undefined' && window.self !== window.top;
  const isDashboardPreview =
    typeof window !== 'undefined' &&
    window.location.pathname.includes('/chatbots/');

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

  const micAllowed =
    browserSupportsSpeechRecognition &&
    !policyBlocked &&
    (
      isDashboardPreview // ✅ ignore parent mic restriction in dashboard
        ? true
        : (!parentPolicyInfo?.blocked &&
          parentPolicyInfo?.permission !== 'denied')
    );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const blocked = params.get('parent_policy_blocked');
      const permission = params.get('parent_permission');
      if (blocked === 'true' || permission === 'denied') {
        setParentPolicyInfo({ blocked: blocked === 'true', permission: permission || undefined });
      }
    } catch (e) { /* ignore */ }
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

  // Get RTL direction for current language
  const currentLangMeta = LANGUAGES.find(l => l.code === selectedLang);
  const dir = currentLangMeta?.dir ?? 'ltr';

  // ── Intern's shell sizing/color approach ──────────────────────────────────
  const primaryLight = chatbot.theme?.primaryLight || '#E6F0FF';
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
    <div className={positionClass} dir={dir}>

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
            closeLabel={t('closeChat')}
            liveLabel={t('live')}
          />

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
            t={t}
          />

          {error && !isDashboardPreview && (
            <ErrorBanner error={error} />
          )}

          <ChatInput
            text={text}
            setText={setText}
            loading={loading}
            isMicrophoneOn={isMicrophoneOn}
            browserSupportsSpeechRecognition={micAllowed}
            onSubmit={handleSubmit}
            onNewChat={handleNewChat}
            status={status}
            inputRef={inputRef}
            onToggleMicrophone={() => {
              if (micAllowed) {
                setIsMicrophoneOn(p => !p);
              }
            }}
            hasLeadForm={!hasSubmittedLead && !!activeLeadForm}
            onLeadAction={handleLeadAction}
            isLoadingLeadConfig={isLoadingLeadConfig}
            isAwaitingLeadAnswer={isAwaitingLeadAnswer}
            isConversationalMode={isConversationalMode}
            chatbot={chatbot}
            selectedLang={selectedLang}
            onLanguageChange={onLanguageChange}
            t={t}
          />

          <div className="flex items-center justify-end gap-1.5 p-1 mr-4">
            <span className="text-xs font-medium tracking-wide text-gray-400 lowercase">
              {t('poweredBy')}
            </span>
            <Link target="_blank" rel="noopener noreferrer" href='https://prabisha.com/' className="cursor-pointer text-sm font-bold text-[#1320AA] hover:text-[#1320AA] transition-colors">
              Prabisha
            </Link>
          </div>
        </div>
      ) : (
        !isEmbedded && !isMobile && (
          <ChatToggleButton onClick={() => setIsOpen(true)} chatbot={chatbot} openLabel={t('openChat')} />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatHeader — intern's redesigned version + i18n labels
// ─────────────────────────────────────────────────────────────────────────────

function ChatHeader({
  onClose,
  chatbot,
  isMobile,
  isEmbedded,
  closeLabel,
  liveLabel,
}: {
  onClose: () => void;
  chatbot: any;
  isMobile?: boolean;
  isEmbedded?: boolean;
  closeLabel: string;
  liveLabel: string;
}) {
  const headerBg = chatbot?.theme?.primaryColor || '#111CA8';
  const headerText = chatbot?.theme?.headerTextColor || '#ffffff';
  const accentColor = chatbot?.theme?.inputButtonColor || '#DF6A2E';

  return (
    <div
      className={[
        'flex items-center justify-between px-5 py-4 border-b border-black/10',
        isMobile || isEmbedded ? 'rounded-none' : 'rounded-t-2xl',
      ].join(' ')}
      style={{ backgroundColor: headerBg, color: headerText }}
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
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold truncate">
              {chatbot.name || 'Customer Support'}
            </h3>
            {/* Live Indicator */}
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50"
                  style={{ animation: 'softPulse 2s ease-in-out infinite' }}
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              </span>
              <span className="text-xs font-semibold truncate tracking-wide">
                {liveLabel}
              </span>
              <style jsx>{`
                @keyframes softPulse {
                  0%   { transform: scale(1);   opacity: 0.5; }
                  50%  { transform: scale(1.8); opacity: 0.2; }
                  100% { transform: scale(1);   opacity: 0.5; }
                }
              `}</style>
            </span>
          </div>
          <p className="text-xs font-semibold truncate mt-0.5" style={{ color: accentColor }}>
            {chatbot.description || 'Typically replies instantly'}
          </p>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="h-9 w-9 rounded-full bg-[#DF6A2E] text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
        aria-label={closeLabel}
      >
        <XIcon size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatToggleButton
// ─────────────────────────────────────────────────────────────────────────────

function ChatToggleButton({ onClick, chatbot, openLabel }: { onClick: () => void; chatbot: any; openLabel: string }) {
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
      aria-label={openLabel}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: chatbot.theme?.widgetBgColor || '#FFFFFF',
        border: `3px solid ${chatbot.theme?.widgetColor || '#111CA8'}`,
      }}
    >
      <Image
        src={chatbot.avatar || chatbot.icon || '/character1.png'}
        height={size} width={size}
        alt={chatbot.name || 'Chat'}
        className="rounded-full w-full h-full object-contain"
      />
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
  t: (key: string) => string;
}

function ChatMessages({
  messages, loading, status, quickQuestions, onQuickQuestion,
  chatContainerRef, messagesEndRef, formatTime, chatbot,
  hasSubmittedLead, isConversationalMode, leadCollectionStatus, onLeadAction, t,
}: ChatMessagesProps) {
  const { speak, stop, isPlaying } = useTextToSpeech();
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const th = chatbot.theme;
  const botBg = th?.botMessageBgColor || '#FFFFFF';
  const botText = th?.botMessageTextColor || '#1E293B';
  const userBg = th?.userMessageBgColor || '#111CA8';
  const userText = th?.userMessageTextColor || '#ffffff';
  const accentColor = th?.inputButtonColor || '#DF6A2E';

  const hasUserMessages = messages.some(m => m.senderType === 'USER');
  const hasMultipleMessages = messages.length >= 2;

  const handleSpeak = async (id: string, content: string) => {
    if (activeSpeakingId === id && isPlaying) { stop(); setActiveSpeakingId(null); }
    else { setActiveSpeakingId(id); await speak(content); }
  };

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

  const MessageBubble = ({
    message, isUser, index,
  }: { message: Message; isUser: boolean; index: number }) => {
    const id = `msg-${index}`;
    const isSpeaking = activeSpeakingId === id && isPlaying;

    return (
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && <ChatbotAvatar />}
        <div className={`relative group min-w-0 ${isUser ? 'ml-auto max-w-[85%]' : 'max-w-[85%]'}`}>
          <div
            className={[
              'rounded-2xl px-5 py-3.5 text-[14.5px] leading-relaxed',
              'transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
              isUser
                ? 'rounded-tr-md shadow-[0_4px_16px_rgba(0,0,0,0.15)]'
                : 'border border-black/5 rounded-tl-md shadow-[0_4px_16px_rgba(0,0,0,0.05)]',
            ].join(' ')}
            style={{
              backgroundColor: isUser ? userBg : botBg,
              color: isUser ? userText : botText,
            }}
          >
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
                    'p-1.5 rounded-full transition-all duration-200 cursor-pointer',
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
                {isCollecting ? t('collectingDetails') : t('readyToStart')}
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                {isConversationalMode
                  ? isCollecting ? t('answerAbove') : t('askQuestions')
                  : t('shareDetails')}
              </p>
              {!isCollecting && (
                <button
                  onClick={onLeadAction}
                  className="w-full py-2 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: accentColor, color: '#ffffff' }}
                >
                  {isConversationalMode
                    ? <><MessageCircle className="h-4 w-4" /> {t('startChatForm')}</>
                    : <><CheckCircle2 className="h-4 w-4" /> {t('getStarted')}</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
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

        {onLeadAction && hasMultipleMessages && !hasSubmittedLead && !loading && (
          <LeadCard />
        )}

        {loading && status === 'submitted' && <LoadingDots text={t('thinking')} />}
        {loading && status === 'streaming' && <LoadingDots text={t('searching')} small />}

        {/* Quick suggestions — intern's pill style, with i18n disabled label */}
        {!hasUserMessages && (
          <div className="mt-6 flex flex-col gap-3">
            {(quickQuestions.length > 0
              ? quickQuestions
              : [
                "What services do you offer?",
                "How can I contact support?",
                "How does the AI avatar work?",
                "How do I get started?"
              ]
            ).map((q, i) => (
              <button
                key={i}
                onClick={() => onQuickQuestion(q)}
                disabled={loading}
                className="w-full py-3 px-6 rounded-full border-2 border-black bg-white text-black text-sm font-medium transition-colors hover:bg-black hover:text-white disabled:opacity-50 cursor-pointer"
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
// ChatInput — intern's styling + your LanguageSelector & i18n
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
  selectedLang: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  t: (key: string) => string;
}

function ChatInput({
  text, setText, loading, isMicrophoneOn, browserSupportsSpeechRecognition,
  onSubmit, onNewChat, status, inputRef, onToggleMicrophone,
  hasLeadForm, onLeadAction, isLoadingLeadConfig,
  isAwaitingLeadAnswer, isConversationalMode, chatbot,
  selectedLang, onLanguageChange, t,
}: ChatInputProps) {
  const accentColor = chatbot?.theme?.inputButtonColor || '#DD692E';
  const inputBg = chatbot?.theme?.inputBgColor || '#FFF4E6';
  const borderColor = chatbot?.theme?.borderColor || '#D6E4FF';
  const [showPicker, setShowPicker] = useState(false);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText(text + emojiData.emoji);
  };

  return (
    <div
      className="border-t px-4 py-4 shrink-0 relative transition-all duration-200"
      style={{ backgroundColor: inputBg, borderColor }}
    >
      {/* Emoji picker */}
      {showPicker && (
        <div className="absolute bottom-full left-0 w-full z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col border-t bg-card shadow-2xl">
            <div className="flex items-center justify-between p-2 border-b bg-muted/50">
              <span className="text-xs font-medium px-2">{t('selectEmoji')}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full cursor-pointer"
                onClick={() => setShowPicker(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            <Picker
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              width="100%"
              height="60vh"
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
              searchPlaceHolder={t('search')}
            />
          </div>
        </div>
      )}

      <PromptInput
        onSubmit={async (e: React.FormEvent) => {
          e.preventDefault();
          setShowPicker(false);
          await onSubmit(e);
        }}
      >
        <div className="flex items-stretch gap-2 w-full">
          <div className="flex flex-col flex-1 min-w-0 w-full">
            <PromptInputTextarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isAwaitingLeadAnswer ? t('typeAnswer') : t('typeMessage')}
              disabled={loading || isMicrophoneOn}
              className="min-h-10 max-h-32 w-full text-[14px] bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2 resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />

            <PromptInputToolbar>
              <PromptInputTools>
                {/* Emoji toggle */}
                <PromptInputButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPicker(!showPicker);
                  }}
                 className={`${showPicker ? 'bg-muted' : ''} cursor-pointer`}
                >
                  <SmilePlus className="h-4 w-4" />
                </PromptInputButton>

                {/* Microphone */}
                {browserSupportsSpeechRecognition && (
                  <PromptInputButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={onToggleMicrophone}
                  className={`cursor-pointer ${isMicrophoneOn ? 'bg-destructive/10 text-destructive' : ''}`}
                  >
                    {isMicrophoneOn ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
                  </PromptInputButton>
                )}

                {/* New chat */}
                <PromptInputButton
                  type="button"
                  size="sm"
                  variant="ghost"
                 className={`rounded-full cursor-pointer ${isMicrophoneOn ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'}`}
                  onClick={onNewChat}
                >
                  <RefreshCw className="h-4 w-4" />
                </PromptInputButton>

                {/* Language selector */}
                <LanguageSelector
                  currentLang={selectedLang}
                  onChange={onLanguageChange}
                />
              </PromptInputTools>
            </PromptInputToolbar>
          </div>

          <PromptInputSubmit
            size="icon"
            disabled={(!text.trim() && !isMicrophoneOn) || loading}
            status={status}
            className="h-12 w-12 shrink-0 rounded-full m-1 shadow-lg hover:scale-105 transition-all"
            style={{ backgroundColor: accentColor, color: '#ffffff' }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </PromptInputSubmit>
        </div>
      </PromptInput>
    </div>
  );
}



