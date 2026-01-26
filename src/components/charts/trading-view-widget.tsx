'use client';

/**
 * TradingView Widget Components
 *
 * Wrappers for TradingView's embeddable widgets.
 * These provide quick market visualization without custom charting.
 */

import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  hideVolume?: boolean;
  compact?: boolean;
  className?: string;
}

interface MiniChartWidgetProps {
  symbol: string;
  width?: number | string;
  height?: number;
  className?: string;
}

interface MarketOverviewWidgetProps {
  symbols?: string[];
  className?: string;
}

interface TickerTapeWidgetProps {
  symbols?: string[];
  className?: string;
}

// ============================================
// TradingView Widget
// ============================================

function TradingViewWidgetComponent({
  symbol,
  interval = '15',
  hideVolume = false,
  compact = false,
  className,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const formattedSymbol = symbol.includes(':') ? symbol : `NASDAQ:${symbol}`;

  const widgetUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(formattedSymbol)}&interval=${interval}&hidesidetoolbar=1&hidetoptoolbar=${compact ? '1' : '0'}&symboledit=0&saveimage=0&toolbarbg=0a0a0a&theme=dark&style=1&timezone=exchange&withdateranges=0&hide_side_toolbar=1${hideVolume ? '&hide_volume=1' : ''}`;

  return (
    <div ref={containerRef} className={cn('w-full h-full min-h-[200px]', className)}>
      <iframe
        src={widgetUrl}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title={`TradingView Chart - ${symbol}`}
      />
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);

// ============================================
// Mini Chart Widget
// ============================================

function MiniChartWidgetComponent({
  symbol,
  width = '100%',
  height = 200,
  className,
}: MiniChartWidgetProps) {
  const formattedSymbol = symbol.includes(':') ? symbol : `NASDAQ:${symbol}`;

  const widgetUrl = `https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#%7B%22symbol%22%3A%22${encodeURIComponent(formattedSymbol)}%22%2C%22width%22%3A%22${width}%22%2C%22height%22%3A${height}%2C%22dateRange%22%3A%221D%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22autosize%22%3Afalse%7D`;

  return (
    <div className={cn('overflow-hidden', className)} style={{ width, height }}>
      <iframe
        src={widgetUrl}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title={`Mini Chart - ${symbol}`}
      />
    </div>
  );
}

export const MiniChartWidget = memo(MiniChartWidgetComponent);

// ============================================
// Market Overview Widget
// ============================================

function MarketOverviewWidgetComponent({
  symbols = ['SPY', 'QQQ', 'IWM', 'DIA'],
  className,
}: MarketOverviewWidgetProps) {
  const tabs = symbols.map(s => ({
    title: s,
    symbols: [{ s: s.includes(':') ? s : `AMEX:${s}` }],
  }));

  const widgetConfig = {
    colorTheme: 'dark',
    dateRange: '1D',
    showChart: true,
    locale: 'en',
    largeChartUrl: '',
    isTransparent: true,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    width: '100%',
    height: 400,
    tabs,
  };

  const widgetUrl = `https://s.tradingview.com/embed-widget/market-overview/?locale=en#${encodeURIComponent(JSON.stringify(widgetConfig))}`;

  return (
    <div className={cn('w-full h-[400px]', className)}>
      <iframe
        src={widgetUrl}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Market Overview"
      />
    </div>
  );
}

export const MarketOverviewWidget = memo(MarketOverviewWidgetComponent);

// ============================================
// Ticker Tape Widget
// ============================================

function TickerTapeWidgetComponent({
  symbols = ['AMEX:SPY', 'NASDAQ:QQQ', 'AMEX:IWM', 'NASDAQ:AAPL', 'NASDAQ:NVDA'],
  className,
}: TickerTapeWidgetProps) {
  const symbolsConfig = symbols.map(s => ({
    proName: s.includes(':') ? s : `NASDAQ:${s}`,
    title: s.replace(/.*:/, ''),
  }));

  const widgetConfig = {
    symbols: symbolsConfig,
    showSymbolLogo: true,
    colorTheme: 'dark',
    isTransparent: true,
    displayMode: 'adaptive',
    locale: 'en',
  };

  const widgetUrl = `https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#${encodeURIComponent(JSON.stringify(widgetConfig))}`;

  return (
    <div className={cn('w-full h-[46px] overflow-hidden', className)}>
      <iframe
        src={widgetUrl}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Ticker Tape"
      />
    </div>
  );
}

export const TickerTapeWidget = memo(TickerTapeWidgetComponent);
