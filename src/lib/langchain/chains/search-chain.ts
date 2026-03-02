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
  chatbot?: any; // ← pass pre-fetched chatbot to avoid double DB hit
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

// ─── Intent Detection ─────────────────────────────────────────────────────────
type DetectedIntent =
  | 'GREETING'
  | 'PRICING'
  | 'OBJECTION'
  | 'FEATURE'
  | 'BUYING'
  | 'GENERAL';

 function detectIntent(message: string): DetectedIntent {
  const msg = message.toLowerCase().trim();

  // Greetings & small talk
  if (/(^|\b)(hi|hello|hey|good morning|good evening|good afternoon)\b/.test(msg))
    return 'GREETING';

  if (/(how are you|what's up|how's it going)/.test(msg))
    return 'GREETING';

  // Pricing
  if (/(price|cost|pricing|how much|plans?)/.test(msg))
    return 'PRICING';

  // Objections / comparisons
  if (/(why should|why you|better than|different from|compare|vs\b)/.test(msg))
    return 'OBJECTION';

  // Feature / how it works
  if (/(integrate|integration|how does|how it works|features?|capabilities)/.test(msg))
    return 'FEATURE';

  // Buying intent
  if (/(sign up|get started|start now|book demo|schedule|trial)/.test(msg))
    return 'BUYING';

  return 'GENERAL';
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
const QUERY_REWRITE_PROMPT = `
You are a semantic retrieval strategist for a modern SaaS AI system.

Your task:
Generate up to 2 alternative search queries that improve knowledge retrieval
while preserving the user's exact intent.

STRICT RULES:
- Do NOT change meaning
- Preserve product names, brands, and proper nouns
- Do NOT introduce new assumptions
- Each variation must explore a different angle (features, pricing, use case, comparison, problem)
- 5-12 words each
- No filler words
- No explanations

User question:
"{question}"

Output format:
One variation per line
No numbering
No extra text
`;
const RAG_ANSWER_PROMPT = `
You are a senior AI product advisor at a modern SaaS company.

You speak like a real human founder — calm, confident, precise.
Never sound robotic. Never sound scripted.

You MUST answer using ONLY the provided CONTEXT.
You are strictly forbidden from adding external knowledge.

Detected user intent: {intent}

────────────────────────
BEHAVIOR RULES
────────────────────────
• Greeting → short, warm, natural (1-2 sentences max)
• Pricing → direct and transparent
• Objection → acknowledge concern calmly, explain differentiator clearly, avoid vague marketing claims, be specific
• Feature question → structured explanation
• Buying intent → guide next step naturally
• Vague question → ask one smart clarification

Never use:
- "industry leading"
- "cutting-edge"
- "thousands of satisfied clients"
Unless explicitly present in context.

If specific information is not available:
- Acknowledge naturally
- Offer clarification
- Or guide toward the next step
Never abruptly shut down the conversation.
Never reject greetings or small talk.

Do NOT say:
- "based on the provided context"
- "as an AI"

────────────────────────
HTML FORMAT (STRICT)
────────────────────────
- Wrap paragraphs in <p>
- Use <ul><li> if needed
- No markdown
- No <br>
- Compact HTML only

────────────────────────
CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

USER QUESTION:
{question}

Return ONLY clean HTML.
`;

const GENERAL_ANSWER_PROMPT = `
{systemPrompt}

You are continuing an ongoing SaaS conversation.

Detected user intent: {intent}

Be natural. Be human. Be concise.
Avoid marketing tone.
Avoid long monologues.


HTML Rules:
- Wrap text in <p>
- Use <ul><li> if needed
- No markdown
- No <br>
- Compact HTML only

CONVERSATION HISTORY:
{history}

AVAILABLE ACTIONS:
{logicContext}

USER:
{question}

Return ONLY clean HTML.
`;

// ─── rewriteQuery ─────────────────────────────────────────────────────────────
export async function rewriteQuery(userMessage: string): Promise<string[]> {
  // Skip rewriting for short queries — saves ~2s and 2 extra embedding calls downstream
  if (userMessage.trim().split(/\s+/).length <= 5) {
    console.log('⚡ [rewriteQuery] short query — skipping rewrite, using original only');
    return [userMessage];
  }

  const t = timer('rewriteQuery (LLM call)');
  try {
    const { text } = await generateText({
      model: googleAI('gemini-2.5-flash'),  // faster than 2.5-flash for this tiny task
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
      .slice(0, 2); // max 2 variations, not 3 — reduces downstream search calls

    const queries = [userMessage, ...variations].slice(0, 2); // cap at 2 total
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
  return `
You are a senior customer success and product specialist for a modern AI SaaS company.

Your responsibilities:
- Clearly explain services
- Build trust through transparency
- Guide users toward the right solution
- Keep answers structured and helpful

Communication style:
- Natural and human
- Calm and confident
- Clear and concise
- No hype
- No buzzwords
- No robotic apologies


Company context:
${chatbot.directive || ''}

Brand personality:
${chatbot.description || 'Professional, modern, and helpful.'}
`;
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

  // Convert LLM <cite data-url="...">label</cite> → styled inline link
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

  // Deduplicate: skip sources already shown as inline <cite> links in the response
  const inlineCiteUrls = new Set<string>();
  const citeRegex = /data-url="([^"]+)"/g;
  let match;
  while ((match = citeRegex.exec(htmlResponse)) !== null) {
    inlineCiteUrls.add(match[1]);
  }
  const newSources = sources.filter(s => !inlineCiteUrls.has(s.url));

  // Build source cards for sources NOT already shown inline
  const allSourcesToShow = sources; // always show all in the footer section
  
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

// ─── generateRAGResponse ──────────────────────────────────────────────────────
export async function generateRAGResponse(
  chatbot: any,
  userMessage: string,
  conversationId: string,
  preloadedChatbotLogic?: any   // ← pass in from executeSearchChain to skip DB call
): Promise<SearchChainResult> {
  console.group('🔍 generateRAGResponse');
  const tTotal = timer('generateRAGResponse [total]');

  // STEP 1: Parallel — history + query rewrite + chatbotLogic (only if not preloaded)
  const tStep1 = timer('Step 1: history + rewriteQuery + chatbotLogic (parallel)');
  const [history, queries, chatbotLogic] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 6
    }),
    rewriteQuery(userMessage),
    preloadedChatbotLogic
      ? Promise.resolve(preloadedChatbotLogic)   // already have it — free
      : prisma.chatbotLogic.findUnique({ where: { chatbotId: chatbot.id } })
  ]);
  tStep1.end();

  // Derive logicContext — no DB call (reusing chatbotLogic fetched above)
  const tLogicCtx = timer('getLogicContext (reusing prefetched logic)');
  const logicContext = await getLogicContext(chatbot, userMessage, chatbotLogic);
  tLogicCtx.end();

  const formattedHistory = formatHistory(history);

// Improved follow-up expansion logic
let enrichedUserMessage = userMessage;

const shortFollowUpPatterns = /^(why|how|pricing|cost|tell me more|more|what about that|and that|so)\b/i;

if (
  history.length > 0 &&
  (
    userMessage.trim().length <= 18 ||
    shortFollowUpPatterns.test(userMessage.trim())
  )
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
  // ── GREETING FAST PATH (Skip RAG + LLM heavy flow) ──
if (intent === 'GREETING') {
  const greetingText = `<p>Hi there 👋 How can I help you today?</p>`;

  return {
    response: greetingText,
    htmlResponse: `<div style="line-height:1.6;color:#1f2937;">${greetingText}</div>`,
    conversationId,
    knowledgeContext: '',
    logicContext: '',
    sourcesUsed: 0,
    sourceUrls: []
  };
}



  // STEP 2: Smart vector search — original query first, only expand if needed
  const tStep2 = timer(`Step 2: vector search (smart, ${chatbot.knowledgeBases?.length ?? 0} KBs)`);
  
  // Always search with original query only — 1 embedding per KB (3 total, not 6)
  // Query rewriting still enriches the LLM prompt but we avoid duplicate embeddings
  const tPhase2a = timer('  Phase 2a: original query search');
  const originalQuery = queries[0]; // always the original userMessage
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

  // Confidence threshold — avoid forced robotic RAG
const bestScore = searchresults.reduce((max, r) => Math.max(max, r.score ?? 0), 0);

  console.log(`   └─ ${searchresults.length} results, best score: ${bestScore.toFixed(3)}`);

  tStep2.end();

  const tProcess = timer('Step 2b: processSearchResults');
  const { context: knowledgeContext, sources } = processSearchResults(searchresults.flat(), chatbot);
  tProcess.end();

  console.log(`   └─ knowledgeContext length: ${knowledgeContext.length} chars, sources: ${sources.length}`);
    
  const strongContext = bestScore >= 0.45 && knowledgeContext.length > 0;
     
  // STEP 3: LLM generation
  
const prompt = strongContext
  ? RAG_ANSWER_PROMPT
      .replace('{intent}', intent)
      .replace('{context}', knowledgeContext)
      .replace('{history}', formattedHistory)
      .replace('{question}', enrichedUserMessage)
  : GENERAL_ANSWER_PROMPT
      .replace('{intent}', intent)
      .replace('{systemPrompt}', generateSystemPrompt(chatbot))
      .replace('{history}', formattedHistory)
      .replace('{logicContext}', logicContext)
     .replace('{question}', enrichedUserMessage);

  const tLLM = timer('Step 3: LLM generateText (gemini-2.5-flash-preview)');
 // First generation (creative)
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

const isFallback = false;

const isKnowledgeIntent =
  intent === 'FEATURE' ||
  intent === 'GENERAL';

const shortMessage = userMessage.trim().length < 20;

const shouldShowSources =
  strongContext &&
  isKnowledgeIntent &&
  !shortMessage &&
  cleaned.length > 120;

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
  
  // Try all known metadata fields where a URL might live
  // Your Document model uses 'source' as the canonical URL field
  const url =
    m.source ||   // Document.source — the primary URL field in your schema
    m.url ||      // alternate key some scrapers use
    m.link ||
    m.pageUrl ||
    r.source ||   // sometimes hoisted to top level by vector store
    null;

  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return null;

  // Derive a human-readable title
  const title =
    m.title ||
    m.name ||
    m.filename ||
    m.page_title ||
    (() => {
      // Fall back to cleaned-up URL hostname + path
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

  // Build context — include source label so LLM knows what each chunk is about
  const context = uniqueResults.map((r, i) => {
    const src = extractSourceUrl(r);
    const label = src?.title || r.metadata?.title || `Source ${i + 1}`;
    return `[${label}]\n${r.content}`;
  }).join('\n\n');

  // Collect unique source URLs using the robust extractor
  const sourceMap = new Map<string, { title: string; url: string }>();
  for (const r of uniqueResults) {
    const src = extractSourceUrl(r);
    if (src && !sourceMap.has(src.url)) {
      sourceMap.set(src.url, src);
    }
  }
  const sources = Array.from(sourceMap.values()).slice(0, 5);

  // Debug log so you can see what metadata looks like
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

  const { chatbotId, conversationId, userMessage, chatbot: preloadedChatbot } = config;

  let chatbot = preloadedChatbot ?? null;
  if (!chatbot) {
    const tChatbot = timer('prisma: fetch chatbot + relations (no preload)');
    chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: {
          select: { id: true, name: true }
        },
        logic: true,
        form: true
      }
    });
    tChatbot.end();
  } else {
    console.log('\u2705 [executeSearchChain] using pre-fetched chatbot — skipped DB call');
  }

  if (!chatbot) throw new Error('Chatbot not found');

  // ── Get/create conversation first (needed for message storage) ──
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

  // ── Parallel: store user message + fetch chatbotLogic (shared by triggers & RAG) ──
  const tParallel = timer('prisma: store user message + fetch chatbotLogic (parallel)');
  const [, chatbotLogicRecord] = await Promise.all([
    prisma.message.create({
      data: { content: userMessage, senderType: 'USER', conversationId: conversation.id }
    }),
    prisma.chatbotLogic.findUnique({ where: { chatbotId } })
  ]);
  tParallel.end();

  // checkLogicTriggers reuses the already-fetched logic record — zero extra DB calls
  const tLogic = timer('checkLogicTriggers (reusing prefetched logic)');
  const triggeredLogics = await checkLogicTriggers(chatbot, userMessage, chatbotLogicRecord);
  tLogic.end();

  const { response, htmlResponse, knowledgeContext, logicContext, sourcesUsed, sourceUrls } =
    await generateRAGResponse(chatbot, userMessage, conversation.id, chatbotLogicRecord);

  // Fire-and-forget: don't block the API response on a DB write (saves 5-13s)
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
  onChunk?: (chunk: string) => void
): Promise<ReadableStream<string>> {
  console.group('🌊 streamRAGResponse');
  const tTotal = timer('streamRAGResponse setup [total before stream starts]');

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
  if (intent === 'GREETING') {
  const greeting = `<p>Hi there 👋 How can I help you today?</p>`;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(greeting);
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

  const prompt = knowledgeContext
  ? RAG_ANSWER_PROMPT
      .replace('{intent}', intent)
      .replace('{context}', knowledgeContext)
      .replace('{history}', formattedHistory)
      .replace('{question}', userMessage)
  : GENERAL_ANSWER_PROMPT
      .replace('{intent}', intent)
      .replace('{systemPrompt}', generateSystemPrompt(chatbot))
      .replace('{history}', formattedHistory)
      .replace('{logicContext}', logicContext)
      .replace('{question}', userMessage);

  const tStreamInit = timer('streamText init (LLM call start)');
  const result = await streamText({
    model: googleAI('gemini-2.5-flash'),  // fast, stable, low-latency
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