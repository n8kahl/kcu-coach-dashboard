const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');
const fs = require('fs');

// Color scheme
const colors = {
  primary: "1E3A5F",      // Dark blue
  accent: "2E7D32",       // Green
  warning: "E65100",      // Orange
  lightGray: "F5F5F5",
  mediumGray: "E0E0E0",
  darkGray: "424242"
};

// Borders
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: colors.mediumGray };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// Helper functions
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 36, color: colors.primary, font: "Arial" })]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 28, color: colors.primary, font: "Arial" })]
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: colors.accent, font: "Arial" })]
  });
}

function para(text, options = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...options })]
  });
}

function boldPara(label, text) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: "Arial" }),
      new TextRun({ text, size: 22, font: "Arial" })
    ]
  });
}

// Document content
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: colors.primary },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: colors.primary },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: colors.accent },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }
        ] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers2",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers3",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers4",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers5",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "KCU Practice Enhancement Plan", italics: true, size: 20, color: colors.darkGray, font: "Arial" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 20, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 20, font: "Arial" }),
            new TextRun({ text: " of ", size: 20, font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 20, font: "Arial" })
          ]
        })]
      })
    },
    children: [
      // Title Page
      new Paragraph({ spacing: { before: 2000 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "KCU PRACTICE SIMULATOR", bold: true, size: 56, color: colors.primary, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: "Comprehensive Enhancement Plan", size: 40, color: colors.darkGray, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: "Transforming Practice into Professional-Grade Trading Simulation", italics: true, size: 24, color: colors.accent, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200 },
        children: [new TextRun({ text: "Version 1.0 | January 2026", size: 22, color: colors.darkGray, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Executive Summary
      heading1("Executive Summary"),
      para("The current KCU Practice Simulator provides a foundation for LTP framework learning but falls significantly short of delivering a realistic, comprehensive trading practice experience. This document outlines a complete transformation plan that will turn the practice module into a professional-grade trading simulator that mirrors real market conditions while teaching all aspects of the KCU methodology."),

      heading2("Current State Assessment"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Limited to 5-candle static scenarios with basic LONG/SHORT/WAIT decisions", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "No position sizing, account balance, or risk management practice", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Massive.com data integration exists but is underutilized", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Multiple practice modes (Quick Drill, Deep Analysis, Live Replay) are partially implemented", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "No options trading practice despite KCU focus on 0DTE strategies", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Chart interface lacks TradingView-quality interactivity and timeframe switching", size: 22, font: "Arial" })]
      }),

      heading2("Vision: The Complete Trading Simulator"),
      para("The enhanced practice module will provide a full TradingView-like experience with historical replay, simulated account management, options trading, and comprehensive skill-building exercises covering every concept in the KCU curriculum. Users will practice not just entry decisions, but the complete trading workflow from premarket preparation through position management and journaling."),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 1: Chart Experience
      heading1("Part 1: Professional Chart Experience"),
      para("The chart is the primary interface for trading practice. It must match the quality and functionality traders expect from platforms like TradingView."),

      heading2("1.1 TradingView-Quality Chart Interface"),
      heading3("Current Limitations"),
      para("The current practice chart uses lightweight-charts library with basic candlestick display, limited to showing 5 candles with static key levels. Users cannot interact with the chart beyond basic zoom and the replay controls."),

      heading3("Required Enhancements"),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                shading: { fill: colors.primary, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Feature", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                shading: { fill: colors.primary, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Implementation Details", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Full Historical Data", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Display 100+ candles minimum with smooth scrolling through historical data. Fetch extended history on scroll left.", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Multi-Timeframe", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Quick-switch between 2m, 5m, 15m, 60m, 4H, Daily, Weekly. Support multi-pane layouts (4-pane like KCU setup).", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Drawing Tools", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Horizontal lines, trendlines, rectangles for zones, Fibonacci retracements. Essential for practicing level identification.", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Indicators", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "EMA 9/21 (required), VWAP with standard deviation bands, Volume profile, Ripster clouds for after 1 PM trading.", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "ORB Overlay", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Auto-plot Opening Range Breakout high/low from first 15 minutes. Visual indication of ORB break for trend confirmation.", size: 22, font: "Arial" })] })]
              })
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 200 } }),

      heading2("1.2 Historical Data Replay System"),
      para("The most powerful practice feature: replay any historical trading day candle-by-candle as if it were happening live."),

      heading3("Data Sources (Already Available via Massive.com)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Stocks: SPY, QQQ, NVDA, AAPL, TSLA, AMD, META, GOOGL, AMZN, MSFT (current watchlist)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Indices: Full index data through Polygon.io API", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Timeframes: 1m, 2m, 5m, 15m, 30m, 60m, 4H, Daily, Weekly", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Options: Historical options chain data for 0DTE practice", size: 22, font: "Arial" })]
      }),

      heading3("Replay Controls"),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Date Picker: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Select any historical trading day from the past 2+ years", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Time Jump: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Quick jump to market open (9:30), ORB end (9:45), power hour (3:00)", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Playback Speed: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "1x (real-time), 2x, 5x, 10x, or manual candle-by-candle stepping", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Pause at Events: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Auto-pause when price hits key level, ORB breaks, or patience candle forms", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Hidden Future: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Chart only shows data up to current replay point - no peeking ahead", size: 22, font: "Arial" })
        ]
      }),

      heading3("Curated Scenario Library"),
      para("Pre-selected historical days showcasing specific setups from the KCU curriculum:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Classic ORB breakout days with clean trend continuation", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Choppy/range days to practice patience and avoiding overtrading", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Gap up/down days for gap fill strategies", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "VWAP rejection plays with clear bounce/rejection patterns", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Hourly level breakout days demonstrating the 60-minute strategy", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "News/catalyst days showing volatility management", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 2: Simulated Trading Account
      heading1("Part 2: Simulated Trading Account"),
      para("Practice without real money but with realistic account constraints. This addresses the critical gap in position sizing and risk management practice."),

      heading2("2.1 Paper Trading Account"),

      heading3("Account Setup"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3500, 5860],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3500, type: WidthType.DXA },
                shading: { fill: colors.lightGray, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Starting Balance Options", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 5860, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "$5,000 | $10,000 | $25,000 | $50,000 | $100,000 | Custom", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3500, type: WidthType.DXA },
                shading: { fill: colors.lightGray, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Account Type", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 5860, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Cash Account (PDT rules apply) | Margin Account (4x buying power)", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3500, type: WidthType.DXA },
                shading: { fill: colors.lightGray, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "PDT Protection", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 5860, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Warn when approaching 3 day trades in 5-day rolling window (under $25K)", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3500, type: WidthType.DXA },
                shading: { fill: colors.lightGray, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Settlement Rules", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 5860, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "T+1 for options, T+2 for stocks (simulate real settlement)", size: 22, font: "Arial" })] })]
              })
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 200 } }),

      heading3("Position Sizing Calculator"),
      para("Built-in calculator that enforces KCU risk management rules:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Risk Per Trade: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "User sets max risk (e.g., 1-2% of account)", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Auto-Calculate Shares: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Based on entry price and stop loss distance", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Risk/Reward Display: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Show R:R ratio before entry (minimum 2:1 recommended)", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Warning Alerts: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Alert if position size exceeds risk parameters", size: 22, font: "Arial" })
        ]
      }),

      heading2("2.2 Order Entry System"),

      heading3("Order Types"),
      new Paragraph({
        numbering: { reference: "numbers2", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Market Order: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Instant fill at current price (with simulated slippage)", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers2", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Limit Order: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Only fill at specified price or better", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers2", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Stop Order: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Trigger market order when price hits stop level", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers2", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Stop-Limit Order: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Trigger limit order at stop price", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers2", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Bracket Order: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Entry + Stop Loss + Take Profit as single order (OCO)", size: 22, font: "Arial" })
        ]
      }),

      heading3("Chart-Based Order Entry"),
      para("Click on chart to place orders visually:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Right-click at price level to open order dialog", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Drag stop loss and take profit lines directly on chart", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Visual display of entry, stop, and target zones", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Real-time P&L display on open positions", size: 22, font: "Arial" })]
      }),

      heading2("2.3 Options Trading Simulation"),
      para("Critical for KCU methodology which heavily emphasizes 0DTE options trading."),

      heading3("Options Chain Display"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Full options chain with strikes, expirations, bid/ask, volume, open interest", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Greeks display: Delta, Gamma, Theta, Vega", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Filter by expiration (0DTE, weekly, monthly)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Mid-price calculation for realistic entry pricing", size: 22, font: "Arial" })]
      }),

      heading3("Contract Selection Practice"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Strike selection guidance based on delta targets", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Spread width analysis for bid/ask evaluation", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Volume/OI analysis for liquidity assessment", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Time decay visualization showing theta impact", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 3: Skill-Building Exercises
      heading1("Part 3: Skill-Building Practice Modules"),
      para("Targeted exercises for each component of the KCU/LTP framework, based directly on curriculum content."),

      heading2("3.1 Level Identification Practice"),

      heading3("Exercise: Draw the Levels"),
      para("Present a clean chart (no levels pre-drawn). User must identify and draw:"),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Previous Day High (PDH) ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- Mark the exact price", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Previous Day Low (PDL) ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- Mark the exact price", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Premarket High/Low ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- From overnight session", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Hourly Levels ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- From 60-minute chart (KCU core strategy)", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Support/Resistance Zones ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- Areas of historical reaction", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers3", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Gap Fill Levels ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "- Where gaps need to fill", size: 22, font: "Arial" })
        ]
      }),

      para("System compares user-drawn levels against calculated correct levels and scores accuracy within tolerance (e.g., within $0.50 = full credit)."),

      heading3("Exercise: Rate the Level Strength"),
      para("Given a level, user rates its importance (1-10) based on:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Number of times price has reacted to this level", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Recency of reactions", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Confluence with other levels (VWAP, EMA, etc.)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Timeframe significance (daily level > 5-min level)", size: 22, font: "Arial" })]
      }),

      heading2("3.2 Trend Identification Practice"),

      heading3("Exercise: Multi-Timeframe Alignment"),
      para("View multiple timeframes simultaneously and assess trend direction on each:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Weekly: What is the overall trend?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Daily: Is price above/below SMA 200?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "4-Hour: Short-term trend direction", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "60-Minute: Intraday trend", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "15-Minute: Entry timeframe trend", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "5-Minute: Execution timeframe", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "2-Minute: Fine-tune entries", size: 22, font: "Arial" })]
      }),
      para("User marks each as Bullish/Bearish/Neutral. Score based on agreement with system analysis."),

      heading3("Exercise: ORB Trend vs Chop"),
      para("After the first 15 minutes, user must predict:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Will today be a TREND day or CHOP day?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "If trend: Which direction (bullish/bearish)?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Confidence level (1-5)", size: 22, font: "Arial" })]
      }),
      para("Replay continues to show outcome. Learn to recognize ORB characteristics that predict trend days."),

      heading2("3.3 Patience Candle Recognition"),

      heading3("Exercise: Spot the Patience Candle"),
      para("Show chart approaching a key level. User must:"),
      new Paragraph({
        numbering: { reference: "numbers4", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Identify when patience candles begin forming", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers4", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Count the number of patience candles", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers4", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Identify the breakout candle (entry trigger)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers4", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Mark where stop loss should be placed (other side of patience candle)", size: 22, font: "Arial" })]
      }),

      heading3("Patience Candle Criteria (from KCU)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Small body relative to recent candles", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Forming at or near a key level", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Inside bar pattern (high < previous high, low > previous low)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Shows consolidation/equilibrium between buyers and sellers", size: 22, font: "Arial" })]
      }),

      heading2("3.4 Complete LTP Confluence Practice"),

      heading3("Exercise: LTP Score Assessment"),
      para("Present a scenario and have user score each component:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Level (0-100): ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "How close to a significant level? What is the level?", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Trend (0-100): ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "How aligned is the trade with the trend across timeframes?", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Patience (0-100): ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Are patience candles present? How many?", size: 22, font: "Arial" })
        ]
      }),
      para("Compare user scores to system-calculated scores. Detailed feedback on discrepancies."),

      heading3("Trade or No Trade Decision Tree"),
      para("Walk through the KCU decision process:"),
      new Paragraph({
        numbering: { reference: "numbers5", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Is there a clear Level? If no, WAIT.", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers5", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Is the Trend aligned? If no, WAIT or reduce size.", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers5", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Are Patience candles forming? If no, WAIT.", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers5", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Did the patience candle break in your direction? ENTER.", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "numbers5", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Set stop on other side of patience candle, target at next level.", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 4: Interactive Q&A System
      heading1("Part 4: Interactive Q&A and Quiz System"),
      para("Transform the existing quiz system into an interactive, scenario-based learning experience."),

      heading2("4.1 Contextual Questions During Practice"),
      para("Instead of separate quizzes, embed questions naturally during practice scenarios:"),

      heading3("During Historical Replay"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "After ORB forms: \"Based on the ORB, do you expect a trend or chop day? Why?\"", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "At key level: \"What type of level is this? Rate its strength.\"", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "At potential entry: \"What is your LTP score for this setup?\"", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "After trade: \"What was the risk/reward ratio? Was it worth taking?\"", size: 22, font: "Arial" })]
      }),

      heading3("Concept Verification Quizzes"),
      para("Quick 3-5 question quizzes that appear when user demonstrates misunderstanding:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "If user consistently misses levels: Level identification quiz", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "If user trades against trend: Multi-timeframe alignment quiz", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "If user enters without patience: Patience candle recognition quiz", size: 22, font: "Arial" })]
      }),

      heading2("4.2 Voice/Text AI Coach Interaction"),
      para("Expand the existing AI coach to support interactive dialogue:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "\"Why did you take this trade?\" - User explains reasoning, AI evaluates", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "\"What would Kay say about this setup?\" - AI responds in Kay's teaching style", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "\"Is this a good entry?\" - AI asks clarifying questions to guide thinking", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Post-trade review: AI walks through what went right/wrong", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 5: Premarket and Full Day Simulation
      heading1("Part 5: Complete Trading Day Simulation"),
      para("Practice the full trading workflow, not just entries."),

      heading2("5.1 Premarket Preparation Practice"),

      heading3("Morning Routine Checklist"),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Draw Hourly Levels: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Identify key levels from 60-minute chart", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Mark Premarket High/Low: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "From overnight session", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Check Multi-Timeframe Trend: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Weekly → Daily → 4H alignment", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Identify Gap Direction: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Gap up, gap down, or flat open?", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Set Bias: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Based on above, bullish, bearish, or neutral for the day?", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Plan Entry Zones: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Where will you look for entries if price reaches these levels?", size: 22, font: "Arial" })
        ]
      }),

      heading2("5.2 Session-Based Practice"),

      heading3("Market Open Session (9:30 - 10:30 AM)"),
      para("High volatility period. Practice:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Waiting for ORB to form (first 15 minutes)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Identifying ORB break direction", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Taking momentum trades with trend", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Avoiding fake breakouts in first 5 minutes", size: 22, font: "Arial" })]
      }),

      heading3("Mid-Day Session (10:30 AM - 2:00 PM)"),
      para("Often choppy. Practice:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Recognizing range-bound conditions", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Sitting on hands when LTP isn't aligning", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "VWAP mean reversion plays", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Patience and trade selection discipline", size: 22, font: "Arial" })]
      }),

      heading3("Power Hour (3:00 - 4:00 PM)"),
      para("Often trending. Practice:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Using Ripster clouds (after 1 PM strategy)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "End of day momentum plays", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Position management before close", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "0DTE options time decay awareness", size: 22, font: "Arial" })]
      }),

      heading2("5.3 Post-Trade Journaling"),
      para("After each practice trade, prompt for journal entry:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Screenshot of entry and exit (auto-captured)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "LTP checklist completion (was L, T, P present?)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Emotion tag: What was your emotional state?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Mistake identification: What could you have done better?", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Lesson learned: One key takeaway from this trade", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 6: Progress and Analytics
      heading1("Part 6: Progress Tracking and Analytics"),
      para("Comprehensive analytics to track improvement over time."),

      heading2("6.1 Performance Dashboard"),

      heading3("Key Metrics"),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                shading: { fill: colors.primary, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Metric", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                shading: { fill: colors.primary, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true, color: "FFFFFF", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Win Rate", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Percentage of profitable trades", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Profit Factor", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Gross profit / Gross loss (target > 2.0)", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Average R Multiple", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Average return per unit of risk", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Max Drawdown", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Largest peak-to-trough decline in account", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "LTP Compliance", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "% of trades that had all three LTP components", size: 22, font: "Arial" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3000, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Patience Score", bold: true, size: 22, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6360, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "How often did you wait for proper setups?", size: 22, font: "Arial" })] })]
              })
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 200 } }),

      heading2("6.2 Skill Progression"),

      heading3("LTP Component Mastery"),
      para("Track proficiency in each component:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Level Identification: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Beginner → Intermediate → Advanced → Master", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Trend Recognition: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Based on MTF alignment accuracy", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "Patience Discipline: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Based on waiting for proper entries", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "Risk Management: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Based on position sizing and stop discipline", size: 22, font: "Arial" })
        ]
      }),

      heading3("Adaptive Difficulty"),
      para("System automatically adjusts based on performance:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "High accuracy (>80%): Present more difficult/ambiguous scenarios", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Struggling (<60%): Return to fundamentals with clearer setups", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Specific weakness detected: Focus scenarios on that skill", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Part 7: Technical Implementation
      heading1("Part 7: Technical Implementation Roadmap"),

      heading2("7.1 Data Infrastructure"),

      heading3("Massive.com API Optimization"),
      para("Current integration uses Polygon.io endpoints. Required enhancements:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Historical options chain data storage for 0DTE practice", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Pre-computed level calculations for faster scenario loading", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Cached \"notable days\" database of curated scenarios", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "WebSocket support for real-time replay simulation", size: 22, font: "Arial" })]
      }),

      heading3("Database Schema Extensions"),
      para("New tables required:"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "paper_accounts: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Simulated trading accounts with balance tracking", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "paper_positions: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Open positions in paper account", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "paper_orders: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Order history and pending orders", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "skill_assessments: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Per-skill proficiency tracking", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "level_drawing_attempts: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "User-drawn levels for scoring", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "curated_scenarios: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Pre-selected historical trading days", size: 22, font: "Arial" })
        ]
      }),

      heading2("7.2 Component Architecture"),

      heading3("New React Components"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "AdvancedChart: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Full TradingView-style chart with drawing tools, multi-pane", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "ReplayControls: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Date picker, playback speed, time navigation", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "OrderEntry: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Order ticket with position sizing calculator", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "OptionsChain: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Options chain display with Greeks", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "AccountPanel: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Balance, positions, P&L display", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: "SkillExercise: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Wrapper for skill-specific practice modules", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [
          new TextRun({ text: "TradeJournal: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Post-trade journaling interface", size: 22, font: "Arial" })
        ]
      }),

      heading2("7.3 Implementation Phases"),

      heading3("Phase 1: Chart Enhancement (Weeks 1-4)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Upgrade to full TradingView-style chart", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Add drawing tools and indicators", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Implement multi-timeframe switching", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Load full historical data (100+ candles)", size: 22, font: "Arial" })]
      }),

      heading3("Phase 2: Historical Replay (Weeks 5-8)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build replay engine with date selection", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Create curated scenario library", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Implement playback controls", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Add auto-pause at key events", size: 22, font: "Arial" })]
      }),

      heading3("Phase 3: Paper Trading (Weeks 9-12)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build paper account system", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Implement order entry and execution", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Add position sizing calculator", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Integrate options chain", size: 22, font: "Arial" })]
      }),

      heading3("Phase 4: Skill Exercises (Weeks 13-16)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build level identification exercise", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build trend alignment exercise", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build patience candle exercise", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Integrate contextual quizzes", size: 22, font: "Arial" })]
      }),

      heading3("Phase 5: Analytics & Polish (Weeks 17-20)"),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Build performance dashboard", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Implement skill progression tracking", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: "Add adaptive difficulty", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 160 },
        children: [new TextRun({ text: "Polish UI/UX and mobile responsiveness", size: 22, font: "Arial" })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // Summary
      heading1("Summary: The Complete Practice Experience"),

      para("The enhanced KCU Practice Simulator will transform from a simple 5-candle decision tool into a comprehensive trading education platform that:"),

      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Looks like real trading: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "TradingView-quality charts with all the tools traders actually use", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Uses real data: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Massive.com historical data for authentic market replay", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Teaches complete workflow: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "From premarket prep through journaling", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Practices all skills: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Level ID, trend analysis, patience candles, and more", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Simulates real risk: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Paper trading with position sizing and account management", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Supports options: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "0DTE practice with full options chain simulation", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Adapts to learner: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Difficulty adjusts based on performance and weak areas", size: 22, font: "Arial" })
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "Tracks progress: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: "Comprehensive analytics show improvement over time", size: 22, font: "Arial" })
        ]
      }),

      para("This plan directly addresses every issue raised: the underwhelming 5-candle experience, non-functional modes, lack of real data utilization, missing position sizing, and incomplete coverage of KCU methodology. Implementation will take approximately 20 weeks and transform practice into the most valuable component of the platform."),

      new Paragraph({ spacing: { after: 400 } }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "— End of Enhancement Plan —", italics: true, size: 22, color: colors.darkGray, font: "Arial" })]
      }),
    ]
  }]
});

// Generate document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/practical-beautiful-keller/mnt/kcu-coach-dashboard/KCU-Practice-Enhancement-Plan.docx', buffer);
  console.log('Document created successfully!');
});
