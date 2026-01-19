/**
 * Companion Messages API
 *
 * GET /api/companion/messages - Get companion coaching messages
 * POST /api/companion/messages - Generate a new AI coaching message
 * PUT /api/companion/messages - Acknowledge/dismiss a message
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

const anthropic = new Anthropic();

interface MessageRequest {
  symbol?: string;
  setupId?: string;
  messageType: string;
  context?: Record<string, unknown>;
}

interface AcknowledgeRequest {
  messageId: string;
  action: 'acknowledge' | 'dismiss';
}

/**
 * GET - Fetch companion messages for user
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unacknowledgedOnly = searchParams.get('unacknowledged') === 'true';
    const symbol = searchParams.get('symbol');

    let query = supabaseAdmin
      .from('companion_messages')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unacknowledgedOnly) {
      query = query.is('acknowledged_at', null).is('dismissed_at', null);
    }

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: messages, error } = await query;

    if (error) {
      logger.error('Error fetching companion messages', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({
      messages: messages || [],
      count: messages?.length || 0,
    });
  } catch (error) {
    logger.error('Error in companion messages GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Generate a new AI companion message
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: MessageRequest = await request.json();
    const { symbol, setupId, messageType, context } = body;

    // Build context for AI message generation
    let messageContent = '';
    let priority = 'medium';
    let title = '';

    switch (messageType) {
      case 'setup_forming':
        title = `${symbol} Setup Forming`;
        priority = 'medium';
        messageContent = await generateSetupMessage(symbol || '', context);
        break;

      case 'setup_ready':
        title = `${symbol} Setup Ready`;
        priority = 'high';
        messageContent = await generateSetupMessage(symbol || '', context, true);
        break;

      case 'level_approach':
        title = `${symbol} Approaching Level`;
        priority = 'medium';
        messageContent = await generateLevelApproachMessage(symbol || '', context);
        break;

      case 'coaching_tip':
        title = 'Coaching Tip';
        priority = 'low';
        messageContent = await generateCoachingTip(context);
        break;

      case 'session_milestone':
        title = 'Session Milestone';
        priority = 'low';
        messageContent = await generateMilestoneMessage(context);
        break;

      case 'risk_warning':
        title = 'Risk Warning';
        priority = 'critical';
        messageContent = await generateRiskWarning(context);
        break;

      default:
        messageContent = context?.message as string || 'Companion message';
    }

    // Save the message
    const { data: message, error } = await supabaseAdmin
      .from('companion_messages')
      .insert({
        user_id: session.userId,
        message_type: messageType,
        priority,
        title,
        message: messageContent,
        symbol: symbol?.toUpperCase() || null,
        setup_id: setupId || null,
        context: context || {},
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating companion message', { error: error.message });
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }

    logger.info('Companion message created', {
      userId: session.userId,
      messageType,
      symbol,
    });

    return NextResponse.json({ message });
  } catch (error) {
    logger.error('Error in companion messages POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Acknowledge or dismiss a message
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: AcknowledgeRequest = await request.json();
    const { messageId, action } = body;

    if (!messageId || !action) {
      return NextResponse.json({ error: 'messageId and action are required' }, { status: 400 });
    }

    const updateField = action === 'acknowledge' ? 'acknowledged_at' : 'dismissed_at';

    const { error } = await supabaseAdmin
      .from('companion_messages')
      .update({ [updateField]: new Date().toISOString() })
      .eq('id', messageId)
      .eq('user_id', session.userId);

    if (error) {
      logger.error('Error updating companion message', { error: error.message });
      return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error in companion messages PUT', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions for message generation

async function generateSetupMessage(
  symbol: string,
  context?: Record<string, unknown>,
  isReady = false
): Promise<string> {
  const confluenceScore = context?.confluenceScore as number || 70;
  const direction = context?.direction as string || 'bullish';
  const levelType = context?.levelType as string || 'support';
  const levelPrice = context?.levelPrice as number || 0;

  if (isReady) {
    return `${symbol} has formed a high-probability ${direction} setup at ${levelType} ($${levelPrice.toFixed(2)}). Confluence: ${confluenceScore}%. Remember: Level + Trend + Patience!`;
  }

  return `${symbol} is showing early signs of a ${direction} setup forming near ${levelType} ($${levelPrice.toFixed(2)}). Current confluence: ${confluenceScore}%. Watch for patience candles.`;
}

async function generateLevelApproachMessage(
  symbol: string,
  context?: Record<string, unknown>
): Promise<string> {
  const levelType = context?.levelType as string || 'key level';
  const levelPrice = context?.levelPrice as number || 0;
  const distance = context?.distancePercent as number || 0.5;

  return `${symbol} is ${distance.toFixed(2)}% from ${levelType} at $${levelPrice.toFixed(2)}. Watch for price reaction and potential setup formation.`;
}

async function generateCoachingTip(context?: Record<string, unknown>): Promise<string> {
  const tips = [
    'Remember: The best setups have all three LTP components aligned. Don\'t force trades with only 1-2 confirmations.',
    'Patience is often the hardest part. Wait for your level to prove itself before entering.',
    'Trend is your friend. Trading against the trend requires extra confirmation.',
    'Position sizing is key. Never risk more than 1-2% on a single trade.',
    'Review your journal entries from similar setups. What patterns do you see?',
    'Take breaks between trades to maintain mental clarity.',
    'The best trade might be no trade at all. Protect your capital.',
  ];

  const focusArea = context?.focusArea as string;
  if (focusArea === 'patience') {
    return 'Patience candles show commitment at a level. Look for 2-3 candles that respect your level before entering.';
  }
  if (focusArea === 'trend') {
    return 'Use VWAP and EMAs to confirm trend direction. Above VWAP = bullish bias, below = bearish bias.';
  }
  if (focusArea === 'level') {
    return 'Key levels include PDH/PDL, ORB, VWAP, and psychological round numbers. Look for confluence of multiple levels.';
  }

  return tips[Math.floor(Math.random() * tips.length)];
}

async function generateMilestoneMessage(context?: Record<string, unknown>): Promise<string> {
  const milestoneType = context?.milestoneType as string || 'session';
  const count = context?.count as number || 1;

  switch (milestoneType) {
    case 'setups_detected':
      return `You've identified ${count} setups this session. Great scanning work!`;
    case 'time_in_session':
      return `You've been focused for ${count} minutes. Remember to take breaks to stay sharp.`;
    case 'practice_streak':
      return `${count} correct practice decisions in a row! Your LTP skills are improving.`;
    default:
      return 'Keep up the great work! Consistency is key to trading success.';
  }
}

async function generateRiskWarning(context?: Record<string, unknown>): Promise<string> {
  const warningType = context?.warningType as string || 'general';

  switch (warningType) {
    case 'overtrading':
      return 'Warning: You\'ve taken several trades in quick succession. Consider stepping back and waiting for A+ setups only.';
    case 'extended_market':
      return 'Market indices are extended from VWAP. Be cautious with new entries and consider tighter stops.';
    case 'high_volatility':
      return 'Volatility is elevated. Consider reducing position size or waiting for calmer conditions.';
    case 'news_event':
      return 'Major news event approaching. Be aware of potential volatility spikes.';
    default:
      return 'Remember to manage your risk. Protect your capital above all else.';
  }
}

/**
 * Generate intelligent AI companion message using Claude
 */
async function generateAICompanionMessage(
  userId: string,
  context: {
    symbol?: string;
    setupData?: Record<string, unknown>;
    sessionStats?: Record<string, unknown>;
    messageType: string;
  }
): Promise<string> {
  try {
    const prompt = `You are an AI trading companion for KCU (Kings Corner University) providing brief, supportive coaching messages.

Context:
- Symbol: ${context.symbol || 'N/A'}
- Message Type: ${context.messageType}
- Setup Data: ${JSON.stringify(context.setupData || {})}
- Session Stats: ${JSON.stringify(context.sessionStats || {})}

Generate a brief (1-2 sentences), supportive coaching message appropriate for the context. Focus on LTP framework principles (Level, Trend, Patience). Be encouraging but not excessive.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }

    return 'Stay focused and trust your LTP analysis.';
  } catch (error) {
    logger.warn('AI companion message generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'Stay focused on your LTP checklist.';
  }
}
