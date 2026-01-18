const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');
const fs = require('fs');

// Professional color scheme
const COLORS = {
  gold: 'F59E0B',
  darkGold: 'D97706',
  black: '0D0D0D',
  darkGray: '141414',
  gray: '525252',
  lightGray: 'A3A3A3',
  white: 'F5F5F5',
  green: '22C55E',
  red: 'EF4444',
  blue: '3B82F6',
  purple: '6366F1',
};

const border = { style: BorderStyle.SINGLE, size: 1, color: '333333' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Arial', size: 22 },
        paragraph: { spacing: { after: 200, line: 276 } }
      }
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 48, bold: true, font: 'Arial', color: COLORS.gold },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: COLORS.white },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: COLORS.lightGray },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 2 }
      },
    ]
  },
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }, {
          level: 1,
          format: LevelFormat.BULLET,
          text: '\u25E6',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: 'phases',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: 'Phase %1:',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 720 } } }
        }]
      }
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
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'KCU COACH DASHBOARD', font: 'Arial', size: 18, color: COLORS.gold, bold: true }),
              new TextRun({ text: '  |  ', font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ text: 'UX & Polish Proposal', font: 'Arial', size: 18, color: COLORS.lightGray })
            ]
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ text: ' of ', font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ text: '  |  ', font: 'Arial', size: 18, color: COLORS.gray }),
              new TextRun({ text: 'Confidential', font: 'Arial', size: 18, color: COLORS.gold })
            ]
          })
        ]
      })
    },
    children: [
      // ========== COVER PAGE ==========
      new Paragraph({ spacing: { after: 600 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'KCU COACH DASHBOARD', font: 'Arial', size: 72, bold: true, color: COLORS.gold })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        children: [
          new TextRun({ text: 'Comprehensive UX, Navigation & Mobile Responsiveness Audit', font: 'Arial', size: 28, color: COLORS.lightGray })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 800 },
        children: [
          new TextRun({ text: 'Premium Animation, Transition & Polish Proposal', font: 'Arial', size: 24, color: COLORS.gray })
        ]
      }),

      // Decorative divider
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: noBorders, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: '\u2501'.repeat(20), color: COLORS.gray })] })] }),
              new TableCell({ borders: noBorders, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '\u2B21', font: 'Arial', size: 36, color: COLORS.gold })] })] }),
              new TableCell({ borders: noBorders, width: { size: 3120, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '\u2501'.repeat(20), color: COLORS.gray })] })] }),
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 600 } }),

      // Meta info box
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        columnWidths: [2800, 2800],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: { ...noBorders, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.gold } },
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'Prepared For:', font: 'Arial', size: 18, color: COLORS.gray })] }),
                  new Paragraph({ children: [new TextRun({ text: 'Kay Capitals University', font: 'Arial', size: 22, bold: true, color: COLORS.white })] }),
                ]
              }),
              new TableCell({
                borders: noBorders,
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'Document Date:', font: 'Arial', size: 18, color: COLORS.gray })] }),
                  new Paragraph({ children: [new TextRun({ text: 'January 18, 2026', font: 'Arial', size: 22, bold: true, color: COLORS.white })] }),
                ]
              }),
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders: { ...noBorders, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.gold } },
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'Audit Perspective:', font: 'Arial', size: 18, color: COLORS.gray })] }),
                  new Paragraph({ children: [new TextRun({ text: 'Sr. Mobile Designer + Sr. Web Engineer', font: 'Arial', size: 20, bold: true, color: COLORS.white })] }),
                ]
              }),
              new TableCell({
                borders: noBorders,
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'Platform:', font: 'Arial', size: 18, color: COLORS.gray })] }),
                  new Paragraph({ children: [new TextRun({ text: 'Next.js 14 + React 18', font: 'Arial', size: 20, bold: true, color: COLORS.white })] }),
                ]
              }),
            ]
          }),
        ]
      }),

      new Paragraph({ spacing: { after: 800 } }),

      // Vision statement
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: '"Elevating KCU Coach from functional to ', font: 'Arial', size: 24, italics: true, color: COLORS.lightGray }),
          new TextRun({ text: 'premium', font: 'Arial', size: 24, italics: true, bold: true, color: COLORS.gold }),
          new TextRun({ text: ' \u2014 a trading platform that feels as sophisticated as the strategies it teaches."', font: 'Arial', size: 24, italics: true, color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== EXECUTIVE SUMMARY ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('EXECUTIVE SUMMARY')]
      }),

      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: 'This comprehensive audit evaluates the KCU Coach Dashboard across ', color: COLORS.lightGray }),
          new TextRun({ text: '24 pages, 12 core UI components, 40+ API endpoints, ', bold: true, color: COLORS.white }),
          new TextRun({ text: 'and ', color: COLORS.lightGray }),
          new TextRun({ text: '4 chart integrations', bold: true, color: COLORS.white }),
          new TextRun({ text: '. The platform demonstrates strong foundational architecture with Next.js 14, TypeScript, and Framer Motion, but requires strategic enhancements to achieve a premium "bougie" trading experience.', color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Current State Assessment')]
      }),

      // Assessment metrics table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3500, 1800, 4060],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3500, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'CATEGORY', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 1800, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SCORE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 4060, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'KEY FINDING', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['User Experience (UX)', '6.5/10', 'Solid patterns, inconsistent application'],
            ['Navigation Flow', '7/10', 'Clear hierarchy, missing back navigation'],
            ['Mobile Responsiveness', '5.5/10', 'Gap at tablet breakpoints (md:)'],
            ['Animation & Transitions', '5/10', 'Framer Motion present, underutilized'],
            ['Visual Polish', '6/10', 'Design system exists, needs refinement'],
            ['Accessibility (a11y)', '4/10', 'Critical gaps in ARIA and keyboard nav'],
            ['Loading/Error States', '5/10', 'Inconsistent patterns across pages'],
            ['Premium Feel ("Bougie")', '4/10', 'Functional, not luxurious'],
          ].map(([category, score, finding]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3500, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: category, color: COLORS.white, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 1800, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: score, bold: true, color: score.startsWith('7') || score.startsWith('6.5') ? COLORS.green : score.startsWith('6') ? COLORS.gold : COLORS.red, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 4060, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: finding, color: COLORS.lightGray, size: 20 })] })]
                }),
              ]
            })
          ),
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3500, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'OVERALL PLATFORM', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 1800, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '5.4/10', bold: true, color: COLORS.black, size: 22 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 4060, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'Strong foundation, needs premium layer', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400 },
        children: [new TextRun('Proposed Transformation')]
      }),

      new Paragraph({
        children: [
          new TextRun({ text: 'Target Score: ', color: COLORS.lightGray }),
          new TextRun({ text: '9.0/10', bold: true, color: COLORS.gold, size: 28 }),
          new TextRun({ text: ' \u2014 A platform that looks and feels like a $10,000/year premium trading education service.', color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 1: ARCHITECTURE OVERVIEW ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('1. CURRENT ARCHITECTURE OVERVIEW')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Technology Stack')]
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2340, 3510, 3510],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'LAYER', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3510, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'TECHNOLOGY', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3510, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'VERSION', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Framework', 'Next.js (App Router)', '14.2.35'],
            ['UI Library', 'React', '18.3.1'],
            ['Language', 'TypeScript', '5.5.4'],
            ['Styling', 'Tailwind CSS', '3.4.10'],
            ['Animation', 'Framer Motion', '11.5.4'],
            ['Charts', 'TradingView + Chart.js', 'Latest'],
            ['Database', 'Supabase', '2.45.4'],
            ['AI', 'Anthropic Claude + OpenAI', '0.27.3'],
          ].map(([layer, tech, version]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: layer, color: COLORS.lightGray, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3510, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: tech, bold: true, color: COLORS.white, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3510, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: version, color: COLORS.gold, size: 20 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Page Inventory (24 Total)')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Dashboard Routes (14 pages)')]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/overview', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Main dashboard with stats, achievements, leaderboard', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/companion', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Real-time trading companion with watchlist & setup detection', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/practice', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Practice scenarios & trade simulations', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/coach', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Dedicated AI coach chat interface', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/learning', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Learning modules & curriculum with nested routes', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/progress', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Learning progress tracking & quiz history', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/journal', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Trade journal entry & analysis', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/achievements, /leaderboard, /win-cards, /alerts', bold: true, color: COLORS.gold }), new TextRun({ text: ' \u2014 Gamification & social features', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Admin Routes (5 pages)')]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: '/admin/users, /admin/analytics, /admin/card-builder, /admin/knowledge, /admin/settings', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Component Library (12 Core Components)')]
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Button, Card, Badge, Progress, Stat, Input, Avatar, Table, Select, Textarea, Skeleton, Tabs', color: COLORS.lightGray })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 2: UX AUDIT FINDINGS ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('2. USER EXPERIENCE AUDIT FINDINGS')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('2.1 Critical Issues (Must Fix)')]
      }),

      // Issue 1
      new Paragraph({
        shading: { fill: '2D1B1B', type: ShadingType.CLEAR },
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: '\u26A0 ', color: COLORS.red, size: 24 }),
          new TextRun({ text: 'ISSUE #1: Inconsistent Loading States', bold: true, color: COLORS.red, size: 24 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Location: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Every page uses different loading patterns', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Impact: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Disjointed user experience, unpredictable UI behavior', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Files Affected: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: '/overview/page.tsx:136, /practice/page.tsx:214, /learning/page.tsx:106, /journal/page.tsx:132', color: COLORS.gray, size: 18 }),
        ]
      }),

      // Issue 2
      new Paragraph({
        shading: { fill: '2D1B1B', type: ShadingType.CLEAR },
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({ text: '\u26A0 ', color: COLORS.red, size: 24 }),
          new TextRun({ text: 'ISSUE #2: Silent Error Handling in Learning Module', bold: true, color: COLORS.red, size: 24 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Location: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: '/learning/page.tsx:85-88', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Impact: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Users see empty state without knowing data failed to load', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Code: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: '"Don\'t show error, just use empty progress" - silently fails', color: COLORS.gray, italics: true }),
        ]
      }),

      // Issue 3
      new Paragraph({
        shading: { fill: '2D1B1B', type: ShadingType.CLEAR },
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({ text: '\u26A0 ', color: COLORS.red, size: 24 }),
          new TextRun({ text: 'ISSUE #3: Non-Functional "View Setups" Button', bold: true, color: COLORS.red, size: 24 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Location: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: '/companion/page.tsx:304-307', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Impact: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Button has no href or onClick handler - completely broken', color: COLORS.lightGray }),
        ]
      }),

      // Issue 4
      new Paragraph({
        shading: { fill: '2D1B1B', type: ShadingType.CLEAR },
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({ text: '\u26A0 ', color: COLORS.red, size: 24 }),
          new TextRun({ text: 'ISSUE #4: Accessibility Violations', bold: true, color: COLORS.red, size: 24 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Problem: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Clickable <div> elements without keyboard support', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 1 },
        children: [
          new TextRun({ text: '/companion/page.tsx:467 - WatchlistItem uses onClick without role="button"', color: COLORS.gray, size: 18 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Problem: ', bold: true, color: COLORS.lightGray }),
          new TextRun({ text: 'Missing ARIA labels on icon buttons', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 1 },
        children: [
          new TextRun({ text: '/header.tsx:70 (Search), :84 (Bell), /alerts/page.tsx:184-189 (Volume)', color: COLORS.gray, size: 18 }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('2.2 High Priority Issues')]
      }),

      // High priority issues table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.darkGold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'ISSUE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.darkGold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'LOCATION', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.darkGold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'RECOMMENDATION', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Missing md: breakpoint (tablet gap)', '/companion/page.tsx:313', 'Add md:grid-cols-2 to grid'],
            ['Placeholder chart in Practice', '/practice/page.tsx:350-359', 'Integrate real charting'],
            ['Modal close button too small', '/journal/page.tsx:249-254', 'Add padding & hover state'],
            ['No back navigation in lessons', '/learning/[module]/[lesson]', 'Add breadcrumb/back button'],
            ['TradingView no error fallback', '/charts/trading-view-widget.tsx', 'Add loading & error states'],
            ['Card initial animation shift', '/ui/card.tsx:36-38', 'Use opacity only, not y offset'],
            ['No skeleton loading states', 'All pages', 'Implement skeleton components'],
            ['pulse-dot class undefined', '/alerts/page.tsx:275', 'Add to Tailwind config'],
          ].map(([issue, location, rec]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: issue, color: COLORS.white, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: location, color: COLORS.gray, size: 16 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: rec, color: COLORS.lightGray, size: 18 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 3: MOBILE RESPONSIVENESS ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('3. MOBILE RESPONSIVENESS AUDIT')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Current Breakpoint Strategy')]
      }),

      new Paragraph({
        children: [new TextRun({ text: 'The platform uses Tailwind\'s standard breakpoints but with significant gaps in the tablet range:', color: COLORS.lightGray })]
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [1560, 2340, 2340, 3120],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 1560, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'PREFIX', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'MIN-WIDTH', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'USAGE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'STATUS', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['(none)', '0px', 'Mobile default', '\u2705 Well utilized'],
            ['sm:', '640px', 'Large phones', '\u26A0 Underutilized'],
            ['md:', '768px', 'Tablets', '\u274C Often skipped'],
            ['lg:', '1024px', 'Desktop', '\u2705 Well utilized'],
            ['xl:', '1280px', 'Large desktop', '\u26A0 Rarely used'],
          ].map(([prefix, width, usage, status]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 1560, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: prefix, bold: true, color: COLORS.gold, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: width, color: COLORS.white, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: usage, color: COLORS.lightGray, size: 20 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: status, color: status.includes('\u2705') ? COLORS.green : status.includes('\u274C') ? COLORS.red : COLORS.gold, size: 20 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Page-by-Page Mobile Issues')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('/companion - Trading Companion')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Grid jumps from 1 column directly to 3 columns (no md:grid-cols-2)', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Header flex layout doesn\'t wrap on tablets - gets cramped', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Key Levels panel uses grid-cols-4 which overflows on small tablets', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('/journal - Trade Journal')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Modal form max-w-lg (512px) may exceed viewport on very small screens', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Table doesn\'t have horizontal scroll wrapper on mobile', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('/overview - Main Dashboard')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'StatGrid columns={4} not explicitly handled for mobile', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Large stat values may overflow on narrow screens', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Recommended Mobile-First Improvements')]
      }),

      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: 'Implement consistent md: breakpoints across all grid layouts', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: 'Add responsive typography scaling (text-sm md:text-base lg:text-lg)', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: 'Ensure all modals use max-w-[calc(100vw-2rem)] for small screens', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: 'Add horizontal scroll containers for tables on mobile', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        children: [new TextRun({ text: 'Test touch targets (minimum 44x44px) for all interactive elements', color: COLORS.lightGray })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 4: ANIMATION & POLISH ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('4. ANIMATION, TRANSITION & POLISH PROPOSAL')]
      }),

      new Paragraph({
        children: [
          new TextRun({ text: 'This section outlines the comprehensive animation and polish strategy to transform KCU Coach into a ', color: COLORS.lightGray }),
          new TextRun({ text: 'premium, high-end ("bougie") ', bold: true, color: COLORS.gold }),
          new TextRun({ text: 'trading education platform.', color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('4.1 Global Animation System')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('New CSS Variables (add to globals.css)')]
      }),

      new Paragraph({
        shading: { fill: '1a1a2e', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: '/* Premium Animation Timing Functions */\n', font: 'JetBrains Mono', size: 18, color: COLORS.gray }),
          new TextRun({ text: '--ease-premium: cubic-bezier(0.16, 1, 0.3, 1);', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n\n/* Premium Durations */\n', font: 'JetBrains Mono', size: 18, color: COLORS.gray }),
          new TextRun({ text: '--duration-micro: 100ms;', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--duration-fast: 200ms;', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--duration-medium: 400ms;', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--duration-slow: 600ms;', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '\n--duration-luxe: 800ms;', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('New Tailwind Animations (add to tailwind.config.ts)')]
      }),

      new Paragraph({
        shading: { fill: '1a1a2e', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: 'animation: {\n', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
          new TextRun({ text: '  \'glow-pulse\': \'glow-pulse 2s ease-in-out infinite\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'float\': \'float 3s ease-in-out infinite\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'shine\': \'shine 2s linear infinite\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'scale-in\': \'scale-in 0.4s var(--ease-premium)\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'slide-up-fade\': \'slide-up-fade 0.5s var(--ease-premium)\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'live-indicator\': \'live-indicator 1.5s ease-in-out infinite\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'count-up\': \'count-up 0.6s var(--ease-bounce)\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  \'profit-flash\': \'profit-flash 0.3s ease-out\',\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '}', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('4.2 Page Transition System')]
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Implement a global page transition wrapper for seamless navigation:', color: COLORS.lightGray })]
      }),

      new Paragraph({
        shading: { fill: '1a1a2e', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: '// components/layout/page-transition.tsx\n', font: 'JetBrains Mono', size: 18, color: COLORS.gray }),
          new TextRun({ text: 'export const pageVariants = {\n', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
          new TextRun({ text: '  initial: { opacity: 0, y: 8, filter: \'blur(4px)\' },\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  animate: { opacity: 1, y: 0, filter: \'blur(0px)\' },\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  exit: { opacity: 0, y: -8, filter: \'blur(4px)\' },\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '};', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('4.3 Component-Specific Enhancements')]
      }),

      // Component enhancements table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2340, 3510, 3510],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'COMPONENT', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3510, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'CURRENT STATE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 3510, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'PREMIUM UPGRADE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Button', 'scale(1.02/0.98) on hover/tap', 'Add glow trail, ripple effect, loading shimmer'],
            ['Card', 'opacity + y:10 entrance', 'Blur-in transition, parallax tilt on hover'],
            ['Progress', 'width animation', 'Gradient flow animation, pulse at milestones'],
            ['Badge', 'Static', 'Subtle pulse for "New", shine sweep for gold'],
            ['Stat Value', 'count-up animation', 'Number morph with color flash for changes'],
            ['Alert Cards', 'None', 'Slide-in with stagger, glow for urgency'],
            ['Navigation', 'Basic active state', 'Underline slide animation, icon bounce'],
            ['Tables', 'Hover background', 'Row slide-in, cell highlight transitions'],
            ['Modals', 'AnimatePresence', 'Scale + blur backdrop, content stagger'],
            ['Charts', 'Static load', 'Progressive reveal, data point highlights'],
          ].map(([component, current, upgrade]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: component, bold: true, color: COLORS.gold, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3510, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: current, color: COLORS.gray, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3510, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: upgrade, color: COLORS.white, size: 18 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('4.4 Premium Visual Effects Library')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Gold Glow System')]
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Create a cohesive glow system that reinforces the premium gold branding:', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Subtle Glow: ', bold: true, color: COLORS.gold }),
          new TextRun({ text: '0 0 20px rgba(245, 158, 11, 0.15) - for cards and containers', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Medium Glow: ', bold: true, color: COLORS.gold }),
          new TextRun({ text: '0 0 40px rgba(245, 158, 11, 0.25) - for active states and focus', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Intense Glow: ', bold: true, color: COLORS.gold }),
          new TextRun({ text: '0 0 60px rgba(245, 158, 11, 0.35) - for celebrations and achievements', color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Profit/Loss Visual Feedback')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Profit Flash: ', bold: true, color: COLORS.green }),
          new TextRun({ text: 'Green pulse with slight scale (1.05) for positive P&L updates', color: COLORS.lightGray }),
        ]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [
          new TextRun({ text: 'Loss Indicator: ', bold: true, color: COLORS.red }),
          new TextRun({ text: 'Subtle red border flash without aggressive animation', color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Live Indicator System')]
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Replace inconsistent pulse-dot implementations with unified live indicator:', color: COLORS.lightGray })]
      }),
      new Paragraph({
        shading: { fill: '1a1a2e', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: '@keyframes live-indicator {\n', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
          new TextRun({ text: '  0%, 100% { transform: scale(1); opacity: 1; }\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '  50% { transform: scale(1.2); opacity: 0.7; }\n', font: 'JetBrains Mono', size: 18, color: COLORS.gold }),
          new TextRun({ text: '}', font: 'JetBrains Mono', size: 18, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('4.5 Micro-Interactions')]
      }),

      new Paragraph({
        children: [new TextRun({ text: 'Premium platforms distinguish themselves through thoughtful micro-interactions:', color: COLORS.lightGray })]
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.purple, type: ShadingType.CLEAR },
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'INTERACTION', bold: true, color: COLORS.white, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.purple, type: ShadingType.CLEAR },
                borders,
                width: { size: 6240, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'IMPLEMENTATION', bold: true, color: COLORS.white, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Button Click', 'Ripple effect from click point with gold gradient'],
            ['Input Focus', 'Border glow expansion with subtle background shift'],
            ['Checkbox/Toggle', 'Smooth slide with checkmark draw animation'],
            ['Dropdown Open', 'Scale + fade with staggered option reveal'],
            ['Tab Switch', 'Underline slide to active tab position'],
            ['Card Hover', '3D tilt effect (CSS perspective) with shadow shift'],
            ['List Item Hover', 'Subtle left-slide with gold accent reveal'],
            ['Notification', 'Slide-in from right with attention pulse'],
            ['Achievement Unlock', 'Confetti burst + gold shine sweep'],
            ['Trade Execution', 'Success ripple + number count-up with glow'],
          ].map(([interaction, implementation]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 3120, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: interaction, bold: true, color: COLORS.gold, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 6240, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: implementation, color: COLORS.lightGray, size: 18 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 5: NAVIGATION IMPROVEMENTS ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('5. NAVIGATION & INFORMATION ARCHITECTURE')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('5.1 Current Navigation Analysis')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Strengths')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Clear visual hierarchy with sidebar grouping (Dashboard/Admin)', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Effective active state highlighting with gold accent', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Mobile sidebar with spring animation works well', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Badge indicators ("New") for feature discovery', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Weaknesses')]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'No breadcrumbs in nested routes (learning modules/lessons)', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Inconsistent back navigation patterns', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'No keyboard navigation shortcuts', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Search bar doesn\'t persist across navigation', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('5.2 Proposed Navigation Enhancements')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Global Command Palette (Cmd/Ctrl + K)')]
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Implement a spotlight-style command palette for power users:', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Quick navigation to any page', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Search across trades, learning content, achievements', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Quick actions (Add Trade, Start Quiz, etc.)', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Breadcrumb System')]
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Add consistent breadcrumbs to all nested routes:', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Learning > Module Name > Lesson Title', color: COLORS.gold })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Admin > Users > User Detail', color: COLORS.gold })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun('Keyboard Shortcuts')]
      }),
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        columnWidths: [2800, 2800],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'SHORTCUT', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2800, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'ACTION', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Cmd/Ctrl + K', 'Open command palette'],
            ['Cmd/Ctrl + /', 'Toggle AI Coach'],
            ['G then O', 'Go to Overview'],
            ['G then C', 'Go to Companion'],
            ['G then J', 'Go to Journal'],
            ['N', 'New trade entry'],
            ['?', 'Show keyboard shortcuts'],
          ].map(([shortcut, action]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2800, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: shortcut, font: 'JetBrains Mono', color: COLORS.gold, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2800, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: action, color: COLORS.lightGray, size: 18 })] })]
                }),
              ]
            })
          ),
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 6: IMPLEMENTATION ROADMAP ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('6. IMPLEMENTATION ROADMAP')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Phase 1: Foundation & Critical Fixes (Week 1-2)')]
      }),

      new Paragraph({
        shading: { fill: '1B2D1B', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: 'Priority: ', bold: true, color: COLORS.white }),
          new TextRun({ text: 'CRITICAL', bold: true, color: COLORS.green }),
          new TextRun({ text: ' | Estimated Effort: ', color: COLORS.lightGray }),
          new TextRun({ text: '40-60 hours', bold: true, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Create unified LoadingState and ErrorState components', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Fix all accessibility violations (ARIA labels, keyboard navigation)', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement consistent error handling across all pages', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Fix broken "View Setups" button and other dead links', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Add missing md: breakpoints to all grid layouts', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Phase 2: Animation System (Week 3-4)')]
      }),

      new Paragraph({
        shading: { fill: '2D2D1B', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: 'Priority: ', bold: true, color: COLORS.white }),
          new TextRun({ text: 'HIGH', bold: true, color: COLORS.gold }),
          new TextRun({ text: ' | Estimated Effort: ', color: COLORS.lightGray }),
          new TextRun({ text: '50-70 hours', bold: true, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement global animation CSS variables and Tailwind config', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Create page transition wrapper component', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Upgrade Card component with premium entrance animations', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement skeleton loading states for all data-fetching pages', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Add staggered list animations to tables and card grids', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Phase 3: Polish & Micro-Interactions (Week 5-6)')]
      }),

      new Paragraph({
        shading: { fill: '1B1B2D', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: 'Priority: ', bold: true, color: COLORS.white }),
          new TextRun({ text: 'MEDIUM', bold: true, color: COLORS.blue }),
          new TextRun({ text: ' | Estimated Effort: ', color: COLORS.lightGray }),
          new TextRun({ text: '40-50 hours', bold: true, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement button ripple effects and loading states', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Add hover tilt effects to cards', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Create live indicator component for real-time features', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement profit/loss visual feedback system', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Add achievement celebration animations', color: COLORS.lightGray })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Phase 4: Navigation & UX Enhancements (Week 7-8)')]
      }),

      new Paragraph({
        shading: { fill: '2D1B2D', type: ShadingType.CLEAR },
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({ text: 'Priority: ', bold: true, color: COLORS.white }),
          new TextRun({ text: 'ENHANCEMENT', bold: true, color: COLORS.purple }),
          new TextRun({ text: ' | Estimated Effort: ', color: COLORS.lightGray }),
          new TextRun({ text: '30-40 hours', bold: true, color: COLORS.white }),
        ]
      }),

      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Build command palette (Cmd+K) component', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Implement global keyboard shortcuts', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Add breadcrumb navigation to nested routes', color: COLORS.lightGray })]
      }),
      new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: [new TextRun({ text: 'Create onboarding tour for new users', color: COLORS.lightGray })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ========== SECTION 7: SUMMARY ==========
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('7. SUMMARY & EXPECTED OUTCOMES')]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Total Estimated Investment')]
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4680, 2340, 2340],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 4680, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'PHASE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'HOURS', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TIMELINE', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['Phase 1: Foundation & Critical Fixes', '40-60 hrs', 'Week 1-2'],
            ['Phase 2: Animation System', '50-70 hrs', 'Week 3-4'],
            ['Phase 3: Polish & Micro-Interactions', '40-50 hrs', 'Week 5-6'],
            ['Phase 4: Navigation & UX', '30-40 hrs', 'Week 7-8'],
          ].map(([phase, hours, timeline]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 4680, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: phase, color: COLORS.white, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: hours, color: COLORS.gold, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: timeline, color: COLORS.lightGray, size: 18 })] })]
                }),
              ]
            })
          ),
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 4680, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '160-220 hrs', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '8 weeks', bold: true, color: COLORS.black, size: 20 })] })]
              }),
            ]
          }),
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Expected Score Improvements')]
      }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4680, 2340, 2340],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.purple, type: ShadingType.CLEAR },
                borders,
                width: { size: 4680, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'CATEGORY', bold: true, color: COLORS.white, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.purple, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CURRENT', bold: true, color: COLORS.white, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.purple, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TARGET', bold: true, color: COLORS.white, size: 20 })] })]
              }),
            ]
          }),
          ...[
            ['User Experience', '6.5', '9.0'],
            ['Navigation', '7.0', '9.5'],
            ['Mobile Responsiveness', '5.5', '9.0'],
            ['Animation & Transitions', '5.0', '9.5'],
            ['Visual Polish', '6.0', '9.0'],
            ['Accessibility', '4.0', '8.5'],
            ['Loading/Error States', '5.0', '9.0'],
            ['Premium Feel', '4.0', '9.5'],
          ].map(([category, current, target]) =>
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 4680, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: category, color: COLORS.white, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: current, color: COLORS.red, size: 18 })] })]
                }),
                new TableCell({
                  shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
                  borders,
                  width: { size: 2340, type: WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: target, bold: true, color: COLORS.green, size: 18 })] })]
                }),
              ]
            })
          ),
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 4680, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: 'OVERALL PLATFORM', bold: true, color: COLORS.black, size: 20 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '5.4/10', bold: true, color: COLORS.black, size: 22 })] })]
              }),
              new TableCell({
                shading: { fill: COLORS.gold, type: ShadingType.CLEAR },
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '9.1/10', bold: true, color: COLORS.black, size: 22 })] })]
              }),
            ]
          }),
        ]
      }),

      new Paragraph({ spacing: { after: 400 } }),

      // Final statement
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: COLORS.darkGray, type: ShadingType.CLEAR },
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: 'The goal: Transform KCU Coach from a ', font: 'Arial', size: 24, italics: true, color: COLORS.lightGray }),
          new TextRun({ text: 'functional tool', font: 'Arial', size: 24, italics: true, color: COLORS.gray }),
          new TextRun({ text: ' into a ', font: 'Arial', size: 24, italics: true, color: COLORS.lightGray }),
          new TextRun({ text: 'premium trading experience', font: 'Arial', size: 24, italics: true, bold: true, color: COLORS.gold }),
          new TextRun({ text: ' that traders are proud to use and show off.', font: 'Arial', size: 24, italics: true, color: COLORS.lightGray }),
        ]
      }),

      new Paragraph({ spacing: { after: 600 } }),

      // End flourish
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: '\u2501'.repeat(10), color: COLORS.gray }),
          new TextRun({ text: ' \u2B21 ', color: COLORS.gold, size: 28 }),
          new TextRun({ text: '\u2501'.repeat(10), color: COLORS.gray }),
        ]
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: 'End of Proposal', font: 'Arial', size: 20, color: COLORS.gray }),
        ]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/upbeat-tender-cori/mnt/kcu-coach-dashboard/KCU_Coach_UX_Audit_Proposal.docx', buffer);
  console.log('Document created successfully!');
});
