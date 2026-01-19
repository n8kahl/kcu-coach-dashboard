/**
 * Screenshot Analysis API Endpoint
 *
 * Analyzes trading chart screenshots using AI to provide coaching
 * based on KCU curriculum lessons.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CURRICULUM_MODULES } from '@/data/curriculum';

const anthropic = new Anthropic();

// Build a comprehensive curriculum context for the AI
function buildCurriculumContext(): string {
  const context: string[] = [
    'You are the KCU Trading Coach AI. Your role is to analyze trading charts and provide coaching based on the KCU curriculum.',
    '',
    '=== KCU CURRICULUM OVERVIEW ===',
    ''
  ];

  for (const module of CURRICULUM_MODULES) {
    context.push(`## ${module.title}`);
    context.push(module.description);
    context.push('');

    for (const lesson of module.lessons) {
      context.push(`### ${lesson.title}`);
      context.push(lesson.description);
      if (lesson.key_takeaways.length > 0) {
        context.push('Key Points:');
        for (const point of lesson.key_takeaways) {
          context.push(`- ${point}`);
        }
      }
      context.push('');
    }
  }

  context.push('=== LTP FRAMEWORK SUMMARY ===');
  context.push('L = Levels: Key price zones where price may react (hourly levels, PDH/PDL, VWAP, ORB levels)');
  context.push('T = Trend: Direction of momentum across timeframes (EMA 9/21 alignment, VWAP position)');
  context.push('P = Patience: Waiting for confirmation before entry (patience candles, proper setups)');
  context.push('');
  context.push('All three components must align for a high-probability trade entry.');

  return context.join('\n');
}

interface AnalysisResult {
  setup: {
    symbol?: string;
    direction?: 'LONG' | 'SHORT' | 'NEUTRAL';
    quality: 'A+' | 'A' | 'B' | 'C' | 'F';
    ltpScore: {
      level: number;
      trend: number;
      patience: number;
      overall: number;
    };
  };
  levels: {
    type: string;
    price: number;
    significance: string;
  }[];
  analysis: {
    priceAction: string;
    trendAnalysis: string;
    levelAnalysis: string;
    patienceStatus: string;
  };
  recommendation: {
    action: 'ENTER' | 'WAIT' | 'AVOID' | 'EXIT';
    reasoning: string;
    suggestedEntry?: number;
    suggestedStop?: number;
    target1?: number;
    target2?: number;
    riskReward?: number;
  };
  coaching: {
    message: string;
    relevantLessons: {
      moduleSlug: string;
      lessonSlug: string;
      title: string;
      relevance: string;
    }[];
    warnings: string[];
    tips: string[];
  };
  rawAnalysis: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, symbol, context: userContext } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL if needed
    let imageData = image;
    let mediaType = 'image/png';

    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mediaType = matches[1] as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
        imageData = matches[2];
      }
    }

    const curriculumContext = buildCurriculumContext();

    const systemPrompt = `${curriculumContext}

=== ANALYSIS INSTRUCTIONS ===

When analyzing a trading chart screenshot, you must provide a comprehensive analysis following the KCU methodology:

1. IDENTIFY THE SETUP
   - What symbol is being shown (if visible)?
   - What timeframe is the chart?
   - Is this a potential long, short, or neutral setup?

2. ANALYZE LEVELS (L)
   - Identify any visible support/resistance levels
   - Note proximity to key levels (VWAP, EMAs, hourly pivots, PDH/PDL)
   - Rate Level quality 1-10

3. ANALYZE TREND (T)
   - What is the overall trend direction?
   - Is price above or below VWAP?
   - EMA 9/21 alignment and positioning
   - Rate Trend quality 1-10

4. ANALYZE PATIENCE (P)
   - Are there patience candles forming?
   - Is there proper consolidation at the level?
   - Is this the right time to enter or should trader wait?
   - Rate Patience quality 1-10

5. PROVIDE RECOMMENDATION
   - ENTER: Setup is ready with LTP alignment
   - WAIT: Good setup forming but needs more confirmation
   - AVOID: Poor setup, missing key components
   - EXIT: If in a trade, reasons to exit

6. REFERENCE RELEVANT LESSONS
   - Connect your analysis to specific KCU lessons
   - Explain which concepts apply to this chart

Respond in JSON format with this structure:
{
  "setup": {
    "symbol": "DETECTED_SYMBOL or null",
    "timeframe": "DETECTED_TIMEFRAME",
    "direction": "LONG" | "SHORT" | "NEUTRAL",
    "quality": "A+" | "A" | "B" | "C" | "F"
  },
  "ltpScore": {
    "level": 1-10,
    "trend": 1-10,
    "patience": 1-10,
    "overall": 1-10
  },
  "levels": [
    { "type": "VWAP|EMA9|EMA21|HOURLY|PDH|PDL|ORB_HIGH|ORB_LOW|SMA200", "price": number, "significance": "description" }
  ],
  "analysis": {
    "priceAction": "detailed price action analysis",
    "trendAnalysis": "trend analysis with EMA/VWAP context",
    "levelAnalysis": "key level analysis",
    "patienceStatus": "patience candle analysis"
  },
  "recommendation": {
    "action": "ENTER|WAIT|AVOID|EXIT",
    "reasoning": "detailed reasoning",
    "suggestedEntry": number or null,
    "suggestedStop": number or null,
    "target1": number or null,
    "target2": number or null,
    "riskReward": number or null
  },
  "coaching": {
    "message": "Your coaching message to the trader",
    "relevantLessons": [
      { "moduleSlug": "module-slug", "lessonSlug": "lesson-slug", "title": "Lesson Title", "relevance": "why this lesson applies" }
    ],
    "warnings": ["any warnings about this setup"],
    "tips": ["helpful tips for trading this setup"]
  }
}`;

    const userMessage = userContext
      ? `Please analyze this trading chart. Additional context from trader: ${userContext}`
      : 'Please analyze this trading chart and provide coaching based on the KCU methodology.';

    if (symbol) {
      // If symbol is provided, add it to context
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                data: imageData
              }
            },
            {
              type: 'text',
              text: userMessage
            }
          ]
        }
      ],
      system: systemPrompt
    });

    // Extract the text response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    const rawAnalysis = textContent.text;

    // Try to parse JSON from the response
    let parsedAnalysis: AnalysisResult;

    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = rawAnalysis.match(/```json\n?([\s\S]*?)\n?```/) ||
                        rawAnalysis.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        parsedAnalysis = {
          setup: {
            symbol: parsed.setup?.symbol || symbol,
            direction: parsed.setup?.direction || 'NEUTRAL',
            quality: parsed.setup?.quality || 'C',
            ltpScore: {
              level: parsed.ltpScore?.level || 5,
              trend: parsed.ltpScore?.trend || 5,
              patience: parsed.ltpScore?.patience || 5,
              overall: parsed.ltpScore?.overall || 5
            }
          },
          levels: parsed.levels || [],
          analysis: {
            priceAction: parsed.analysis?.priceAction || '',
            trendAnalysis: parsed.analysis?.trendAnalysis || '',
            levelAnalysis: parsed.analysis?.levelAnalysis || '',
            patienceStatus: parsed.analysis?.patienceStatus || ''
          },
          recommendation: {
            action: parsed.recommendation?.action || 'WAIT',
            reasoning: parsed.recommendation?.reasoning || '',
            suggestedEntry: parsed.recommendation?.suggestedEntry,
            suggestedStop: parsed.recommendation?.suggestedStop,
            target1: parsed.recommendation?.target1,
            target2: parsed.recommendation?.target2,
            riskReward: parsed.recommendation?.riskReward
          },
          coaching: {
            message: parsed.coaching?.message || '',
            relevantLessons: parsed.coaching?.relevantLessons || [],
            warnings: parsed.coaching?.warnings || [],
            tips: parsed.coaching?.tips || []
          },
          rawAnalysis
        };
      } else {
        // Fallback if no JSON found
        parsedAnalysis = {
          setup: {
            symbol: symbol,
            direction: 'NEUTRAL',
            quality: 'C',
            ltpScore: { level: 5, trend: 5, patience: 5, overall: 5 }
          },
          levels: [],
          analysis: {
            priceAction: rawAnalysis,
            trendAnalysis: '',
            levelAnalysis: '',
            patienceStatus: ''
          },
          recommendation: {
            action: 'WAIT',
            reasoning: 'Unable to parse structured analysis'
          },
          coaching: {
            message: rawAnalysis,
            relevantLessons: [],
            warnings: [],
            tips: []
          },
          rawAnalysis
        };
      }
    } catch {
      // If JSON parsing fails, return raw analysis
      parsedAnalysis = {
        setup: {
          symbol: symbol,
          direction: 'NEUTRAL',
          quality: 'C',
          ltpScore: { level: 5, trend: 5, patience: 5, overall: 5 }
        },
        levels: [],
        analysis: {
          priceAction: rawAnalysis,
          trendAnalysis: '',
          levelAnalysis: '',
          patienceStatus: ''
        },
        recommendation: {
          action: 'WAIT',
          reasoning: 'Analysis provided in text format'
        },
        coaching: {
          message: rawAnalysis,
          relevantLessons: [],
          warnings: [],
          tips: []
        },
        rawAnalysis
      };
    }

    return NextResponse.json({
      success: true,
      analysis: parsedAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Screenshot Analysis API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze screenshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
