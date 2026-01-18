'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol?: string;
  interval?: string;
  theme?: 'dark' | 'light';
  height?: number | string;
  width?: number | string;
  autosize?: boolean;
  showToolbar?: boolean;
  showStudies?: boolean;
}

function TradingViewWidgetComponent({
  symbol = 'SPY',
  interval = 'D',
  theme = 'dark',
  height = 400,
  width = '100%',
  autosize = true,
  showToolbar = true,
  showStudies = false,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    // Create the widget container div
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = autosize ? '100%' : `${height}px`;
    widgetContainer.style.width = typeof width === 'number' ? `${width}px` : width;
    containerRef.current.appendChild(widgetContainer);

    // Create and configure the script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize,
      symbol: symbol.includes(':') ? symbol : `NASDAQ:${symbol}`,
      interval,
      timezone: 'America/New_York',
      theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: theme === 'dark' ? 'rgba(13, 13, 13, 1)' : 'rgba(255, 255, 255, 1)',
      gridColor: theme === 'dark' ? 'rgba(42, 46, 57, 0.3)' : 'rgba(0, 0, 0, 0.1)',
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: showStudies
        ? ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'VWAP@tv-basicstudies']
        : [],
    });

    containerRef.current.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval, theme, height, width, autosize, showToolbar, showStudies]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{
        height: autosize ? '100%' : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    />
  );
}

export const TradingViewWidget = memo(TradingViewWidgetComponent);

// Mini chart widget for market overview
interface MiniChartWidgetProps {
  symbol?: string;
  height?: number;
  width?: number | string;
}

function MiniChartWidgetComponent({
  symbol = 'SPY',
  height = 200,
  width = '100%',
}: MiniChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol.includes(':') ? symbol : `NASDAQ:${symbol}`,
      width: typeof width === 'number' ? width : '100%',
      height,
      locale: 'en',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height, width]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height, width: typeof width === 'number' ? `${width}px` : width }}
    />
  );
}

export const MiniChartWidget = memo(MiniChartWidgetComponent);

// Market overview widget showing multiple symbols
function MarketOverviewWidgetComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      dateRange: '1D',
      showChart: true,
      locale: 'en',
      largeChartUrl: '',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: '100%',
      height: '400',
      tabs: [
        {
          title: 'Indices',
          symbols: [
            { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
            { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
            { s: 'FOREXCOM:DJI', d: 'Dow 30' },
            { s: 'INDEX:VIX', d: 'VIX' },
          ],
          originalTitle: 'Indices',
        },
        {
          title: 'ETFs',
          symbols: [
            { s: 'AMEX:SPY', d: 'SPY' },
            { s: 'NASDAQ:QQQ', d: 'QQQ' },
            { s: 'AMEX:IWM', d: 'IWM' },
            { s: 'AMEX:DIA', d: 'DIA' },
          ],
          originalTitle: 'ETFs',
        },
      ],
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: '400px', width: '100%' }}
    />
  );
}

export const MarketOverviewWidget = memo(MarketOverviewWidgetComponent);

// Ticker tape widget
function TickerTapeWidgetComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'AMEX:SPY', title: 'SPY' },
        { proName: 'NASDAQ:QQQ', title: 'QQQ' },
        { proName: 'INDEX:VIX', title: 'VIX' },
        { proName: 'AMEX:IWM', title: 'IWM' },
        { proName: 'NASDAQ:AAPL', title: 'AAPL' },
        { proName: 'NASDAQ:NVDA', title: 'NVDA' },
        { proName: 'NASDAQ:TSLA', title: 'TSLA' },
        { proName: 'NASDAQ:MSFT', title: 'MSFT' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: '100%' }}
    />
  );
}

export const TickerTapeWidget = memo(TickerTapeWidgetComponent);
