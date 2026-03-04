// lib/langchain/search-chain.ts
import { searchSimilar } from '@/lib/langchain/vector-store';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { prisma } from '@/lib/prisma';

export interface SearchChainConfig {
  chatbotId: string;
  conversationId?: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  chatbot?: any;
  /**
   * BCP-47 language code (e.g. 'en', 'ja', 'hi', 'fr', 'es', 'ar').
   * The AI will always respond in this language regardless of what language
   * the knowledge-base content or system prompt is written in.
   * Defaults to 'en'.
   */
  language?: string;
}

export interface SearchChainResult {
  response: string;
  htmlResponse: string;
  knowledgeContext?: string;
  logicContext?: string;
  triggeredLogics?: any[];
  conversationId: string;
  sourcesUsed?: number;
  sourceUrls?: Array<{ title: string; url: string }>;
}

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? '',
});

// ─── Timer utility ────────────────────────────────────────────────────────────
function timer(label: string) {
  const start = Date.now();
  return {
    end: () => {
      const ms = Date.now() - start;
      console.log(`⏱️ [search-chain] ${label}: ${ms}ms`);
      return ms;
    }
  };
}

// ─── Language directive ───────────────────────────────────────────────────────
/**
 * Returns a hard language instruction that is prepended to every prompt.
 * Using BCP-47 names so the model can't misinterpret a bare code like "ar".
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese (日本語)',
  hi: 'Hindi (हिन्दी)',
  fr: 'French (Français)',
  es: 'Spanish (Español)',
  ar: 'Arabic (العربية)',
};

function languageDirective(language: string): string {
  const name = LANGUAGE_NAMES[language] ?? language;
  return `\
────────────────────────
LANGUAGE RULE (HIGHEST PRIORITY)
────────────────────────
You MUST respond exclusively in ${name}.
Do NOT switch languages for any reason — even if the source documents,
conversation history, or user message are in a different language.
All output HTML, labels, and prose must be in ${name}.

`;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
const QUERY_REWRITE_PROMPT = `
You are an expert search query optimizer for a semantic vector database.

Your task:
Generate 1-2 high-quality alternative search queries that improve retrieval coverage
while preserving the user's original intent exactly.

STRICT RULES:
- Do NOT change the meaning of the question
- Preserve all product names, brands, model numbers, and proper nouns
- Do NOT introduce new assumptions
- Each variation must target a different semantic angle (features, benefits, pricing, comparison, use case, etc.)
- 5-12 words per variation
- Avoid filler words

User question:
"{question}"

Output format (plain text, one per line, no numbering):
[variation]
[variation]
`;

const RAG_ANSWER_PROMPT = `
{languageDirective}
You are a domain-specific AI assistant.

You MUST answer using ONLY the provided CONTEXT.
You are strictly forbidden from adding external knowledge.

────────────────────────
CORE BEHAVIOR RULES
────────────────────────
1. Use ONLY facts explicitly present in the context.
2. If the answer is not fully available, clearly say what is missing.
3. If context is partially relevant, answer only the relevant portion.
4. If multiple chunks overlap, prioritize the highest relevance information.
5. If information conflicts, acknowledge the inconsistency.
6. Never fabricate URLs, pricing, features, policies, or claims.

────────────────────────
RESPONSE STYLE
────────────────────────
- Clear, structured, and easy to scan
- 2-5 concise paragraphs OR a short bullet list
- Professional, warm, confident tone
- No fluff, no repetition
- Lead with the most directly helpful information first

────────────────────────
HTML STRICT FORMAT
────────────────────────
- Wrap every paragraph in <p>
- Use <ul><li> for lists (no extra newlines)
- Use <strong> only for product names or critical terms
- No markdown
- No <br> tags
- Output compact HTML only

────────────────────────
CITATION RULES
────────────────────────
Each context chunk may include:
[Chunk X | Source: Page Title (https://example.com)]

When using information from a chunk with a URL:
- Add citation immediately after that sentence
- Format:
<cite data-url="FULL_URL">Page Title</cite>
- Place inside the same <p> or <li>
- Do NOT invent URLs
- Do NOT cite if no URL exists in label

────────────────────────
FOLLOW-UP RULE
────────────────────────
End with exactly ONE relevant next-step question.
Wrap it as:
<p class="follow-up-question">...</p>
This must be the final element.

────────────────────────
CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

USER QUESTION:
{question}

Return ONLY clean, compact HTML.
`;

const GENERAL_ANSWER_PROMPT = `
{languageDirective}
{systemPrompt}

You are responding in an ongoing conversation.

────────────────────────
BEHAVIOR RULES
────────────────────────
- Be helpful, natural, and solution-oriented
- If unsure, say so honestly
- If an action is available (from logicContext), introduce it naturally
- Do NOT be robotic or overly verbose
- Avoid generic filler responses

────────────────────────
RESPONSE FORMAT (STRICT)
────────────────────────
- Wrap paragraphs in <p>
- Use <ul><li> for lists (no extra spacing)
- Use <strong> sparingly for key terms
- No markdown
- No <br> tags
- Output compact HTML only

CONVERSATION HISTORY:
{history}

AVAILABLE ACTIONS:
{logicContext}

USER:
{question}

Return ONLY clean, compact HTML.
`;

// ─── rewriteQuery ─────────────────────────────────────────────────────────────
export async function rewriteQuery(userMessage: string): Promise<string[]> {
  if (userMessage.trim().split(/\s+/).length <= 5) {
    console.log('⚡ [rewriteQuery] short query — skipping rewrite, using original only');
    return [userMessage];
  }

  const t = timer('rewriteQuery (LLM call)');
  try {
    const { text } = await generateText({
      model: googleAI('gemini-2.5-flash'),
      prompt: QUERY_REWRITE_PROMPT.replace('{question}', userMessage),
      maxOutputTokens: 100,
      temperature: 0.3,
    });
    t.end();

    const variations = text
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(v => v.length > 0)
      .slice(0, 2);

    const queries = [userMessage, ...variations].slice(0, 2);
    console.log('🔄 Query variations:', queries);
    return queries;
  } catch (error) {
    t.end();
    console.error('Query rewrite error:', error);
    return [userMessage];
  }
}

// ─── searchKnowledgeBases ─────────────────────────────────────────────────────
export async function searchKnowledgeBases(
  chatbot: any,
  queries: string[]
): Promise<{
  context: string;
  sources: Array<{ title: string; url: string; score: number }>;
}> {
  if (!chatbot.knowledgeBases?.length) return { context: '', sources: [] };

  const tTotal = timer(`searchKnowledgeBases (${queries.length} queries × ${chatbot.knowledgeBases.length} KBs)`);

  const allResults: any[] = [];
  const seenContent = new Set<string>();
  const sourceUrls = new Map<string, { title: string; url: string; score: number }>();

  for (const query of queries) {
    for (const kb of chatbot.knowledgeBases) {
      const tKb = timer(`  KB "${kb.name}" query: "${query.substring(0, 30)}"`);
      try {
        const results = await searchSimilar({
          query,
          chatbotId: chatbot.id,
          knowledgeBaseId: kb.id,
          limit: 12,
          threshold: 0.3,
        });
        tKb.end();

        console.log(`📊 ${kb.name} (query: "${query}"): ${results.length} results`);
        if (results.length > 0) {
          const topScores = results.slice(0, 3).map(r => r.score.toFixed(3)).join(', ');
          console.log(`   Top scores: ${topScores}`);
        }

        for (const result of results) {
          const contentHash = result.content.substring(0, 100);
          if (!seenContent.has(contentHash)) {
            seenContent.add(contentHash);
            allResults.push({ ...result, kbName: kb.name, query });

            let sourceUrl = result.metadata?.source || result.metadata?.url;
            let sourceTitle = result.metadata?.title || result.metadata?.filename || kb.name;

            if (sourceUrl && (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'))) {
              const existingSource = sourceUrls.get(sourceUrl);
              if (!existingSource || result.score > existingSource.score) {
                sourceUrls.set(sourceUrl, { title: sourceTitle || 'Untitled Source', url: sourceUrl, score: result.score });
              }
            }
          }
        }
      } catch (error) {
        tKb.end();
        console.error(`❌ ${kb.name}:`, error);
      }
    }
  }

  if (!allResults.length) {
    tTotal.end();
    console.log('❌ No results found');
    return { context: '', sources: [] };
  }

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  const top = selectDiverseResults(allResults, 15);

  console.log(`✅ Selected ${top.length} diverse results for context`);
  console.log(`   Score range: ${top[0]?.score.toFixed(3)} - ${top[top.length - 1]?.score.toFixed(3)}`);

  const formatted = top.map((r, i) => {
    const scorePercent = (r.score * 100).toFixed(1);
    const source = r.metadata?.title || r.kbName || 'Knowledge Base';
    return `[Chunk ${i + 1} | Relevance: ${scorePercent}% | Source: ${source}]\n${r.content}`;
  }).join('\n\n---\n\n');

  const context = `KNOWLEDGE BASE CONTEXT:\n\n${formatted}\n\n(Total sources: ${top.length})`;

  const sources = Array.from(sourceUrls.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  tTotal.end();
  return { context, sources };
}

function selectDiverseResults(results: any[], limit: number): any[] {
  const selected: any[] = [];
  const keywords = new Set<string>();

  for (const result of results) {
    if (selected.length >= limit) break;
    const terms = result.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
    const newTerms = terms.filter((t: string) => !keywords.has(t));
    const novelty = newTerms.length / Math.max(terms.length, 1);

    if (result.score > 0.5 || novelty > 0.3 || selected.length < 5) {
      selected.push(result);
      newTerms.forEach((t: string) => keywords.add(t));
    }
  }

  return selected;
}

export function formatHistory(messages: any[]): string {
  if (!messages.length) return "This is the start of the conversation.";
  const recent = messages.slice(-6);
  return recent.map(m =>
    `${m.senderType === 'USER' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n');
}

export async function getLogicContext(chatbot: any, message: string, preloadedLogic?: any): Promise<string> {
  const t = timer('getLogicContext');
  let ctx = '';

  const chatbotLogic = preloadedLogic ?? await prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } });

  if (!chatbotLogic || !chatbotLogic.triggers) {
    t.end();
    return ctx;
  }

  try {
    const triggers = typeof chatbotLogic.triggers === 'string'
      ? JSON.parse(chatbotLogic.triggers)
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) { t.end(); return ctx; }

    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const feature = trigger.feature || trigger.type;
      const hasKeyword = keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()));

      if (hasKeyword) {
        switch (feature) {
          case 'linkButton':
          case 'LINK_BUTTON':
            let buttonText = 'this link';
            if (chatbotLogic.linkButtonConfig) {
              try {
                const linkConfig = JSON.parse(chatbotLogic.linkButtonConfig as string);
                buttonText = linkConfig.buttonText || 'this link';
              } catch (e) { console.error('Error parsing link button config:', e); }
            }
            ctx += `\nAVAILABLE ACTION: You can offer the user: "${buttonText}"\n`;
            break;
          case 'meetingSchedule':
          case 'SCHEDULE_MEETING':
            ctx += '\nAVAILABLE ACTION: You can offer to schedule a meeting with the user.\n';
            break;
          case 'leadCollection':
          case 'COLLECT_LEADS':
            ctx += '\nAVAILABLE ACTION: You can ask the user for their contact information.\n';
            break;
        }
      }
    }
  } catch (e) {
    console.error('Error parsing logic triggers:', e);
  }

  t.end();
  return ctx;
}

function generateSystemPrompt(chatbot: any): string {
  const base = chatbot.directive || "You are a helpful, knowledgeable assistant.";
  const personality = chatbot.description ? `\n\nYour personality: ${chatbot.description}` : "";
  const guidelines = `\n\nGuidelines:
- Be conversational and helpful
- Provide specific details when available
- If unsure, explicitly state: "I don't have that information available right now."
- Stay professional but friendly
- Format responses in HTML for better readability`;
  return `${base}${personality}${guidelines}`;
}

export async function checkLogicTriggers(chatbot: any, message: string, preloadedLogic?: any) {
  const t = timer('checkLogicTriggers');
  const triggered: any[] = [];

  const chatbotLogic = preloadedLogic ?? await prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } });

  if (!chatbotLogic || !chatbotLogic.triggers || !chatbotLogic.isActive) {
    t.end();
    return triggered;
  }

  try {
    const triggers = typeof chatbotLogic.triggers === 'string'
      ? JSON.parse(chatbotLogic.triggers)
      : chatbotLogic.triggers;
    if (!Array.isArray(triggers)) { t.end(); return triggered; }

    for (const trigger of triggers) {
      const keywords = trigger.keywords || [];
      const hasKeyword = keywords.some((k: string) => message.toLowerCase().includes(k.toLowerCase()));

      if (hasKeyword) {
        const logic: any = {
          id: chatbotLogic.id,
          chatbotId: chatbotLogic.chatbotId,
          type: trigger.feature?.toUpperCase() || trigger.type,
          triggerType: trigger.triggerType || 'KEYWORD',
          keywords: trigger.keywords || [],
          name: chatbotLogic.name,
          description: chatbotLogic.description,
          isActive: chatbotLogic.isActive,
          showAlways: trigger.showAlways || false,
          showAtEnd: trigger.showAtEnd || false,
          showOnButton: trigger.showOnButton || false,
          config: {}
        };

        switch (trigger.feature || trigger.type) {
          case 'linkButton':
          case 'LINK_BUTTON':
            if (chatbotLogic.linkButtonConfig) {
              try { logic.config = { linkButton: JSON.parse(chatbotLogic.linkButtonConfig as string) }; }
              catch (e) { console.error('Error parsing link button config:', e); }
            }
            break;
          case 'meetingSchedule':
          case 'SCHEDULE_MEETING':
            if (chatbotLogic.meetingScheduleConfig) {
              try { logic.config = { meetingSchedule: JSON.parse(chatbotLogic.meetingScheduleConfig as string) }; }
              catch (e) { console.error('Error parsing meeting schedule config:', e); }
            }
            break;
          case 'leadCollection':
          case 'COLLECT_LEADS':
            if (chatbotLogic.leadCollectionConfig) {
              try { logic.config = { leadCollection: JSON.parse(chatbotLogic.leadCollectionConfig as string) }; }
              catch (e) { console.error('Error parsing lead collection config:', e); }
            }
            break;
        }

        triggered.push(logic);
      }
    }
  } catch (e) {
    console.error('Error checking logic triggers:', e);
  }

  t.end();
  return triggered;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function cleanHtmlResponse(html: string): string {
  let cleaned = html;
  cleaned = cleaned.replace(/>\s+</g, '><');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/<\/p>/g, '</p>');
  cleaned = cleaned.replace(/<\/li>/g, '</li>');
  cleaned = cleaned.replace(/<\/ul>/g, '</ul>');
  cleaned = cleaned.replace(/<\/ol>/g, '</ol>');
  cleaned = cleaned.replace(/(<br\s*\/?>){2,}/gi, '<br>');
  cleaned = cleaned.replace(/^<br\s*\/?>/i, '');
  cleaned = cleaned.replace(/<br\s*\/?>$/i, '');
  cleaned = cleaned.replace(/<\/p><p>/g, '</p><p style="margin-top: 12px;">');
  cleaned = cleaned.replace(/<ul>/g, '<ul style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<ol>/g, '<ol style="margin: 12px 0; padding-left: 24px;">');
  cleaned = cleaned.replace(/<li>/g, '<li style="margin-bottom: 6px;">');
  cleaned = cleaned.replace(/^<p style="margin-top: 12px;">/, '<p>');

  cleaned = cleaned.replace(
    /<cite data-url="([^"]+)">([^<]+)<\/cite>/g,
    (_, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
      `style="display:inline-flex;align-items:center;gap:3px;color:#2563eb;` +
      `font-size:0.75em;font-weight:500;text-decoration:none;` +
      `background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;` +
      `padding:1px 5px;margin-left:3px;vertical-align:middle;white-space:nowrap;" ` +
      `title="${label}">` +
      `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="flex-shrink:0">` +
      `<path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` +
      `</svg>${label}</a>`
  );

  if (!cleaned.startsWith('<div') && !cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  } else if (cleaned.startsWith('<p')) {
    cleaned = `<div style="line-height: 1.6; color: #1f2937;">${cleaned}</div>`;
  }
  return cleaned;
}

function ensureHtmlFormat(text: string): string {
  if (/<[^>]+>/.test(text)) return text;

  const paragraphs = text.split('\n\n').filter(p => p.trim());
  return paragraphs.map(p => {
    if (p.includes('\n- ') || p.includes('\n• ')) {
      const lines = p.split('\n').filter(line => line.trim());
      const listItems = lines
        .filter(item => item.trim().startsWith('- ') || item.trim().startsWith('• '))
        .map(item => `<li style="margin-bottom: 6px;">${item.replace(/^[-•]\s*/, '').trim()}</li>`)
        .join('');
      return `<ul style="margin: 12px 0; padding-left: 24px;">${listItems}</ul>`;
    }
    return `<p style="margin-top: 12px;">${p.trim()}</p>`;
  }).join('');
}

function appendReadMoreSection(
  htmlResponse: string,
  sources: Array<{ title: string; url: string }>
): string {
  if (!sources.length) return htmlResponse;

  const inlineCiteUrls = new Set<string>();
  const citeRegex = /data-url="([^"]+)"/g;
  let match;
  while ((match = citeRegex.exec(htmlResponse)) !== null) {
    inlineCiteUrls.add(match[1]);
  }

  const allSourcesToShow = sources;

  const sourceItems = allSourcesToShow.map((source) => {
    let hostname = '';
    try { hostname = new URL(source.url).hostname.replace('www.', ''); } catch {}
    const isInline = inlineCiteUrls.has(source.url);

    return `<a href="${source.url}"
       target="_blank"
       rel="noopener noreferrer"
       style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1px solid ${isInline ? '#bfdbfe' : '#e2e8f0'};border-radius:8px;text-decoration:none;"
     >
      <span style="font-size:15px;flex-shrink:0">${isInline ? '🔵' : '🔗'}</span>
      <span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
        <span style="font-size:13px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${source.title}</span>
        ${hostname ? `<span style="font-size:11px;color:#94a3b8">${hostname}</span>` : ''}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;color:#94a3b8">
        <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </a>`;
  }).join('');

  const readMoreSection = `<div style="margin-top:20px;padding-top:16px;border-top:2px solid #f1f5f9">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#94a3b8;text-transform:uppercase;margin-bottom:10px">Sources</div>
  <div style="display:flex;flex-direction:column;gap:8px">${sourceItems}</div>
</div>`;

  return htmlResponse + readMoreSection;
}

type IntentType = 'GREETING' | 'FEATURE' | 'GENERAL';

function detectIntent(message: string): IntentType {
  const text = message.trim().toLowerCase();

  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening'];
  if (greetings.some(g => text === g || text.startsWith(g + ' '))) {
    return 'GREETING';
  }

  if (
    text.includes('feature') ||
    text.includes('pricing') ||
    text.includes('price') ||
    text.includes('how') ||
    text.includes('what') ||
    text.includes('does it')
  ) {
    return 'FEATURE';
  }

  return 'GENERAL';
}

// ─── generateRAGResponse ──────────────────────────────────────────────────────
export async function generateRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  preloadedChatbotLogic?: any,
  language = 'en'             // ← new param, safe default
): Promise<SearchChainResult> {
  console.group('🔍 generateRAGResponse');
  const tTotal = timer('generateRAGResponse [total]');

  const langDirective = languageDirective(language);

  // STEP 1: Parallel — history + query rewrite + chatbotLogic
  const tStep1 = timer('Step 1: history + rewriteQuery + chatbotLogic (parallel)');
  const [history, queries, chatbotLogic] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 6
    }),
    rewriteQuery(userMessage),
    preloadedChatbotLogic
      ? Promise.resolve(preloadedChatbotLogic)
      : prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } })
  ]);
  tStep1.end();

  const tLogicCtx = timer('getLogicContext (reusing prefetched logic)');
  const logicContext = await getLogicContext(chatbot, userMessage, chatbotLogic);
  tLogicCtx.end();

  const formattedHistory = formatHistory(history);

  let enrichedUserMessage = userMessage;
  const shortFollowUpPatterns = /^(why|how|pricing|cost|tell me more|more|what about that|and that|so)\b/i;

  if (
    history.length > 0 &&
    (userMessage.trim().length <= 18 || shortFollowUpPatterns.test(userMessage.trim()))
  ) {
    const lastAssistant = [...history].reverse().find(m => m.senderType === 'BOT');
    if (lastAssistant) {
      enrichedUserMessage = `
User follow-up question:
"${userMessage}"

This refers to the previous assistant response:
${lastAssistant.content}
`;
    }
  }

  const intent = detectIntent(userMessage);

  // ── GREETING FAST PATH ────────────────────────────────────────────────────
  if (intent === 'GREETING') {
    // For greetings we still want the correct language, so run a tiny LLM call
    // only if the language isn't English — otherwise use the static response.
    let greetingText: string;

    if (language === 'en') {
      greetingText = `<p>Hi there 👋 How can I help you today?</p>`;
    } else {
      const tGreeting = timer('greeting fast-path LLM (non-English)');
      try {
        const { text } = await generateText({
          model: googleAI('gemini-2.5-flash'),
          prompt: `${langDirective}Reply to a friendly greeting in one short sentence wrapped in a <p> tag. Output only the HTML.`,
          maxOutputTokens: 60,
          temperature: 0.5,
        });
        tGreeting.end();
        greetingText = text.trim() || `<p>👋</p>`;
      } catch {
        tGreeting.end();
        greetingText = `<p>👋</p>`;
      }
    }

    const htmlResponse = `<div style="line-height:1.6;color:#1f2937;">${greetingText}</div>`;
    tTotal.end();
    console.groupEnd();
    return {
      response: greetingText,
      htmlResponse,
      conversationId,
      knowledgeContext: '',
      logicContext: '',
      sourcesUsed: 0,
      sourceUrls: []
    };
  }

  // STEP 2: Vector search
  const tStep2 = timer(`Step 2: vector search (smart, ${chatbot.knowledgeBases?.length ?? 0} KBs)`);
  const tPhase2a = timer('  Phase 2a: original query search');
  const originalQuery = queries[0];
  const searchresults = (await Promise.all(
    chatbot.knowledgeBases.map((kb: any) =>
      searchSimilar({
        query: originalQuery,
        chatbotId: chatbot.id,
        knowledgeBaseId: kb.id,
        limit: 6,
        threshold: 0.3
      }).catch(err => {
        console.error(`KB ${kb.name} search failed:`, err);
        return [];
      })
    )
  )).flat();
  tPhase2a.end();

  const bestScore = searchresults.reduce((max, r) => Math.max(max, r.score ?? 0), 0);
  console.log(`   └─ ${searchresults.length} results, best score: ${bestScore.toFixed(3)}`);
  tStep2.end();

  const tProcess = timer('Step 2b: processSearchResults');
  const { context: knowledgeContext, sources } = processSearchResults(searchresults.flat(), chatbot);
  tProcess.end();

  console.log(`   └─ knowledgeContext length: ${knowledgeContext.length} chars, sources: ${sources.length}`);

  const strongContext = bestScore >= 0.45 && knowledgeContext.length > 0;

  // STEP 3: LLM generation — language directive injected into both prompt branches
  const prompt = strongContext
    ? RAG_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', enrichedUserMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', generateSystemPrompt(chatbot))
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', enrichedUserMessage);

  const tLLM = timer('Step 3: LLM generateText (gemini-2.5-flash)');
  const { text } = await generateText({
    model: googleAI('gemini-2.5-flash'),
    prompt,
    maxOutputTokens: chatbot.max_tokens || 400,
    temperature: chatbot.temperature ?? 0.82,
  });
  tLLM.end();

  console.log(`   └─ LLM output length: ${text.length} chars`);

  const tHtml = timer('Step 4: cleanHtml + appendReadMore');
  let cleaned = cleanHtmlResponse(ensureHtmlFormat(text));

  const isKnowledgeIntent = intent === 'FEATURE' || intent === 'GENERAL';
  const shortMessage = userMessage.trim().length < 20;
  const shouldShowSources = strongContext && isKnowledgeIntent && !shortMessage && cleaned.length > 120;

  const htmlResponse = shouldShowSources
    ? appendReadMoreSection(cleaned, sources)
    : cleaned;
  tHtml.end();

  tTotal.end();
  console.groupEnd();

  return {
    response: text,
    htmlResponse,
    knowledgeContext,
    logicContext,
    conversationId,
    sourcesUsed: sources.length,
    sourceUrls: sources
  };
}

function extractSourceUrl(r: any): { url: string; title: string } | null {
  const m = r.metadata || {};
  const url =
    m.source ||
    m.url ||
    m.link ||
    m.pageUrl ||
    r.source ||
    null;

  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return null;

  const title =
    m.title ||
    m.name ||
    m.filename ||
    m.page_title ||
    (() => {
      try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || '';
        const readable = path.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '');
        return readable
          ? `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`
          : u.hostname;
      } catch {
        return url;
      }
    })();

  return { url, title };
}

function processSearchResults(allResults: any[], chatbot: any) {
  const seen = new Set();
  const uniqueResults = allResults
    .filter(r => {
      const isDuplicate = seen.has(r.content.substring(0, 100));
      seen.add(r.content.substring(0, 100));
      return !isDuplicate;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const context = uniqueResults.map((r, i) => {
    const src = extractSourceUrl(r);
    const label = src?.title || r.metadata?.title || `Source ${i + 1}`;
    return `[${label}]\n${r.content}`;
  }).join('\n\n');

  const sourceMap = new Map<string, { title: string; url: string }>();
  for (const r of uniqueResults) {
    const src = extractSourceUrl(r);
    if (src && !sourceMap.has(src.url)) {
      sourceMap.set(src.url, src);
    }
  }
  const sources = Array.from(sourceMap.values()).slice(0, 5);

  if (uniqueResults.length > 0) {
    console.log('🔍 Sample result metadata:', JSON.stringify(uniqueResults[0]?.metadata, null, 2));
    console.log(`🔗 Sources found: ${sources.length}`, sources.map(s => s.url));
  }

  return { context, sources };
}

// ─── executeSearchChain ───────────────────────────────────────────────────────
export async function executeSearchChain(config: SearchChainConfig): Promise<SearchChainResult> {
  console.group('⛓️ executeSearchChain');
  const tTotal = timer('executeSearchChain [total]');

  const {
    chatbotId,
    conversationId,
    userMessage,
    chatbot: preloadedChatbot,
    language = 'en',  // ← destructure with default
  } = config;

  let chatbot = preloadedChatbot ?? null;
  if (!chatbot) {
    const tChatbot = timer('prisma: fetch chatbot + relations (no preload)');
    chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: { select: { id: true, name: true } },
        logic: true,
        form: true
      }
    });
    tChatbot.end();
  } else {
    console.log('✅ [executeSearchChain] using pre-fetched chatbot — skipped DB call');
  }

  if (!chatbot) throw new Error('Chatbot not found');

  const tConv = timer('prisma: find or create conversation');
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { chatbotId, title: userMessage.substring(0, 50) }
      });
    }
  } else {
    conversation = await prisma.conversation.create({
      data: { chatbotId, title: userMessage.substring(0, 50) }
    });
  }
  tConv.end();

  const tParallel = timer('prisma: store user message + fetch chatbotLogic (parallel)');
  const [, chatbotLogicRecord] = await Promise.all([
    prisma.message.create({
      data: { content: userMessage, senderType: 'USER', conversationId: conversation.id }
    }),
    prisma.chatbotLogic.findUnique({ where: { chatbotId } })
  ]);
  tParallel.end();

  const tLogic = timer('checkLogicTriggers (reusing prefetched logic)');
  const triggeredLogics = await checkLogicTriggers(chatbot, userMessage, chatbotLogicRecord);
  tLogic.end();

  const { response, htmlResponse, knowledgeContext, logicContext, sourcesUsed, sourceUrls } =
    await generateRAGResponse(
      chatbot,
      userMessage,
      conversation.id,
      chatbotLogicRecord,
      language  // ← forwarded
    );

  prisma.message.create({
    data: { content: htmlResponse, senderType: 'BOT', conversationId: conversation.id }
  }).then(() => {
    console.log('✅ [search-chain] bot message stored (background)');
  }).catch(err => {
    console.error('❌ Failed to store bot message:', err);
  });

  tTotal.end();
  console.groupEnd();

  return {
    response: htmlResponse,
    htmlResponse,
    knowledgeContext,
    logicContext,
    triggeredLogics,
    conversationId: conversation.id,
    sourcesUsed,
    sourceUrls
  };
}

// ─── simpleSearch ─────────────────────────────────────────────────────────────
export async function simpleSearch(
  chatbotId: string,
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    includeKnowledgeBaseNames?: boolean;
  }
): Promise<Array<{ content: string; score: number; metadata?: any; kbName?: string }>> {
  const t = timer('simpleSearch [total]');

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    include: { knowledgeBases: true }
  });
  if (!chatbot) throw new Error('Chatbot not found');

  const allResults: any[] = [];
  const seenContent = new Set<string>();

  for (const kb of chatbot.knowledgeBases || []) {
    const tKb = timer(`  simpleSearch KB: "${kb.name}"`);
    try {
      const results = await searchSimilar({
        query,
        chatbotId: chatbot.id,
        knowledgeBaseId: kb.id,
        limit: options?.limit || 8,
        threshold: options?.threshold || 0.3,
      });
      tKb.end();

      for (const result of results) {
        const contentHash = result.content.substring(0, 100);
        if (!seenContent.has(contentHash)) {
          seenContent.add(contentHash);
          allResults.push(options?.includeKnowledgeBaseNames ? { ...result, kbName: kb.name } : result);
        }
      }
    } catch (error) {
      tKb.end();
      console.error(`Knowledge base ${kb.name} search error:`, error);
    }
  }

  allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
  t.end();
  return allResults.slice(0, options?.limit || 10);
}

// ─── streamRAGResponse ────────────────────────────────────────────────────────
export async function streamRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  onChunk?: (chunk: string) => void,
  language = 'en'   // ← new param, safe default
): Promise<ReadableStream<string>> {
  console.group('🌊 streamRAGResponse');
  const tTotal = timer('streamRAGResponse setup [total before stream starts]');

  const langDirective = languageDirective(language);

  const tHistory = timer('prisma: fetch recent history');
  const history = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
    },
    orderBy: { createdAt: 'asc' },
    take: 10
  });
  tHistory.end();

  const formattedHistory = formatHistory(history);
  const intent = detectIntent(userMessage);

  // ── GREETING FAST PATH ────────────────────────────────────────────────────
  if (intent === 'GREETING') {
    let greetingText: string;

    if (language === 'en') {
      greetingText = `<p>Hi there 👋 How can I help you today?</p>`;
    } else {
      try {
        const { text } = await generateText({
          model: googleAI('gemini-2.5-flash'),
          prompt: `${langDirective}Reply to a friendly greeting in one short sentence wrapped in a <p> tag. Output only the HTML.`,
          maxOutputTokens: 60,
          temperature: 0.5,
        });
        greetingText = text.trim() || `<p>👋</p>`;
      } catch {
        greetingText = `<p>👋</p>`;
      }
    }

    tTotal.end();
    console.groupEnd();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(greetingText);
        controller.close();
      }
    });
  }

  const tRewrite = timer('rewriteQuery');
  const queries = await rewriteQuery(userMessage);
  tRewrite.end();

  const tSearch = timer('searchKnowledgeBases');
  const { context: knowledgeContext, sources } = await searchKnowledgeBases(chatbot, queries);
  tSearch.end();

  const tLogic = timer('getLogicContext');
  const logicContext = await getLogicContext(chatbot, userMessage);
  tLogic.end();

  // Language directive injected into both prompt branches
  const prompt = knowledgeContext
    ? RAG_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{context}', knowledgeContext)
        .replace('{history}', formattedHistory)
        .replace('{question}', userMessage)
    : GENERAL_ANSWER_PROMPT
        .replace('{languageDirective}', langDirective)
        .replace('{systemPrompt}', generateSystemPrompt(chatbot))
        .replace('{history}', formattedHistory)
        .replace('{logicContext}', logicContext)
        .replace('{question}', userMessage);

  const tStreamInit = timer('streamText init (LLM call start)');
  const result = await streamText({
    model: googleAI('gemini-2.5-flash'),
    prompt,
    maxOutputTokens: chatbot.max_tokens || 400,
    temperature: chatbot.temperature ?? 0.82,
  });
  tStreamInit.end();

  tTotal.end();
  console.log('📡 Stream open — chunks will arrive asynchronously');
  console.groupEnd();

  let fullText = '';
  let chunkCount = 0;
  const tStreamRead = timer('streamRAGResponse: reading all chunks');

  const stream = new ReadableStream<string>({
    async start(controller) {
      for await (const chunk of result.textStream) {
        chunkCount++;
        fullText += chunk;
        controller.enqueue(chunk);
        onChunk?.(chunk);
      }

      tStreamRead.end();
      console.log(`   └─ chunks: ${chunkCount}, total chars: ${fullText.length}`);

      const tPersist = timer('streamRAGResponse: persist bot message to DB');
      const htmlResponse = cleanHtmlResponse(ensureHtmlFormat(fullText));
      const finalHtml = sources.length > 0
        ? appendReadMoreSection(htmlResponse, sources)
        : htmlResponse;

      await prisma.message.create({
        data: { content: finalHtml, senderType: 'BOT', conversationId }
      });
      tPersist.end();

      controller.close();
    }
  });

  return stream;
}