/**
 * Screenshot Analysis API Endpoint
 *
 * Uses Claude Vision to analyze chart screenshots and extract trade information.
 * Returns structured data for auto-populating trade entry forms.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Analysis result interface
export interface ScreenshotAnalysisResult {
  symbol: string | null;
  timeframe: string | null;
  trend: 'bullish' | 'bearish' | 'sideways';
  levels: {
    support: number[];
    resistance: number[];
  };
  pattern: string | null;
  candlestickPatterns: string[];
  indicators: string[];
  ltpAssessment: {
    level: { compliant: boolean; reason: string };
    trend: { compliant: boolean; reason: string };
    patience: { compliant: boolean; reason: string };
  };
  setupType: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  analysis: string;
  confidence: number;
  suggestedDirection: 'long' | 'short' | null;
  entryPrice: number | null;
  stopLoss: number | null;
  targets: number[];
}

const ANALYSIS_PROMPT = `Analyze this trading chart screenshot and extract the following information. Be thorough and precise in your analysis.

Extract:
1. Symbol/Ticker (if visible in the chart title or header)
2. Timeframe (1m, 5m, 15m, 1H, 4H, Daily, etc.) - look at candle timestamps or chart settings
3. Trend Direction - analyze the overall price action:
   - Bullish: Higher highs and higher lows, price above moving averages
   - Bearish: Lower highs and lower lows, price below moving averages
   - Sideways: Range-bound, consolidating between levels
4. Key Support/Resistance Levels - identify horizontal levels where price has reacted
5. Chart Pattern (if any): Flag, Wedge, Triangle, Head & Shoulders, Double Top/Bottom, Channel, Cup & Handle, etc.
6. Candlestick Patterns visible (Doji, Engulfing, Hammer, Shooting Star, etc.)
7. Visible Indicators and their readings (EMA, SMA, VWAP, RSI, MACD, etc.)
8. Entry Quality Assessment (if an entry point is marked)

LTP Compliance Assessment (KCU Trading Framework):
- Level: Is price at a significant support/resistance level? Look for:
  * Previous day's high/low (PDH/PDL)
  * VWAP
  * Key moving averages (9 EMA, 21 EMA, 200 SMA)
  * Opening Range (ORB)
  * Premarket levels
  * Weekly/Monthly levels

- Trend: Is the trade with or against the trend?
  * Check higher timeframe trend direction
  * Look at EMA stacking/alignment
  * Consider market structure (higher highs/lows or lower)

- Patience: Is there confirmation before entry?
  * Look for consolidation at the level
  * Multiple candles "respecting" the level
  * A breakout candle with conviction
  * Not chasing extended moves

Setup Classification:
- Breakout: Price breaking above resistance or below support with volume
- Pullback: Retracement to support/moving average in uptrend (or vice versa)
- Reversal: Price reversing at key level after extended move
- Continuation: Flag/pennant patterns mid-trend
- Scalp: Quick moves off intraday levels

Risk Assessment:
- Conservative: Clear level, strong trend alignment, patience candle present
- Moderate: 2 of 3 LTP components present
- Aggressive: Only 1 LTP component, extended moves, counter-trend

Respond with ONLY valid JSON (no markdown, no explanation), using this exact structure:
{
  "symbol": "string or null if not visible",
  "timeframe": "string or null",
  "trend": "bullish" | "bearish" | "sideways",
  "levels": {
    "support": [array of price numbers],
    "resistance": [array of price numbers]
  },
  "pattern": "string or null",
  "candlestickPatterns": ["array of pattern names"],
  "indicators": ["array of indicator descriptions, e.g., 'RSI at 65'"],
  "ltpAssessment": {
    "level": {
      "compliant": true/false,
      "reason": "explanation"
    },
    "trend": {
      "compliant": true/false,
      "reason": "explanation"
    },
    "patience": {
      "compliant": true/false,
      "reason": "explanation"
    }
  },
  "setupType": "Breakout" | "Pullback" | "Reversal" | "Continuation" | "Scalp" | "Unknown",
  "riskLevel": "conservative" | "moderate" | "aggressive",
  "analysis": "2-3 sentence analysis of the trade setup quality",
  "confidence": 0-100,
  "suggestedDirection": "long" | "short" | null,
  "entryPrice": number or null,
  "stopLoss": number or null,
  "targets": [array of target prices]
}`;

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageData, imageUrl } = body;

    if (!imageData && !imageUrl) {
      return NextResponse.json(
        { error: 'Either imageData (base64) or imageUrl is required' },
        { status: 400 }
      );
    }

    logger.info('Screenshot analysis request', {
      userId,
      hasImageData: !!imageData,
      hasImageUrl: !!imageUrl,
    });

    // Build the image content for Claude
    let imageContent: Anthropic.ImageBlockParam;

    if (imageData) {
      // Base64 image data
      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

      // Detect media type from data URL or default to png
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
      if (imageData.includes('data:image/jpeg')) {
        mediaType = 'image/jpeg';
      } else if (imageData.includes('data:image/gif')) {
        mediaType = 'image/gif';
      } else if (imageData.includes('data:image/webp')) {
        mediaType = 'image/webp';
      }

      imageContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      };
    } else {
      // For URL-based images, fetch and convert to base64
      try {
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Data = Buffer.from(imageBuffer).toString('base64');

        // Detect media type from content-type header or URL
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          mediaType = 'image/jpeg';
        } else if (contentType.includes('gif')) {
          mediaType = 'image/gif';
        } else if (contentType.includes('webp')) {
          mediaType = 'image/webp';
        }

        imageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        };
      } catch (fetchError) {
        return NextResponse.json(
          { error: 'Failed to fetch image from URL' },
          { status: 400 }
        );
      }
    }

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    logger.info('Screenshot analysis response received', {
      userId,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    // Parse the JSON response
    let analysis: ScreenshotAnalysisResult;
    try {
      // Clean the response - remove any markdown code blocks if present
      const cleanedText = rawText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      logger.error('Failed to parse screenshot analysis', {
        userId,
        rawText: rawText.substring(0, 500),
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });

      // Return a default structure with the raw analysis
      analysis = {
        symbol: null,
        timeframe: null,
        trend: 'sideways',
        levels: { support: [], resistance: [] },
        pattern: null,
        candlestickPatterns: [],
        indicators: [],
        ltpAssessment: {
          level: { compliant: false, reason: 'Unable to determine' },
          trend: { compliant: false, reason: 'Unable to determine' },
          patience: { compliant: false, reason: 'Unable to determine' },
        },
        setupType: 'Unknown',
        riskLevel: 'aggressive',
        analysis: rawText.substring(0, 500),
        confidence: 0,
        suggestedDirection: null,
        entryPrice: null,
        stopLoss: null,
        targets: [],
      };
    }

    return NextResponse.json({
      success: true,
      analysis,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    logger.error('Screenshot analysis error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service configuration error' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'AI service is temporarily busy. Please try again.' },
          { status: 429 }
        );
      }
      if (error.message.includes('Could not process image')) {
        return NextResponse.json(
          { error: 'Unable to process the image. Please try a different format or smaller size.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze screenshot' },
      { status: 500 }
    );
  }
}
