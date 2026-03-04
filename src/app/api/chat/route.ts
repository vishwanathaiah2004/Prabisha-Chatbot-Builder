// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeSearchChain, simpleSearch } from '@/lib/langchain/chains/search-chain';

function timer(label: string) {
  const start = Date.now();
  return {
    end: () => {
      const ms = Date.now() - start;
      console.log(`⏱️ [API /chat] ${label}: ${ms}ms`);
      return ms;
    }
  };
}

export async function POST(request: NextRequest) {
  const tTotal = timer('POST [total]');
  try {
    const tParse = timer('parse request body');
    const body = await request.json();
    tParse.end();

    const message = body.message || body.input;
    const chatbotId = body.chatbotId;
    let conversationId = body.conversationId;
    // BCP-47 language code from the frontend language selector (e.g. 'en', 'ja', 'ar')
    const language: string = body.language || 'en';

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    if (!chatbotId) {
      return NextResponse.json({ error: 'Chatbot ID required' }, { status: 400 });
    }

    const tChatbotFetch = timer('prisma: fetch chatbot');
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      include: {
        knowledgeBases: {
          select: { id: true, name: true }
        },
        logic: true,
        form: true
      }
    });
    tChatbotFetch.end();

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    if (conversationId) {
      const tConvCheck = timer('prisma: verify conversation');
      const existingConversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      });
      tConvCheck.end();

      if (!existingConversation) {
        conversationId = null;
      } else if (existingConversation.chatbotId !== chatbotId) {
        return NextResponse.json(
          { error: 'Conversation does not belong to this chatbot' },
          { status: 403 }
        );
      }
    }

    const tChain = timer('executeSearchChain');
    const result = await executeSearchChain({
      chatbotId,
      conversationId,
      userMessage: message,
      chatbot,
      language, // ← forwarded to the LLM prompts
    });
    tChain.end();

    const responseData: any = {
      message: result.response,
      response: result.response,
      conversationId: result.conversationId,
    };

    if (result.triggeredLogics?.length) {
      responseData.logicTriggers = result.triggeredLogics.map(logic => ({
        id: logic.id,
        type: logic.type,
        name: logic.name,
        config: logic.config,
        linkButton: logic.linkButton,
        meetingSchedule: logic.meetingSchedule,
        leadCollection: logic.leadCollection
      }));
    }

    if (result.sourceUrls?.length) {
      responseData.sourceUrls = result.sourceUrls;
    }

    tTotal.end();
    return NextResponse.json(responseData);

  } catch (error: any) {
    tTotal.end();
    console.error('Chat API error:', error);

    let errorMessage = 'Failed to process message';
    let statusCode = 500;

    if (error.message?.includes('Chatbot not found')) {
      errorMessage = 'Chatbot not found';
      statusCode = 404;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'AI service configuration error';
      statusCode = 503;
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded';
      statusCode = 429;
    }

    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  const tTotal = timer('GET [total]');
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const chatbotId = searchParams.get('chatbotId');
    const conversationId = searchParams.get('conversationId');

    if (!query || !chatbotId) {
      return NextResponse.json({ error: 'query and chatbotId required' }, { status: 400 });
    }

    if (conversationId) {
      const tConv = timer('prisma: fetch conversation with messages');
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 }}
      });
      tConv.end();

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      if (conversation.chatbotId !== chatbotId) {
        return NextResponse.json(
          { error: 'Conversation does not belong to this chatbot' },
          { status: 403 }
        );
      }

      tTotal.end();
      return NextResponse.json({
        data: conversation.messages,
        conversationId: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt
      });
    } else {
      const tSearch = timer('simpleSearch');
      const results = await simpleSearch(chatbotId, query, {
        limit: parseInt(searchParams.get('limit') || '10'),
        threshold: parseFloat(searchParams.get('threshold') || '0.65'),
        includeKnowledgeBaseNames: searchParams.get('includeKbNames') === 'true'
      });
      tSearch.end();

      tTotal.end();
      return NextResponse.json({ results, query, chatbotId, count: results.length });
    }

  } catch (error) {
    tTotal.end();
    console.error('Error in GET:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const tTotal = timer('PUT [total]');
  try {
    const body = await request.json();
    const { conversationId, isActive, metadata } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const tUpdate = timer('prisma: update conversation');
    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(metadata && { metadata }),
        ...(isActive === false && { endedAt: new Date() })
      }
    });
    tUpdate.end();

    tTotal.end();
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      isActive: conversation.isActive,
      endedAt: conversation.endedAt
    });

  } catch (error) {
    tTotal.end();
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}