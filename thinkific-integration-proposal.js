const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  PageBreak,
  LevelFormat,
} = require("docx");
const fs = require("fs");

// Border style for tables
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "1A1A2E", type: ShadingType.CLEAR };
const altRowShading = { fill: "F8F9FA", type: ShadingType.CLEAR };
const margins = { top: 80, bottom: 80, left: 120, right: 120 };

// Helper function to create a table cell
function cell(text, options = {}) {
  const {
    bold = false,
    color = "000000",
    shading = null,
    width = null,
    alignment = AlignmentType.LEFT,
    fontSize = 20,
  } = options;

  return new TableCell({
    borders,
    shading,
    margins,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    verticalAlign: "center",
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            bold,
            color,
            size: fontSize,
            font: "Arial",
          }),
        ],
      }),
    ],
  });
}

// Create the document
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22 },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "F5A623" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1A1A2E" },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "\u25E6",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "phases",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "Phase %1:",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 720 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "KCU Coach Dashboard | Thinkific Integration Proposal",
                  size: 18,
                  color: "666666",
                  font: "Arial",
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Page ", size: 18, color: "666666" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" }),
                new TextRun({ text: " | Confidential", size: 18, color: "666666" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Title Page
        new Paragraph({ spacing: { after: 600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "THINKIFIC INTEGRATION PROPOSAL",
              bold: true,
              size: 48,
              color: "F5A623",
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 },
          children: [
            new TextRun({
              text: "KCU Coach Dashboard",
              size: 32,
              color: "1A1A2E",
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({
              text: "Production-Level Integration Architecture & Implementation Plan",
              size: 24,
              color: "666666",
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [
            new TextRun({ text: "Prepared: January 2026", size: 22, color: "666666" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Version: 1.0", size: 22, color: "666666" }),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Executive Summary
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("Executive Summary")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "This proposal outlines a comprehensive integration between KCU Coach Dashboard and Thinkific LMS to create a unified learning experience. The integration will seamlessly link courses, quizzes, videos, and analytics from Thinkific while preserving KCU Coach's existing gamification, social sharing, and advanced analytics features.",
            }),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun("Key Benefits")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun("Single source of truth for course content managed in Thinkific"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun("Real-time progress synchronization across platforms"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun("Enhanced analytics combining Thinkific data with KCU Coach's LTP metrics"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun("Preserved gamification system (achievements, win cards, leaderboards)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun("Maintained social sharing capabilities for trading wins"),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 1: Thinkific API Overview
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("1. Thinkific API Capabilities")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Thinkific provides both REST and GraphQL APIs for comprehensive platform integration. Based on our analysis, here are the key capabilities:",
            }),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("1.1 REST API Endpoints")],
        }),

        // REST API Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2500, 6860],
          rows: [
            new TableRow({
              children: [
                cell("Endpoint", { bold: true, color: "FFFFFF", shading: headerShading, width: 2500 }),
                cell("Capabilities", { bold: true, color: "FFFFFF", shading: headerShading, width: 6860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/courses", { bold: true, width: 2500 }),
                cell("List all courses, get course by ID, view curriculum (chapters/lessons)", { width: 6860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/chapters", { bold: true, width: 2500, shading: altRowShading }),
                cell("Get chapter details, list lessons within chapters", { width: 6860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("/contents", { bold: true, width: 2500 }),
                cell("Access lesson content, video metadata, quizzes", { width: 6860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/users", { bold: true, width: 2500, shading: altRowShading }),
                cell("User management, profiles (with appropriate scopes)", { width: 6860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("/enrollments", { bold: true, width: 2500 }),
                cell("View/manage user enrollments, enrollment status", { width: 6860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/products", { bold: true, width: 2500, shading: altRowShading }),
                cell("Product catalog, bundles, pricing", { width: 6860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("/bundles", { bold: true, width: 2500 }),
                cell("Course bundles and collections", { width: 6860 }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("1.2 GraphQL API (Recommended)")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Thinkific recommends using GraphQL for new integrations as it provides deeper access to student-related data:",
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Quiz Results: ", bold: true }),
            new TextRun("Grades, attempts, individual question answers"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Course Completion: ", bold: true }),
            new TextRun("Detailed progress tracking per student"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Survey Submissions: ", bold: true }),
            new TextRun("Student feedback and responses"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Assignment Data: ", bold: true }),
            new TextRun("Submissions and grading automation"),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("1.3 Webhook Events")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Real-time event notifications for immediate synchronization:",
            }),
          ],
        }),

        // Webhooks Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({
              children: [
                cell("Event", { bold: true, color: "FFFFFF", shading: headerShading, width: 3000 }),
                cell("Use Case in KCU Coach", { bold: true, color: "FFFFFF", shading: headerShading, width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("user.created", { bold: true, width: 3000 }),
                cell("Sync new users, create KCU Coach profiles", { width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("enrollment.created", { bold: true, width: 3000, shading: altRowShading }),
                cell("Initialize progress tracking, unlock modules", { width: 6360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("lesson.completed", { bold: true, width: 3000 }),
                cell("Update progress, trigger achievement checks", { width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("enrollment.progress", { bold: true, width: 3000, shading: altRowShading }),
                cell("Real-time progress percentage updates", { width: 6360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("course.completed", { bold: true, width: 3000 }),
                cell("Award achievements, update leaderboard, enable win cards", { width: 6360 }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("1.4 Rate Limits")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "REST API: ", bold: true }),
            new TextRun("120 requests/minute, max 10 concurrent requests"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "GraphQL API: ", bold: true }),
            new TextRun("Cost-based limiting (query complexity determines cost)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Webhooks: ", bold: true }),
            new TextRun("14 retry attempts over 16 hours, 30-day history retention"),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 2: Current KCU Coach Architecture
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("2. Current KCU Coach Architecture")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Understanding the existing system is critical for seamless integration. Here's what we're working with:",
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2.1 Technology Stack")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Frontend: ", bold: true }),
            new TextRun("Next.js 14+ with React, TypeScript, Tailwind CSS"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Backend: ", bold: true }),
            new TextRun("Next.js API Routes, Supabase (PostgreSQL)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Auth: ", bold: true }),
            new TextRun("Supabase Auth with Discord OAuth"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Real-time: ", bold: true }),
            new TextRun("Supabase Realtime subscriptions"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Caching: ", bold: true }),
            new TextRun("Redis for market data and session management"),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("2.2 Existing Learning System")],
        }),

        // Current Learning System Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({
              children: [
                cell("Component", { bold: true, color: "FFFFFF", shading: headerShading, width: 3000 }),
                cell("Current Implementation", { bold: true, color: "FFFFFF", shading: headerShading, width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Modules", { bold: true, width: 3000 }),
                cell("9 modules defined in curriculum.ts (Fundamentals, Price Action, Indicators, LTP Framework, etc.)", { width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Lessons", { bold: true, width: 3000, shading: altRowShading }),
                cell("37+ lessons with video_id references, key takeaways, durations", { width: 6360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Progress Tracking", { bold: true, width: 3000 }),
                cell("user_lesson_progress, user_module_progress tables in Supabase", { width: 6360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Quizzes", { bold: true, width: 3000, shading: altRowShading }),
                cell("quiz_attempts table, JSON questions storage, passing_score thresholds", { width: 6360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Knowledge Base", { bold: true, width: 3000 }),
                cell("knowledge_chunks table for RAG (embeddings for AI coach)", { width: 6360 }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("2.3 Gamification System (TO BE PRESERVED)")],
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: "These features must remain fully functional after integration:",
              italics: true,
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Achievements: ", bold: true }),
            new TextRun("13 achievement types (first_trade, week_streak, quiz_master, ltp_compliant_10, etc.)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Win Cards: ", bold: true }),
            new TextRun("Shareable cards for trades, streaks, milestones with Twitter/download options"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Leaderboards: ", bold: true }),
            new TextRun("Ranking system with weekly competitions"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "XP System: ", bold: true }),
            new TextRun("Experience points tied to achievements and learning progress"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "LTP Scoring: ", bold: true }),
            new TextRun("Levels, Trends, Patience scoring for trade quality analysis"),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 3: Integration Architecture
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("3. Integration Architecture")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("3.1 Data Flow Overview")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "The integration follows a hybrid approach: Thinkific serves as the content source of truth, while KCU Coach maintains its own progress tracking enhanced with Thinkific data.",
            }),
          ],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: "F0F4F8", type: ShadingType.CLEAR },
          spacing: { before: 200, after: 200 },
          children: [
            new TextRun({
              text: "[THINKIFIC] ----webhook/API----> [KCU Coach API] -----> [Supabase]",
              font: "Courier New",
              size: 20,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: "F0F4F8", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "     ^                                    |                    |",
              font: "Courier New",
              size: 20,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: "F0F4F8", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "     |                                    v                    v",
              font: "Courier New",
              size: 20,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: "F0F4F8", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "[Content Mgmt]                    [Gamification]      [Analytics]",
              font: "Courier New",
              size: 20,
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("3.2 New Database Tables")],
        }),

        // New Tables
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3200, 6160],
          rows: [
            new TableRow({
              children: [
                cell("Table Name", { bold: true, color: "FFFFFF", shading: headerShading, width: 3200 }),
                cell("Purpose", { bold: true, color: "FFFFFF", shading: headerShading, width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("thinkific_courses", { bold: true, width: 3200 }),
                cell("Cache Thinkific course data with local mapping to curriculum.ts modules", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("thinkific_lessons", { bold: true, width: 3200, shading: altRowShading }),
                cell("Lesson content cache including video URLs, descriptions, durations", { width: 6160, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("thinkific_enrollments", { bold: true, width: 3200 }),
                cell("User enrollment status synced from Thinkific", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("thinkific_quiz_results", { bold: true, width: 3200, shading: altRowShading }),
                cell("Detailed quiz results including question-level answers", { width: 6160, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("thinkific_sync_log", { bold: true, width: 3200 }),
                cell("Audit trail for sync operations, error tracking", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("user_thinkific_mapping", { bold: true, width: 3200, shading: altRowShading }),
                cell("Link KCU Coach user IDs to Thinkific user IDs", { width: 6160, shading: altRowShading }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("3.3 New API Routes")],
        }),

        // API Routes Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3800, 5560],
          rows: [
            new TableRow({
              children: [
                cell("Route", { bold: true, color: "FFFFFF", shading: headerShading, width: 3800 }),
                cell("Function", { bold: true, color: "FFFFFF", shading: headerShading, width: 5560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/api/thinkific/webhook", { bold: true, width: 3800, fontSize: 18 }),
                cell("Receive and process Thinkific webhook events", { width: 5560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/api/thinkific/sync/courses", { bold: true, width: 3800, fontSize: 18, shading: altRowShading }),
                cell("Manual/scheduled course content sync", { width: 5560, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("/api/thinkific/sync/progress", { bold: true, width: 3800, fontSize: 18 }),
                cell("Sync user progress from Thinkific GraphQL", { width: 5560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("/api/thinkific/quiz-results/[userId]", { bold: true, width: 3800, fontSize: 18, shading: altRowShading }),
                cell("Fetch detailed quiz results for analytics", { width: 5560, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("/api/thinkific/embed/[lessonId]", { bold: true, width: 3800, fontSize: 18 }),
                cell("Generate secure video embed URLs", { width: 5560 }),
              ],
            }),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 4: Implementation Plan
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("4. Implementation Plan")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("Phase 1: Foundation (Week 1-2)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Set up Thinkific API client library with rate limiting")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Create database migrations for new tables")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement secure API key storage (environment variables, not in code)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Build webhook endpoint with signature verification")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Create user mapping system (Thinkific ID <-> KCU Coach ID)")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("Phase 2: Content Sync (Week 3-4)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Build course content sync service")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Map Thinkific courses to existing curriculum.ts modules")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement lesson content fetching with video embed support")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Create quiz question sync (Thinkific -> KCU Coach quiz format)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Build scheduled sync job (daily content refresh)")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("Phase 3: Progress Tracking (Week 5-6)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement webhook handlers for lesson.completed, enrollment.progress")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Sync progress to existing user_lesson_progress table")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Build GraphQL client for detailed quiz results")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Connect progress updates to achievement system")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Trigger XP awards on course/module completion")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("Phase 4: Analytics Integration (Week 7-8)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Build combined analytics dashboard")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Integrate Thinkific quiz scores with LTP performance metrics")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Create learning vs. trading correlation reports")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement admin analytics view for cohort analysis")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("Phase 5: UI Integration (Week 9-10)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Update learning module pages to fetch from Thinkific")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Embed Thinkific video player in lesson pages")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Sync quiz UI with Thinkific quiz data")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Add module completion win cards")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Update LearningProgress component with Thinkific data")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("Phase 6: Testing & Launch (Week 11-12)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("End-to-end testing of full learning flow")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Load testing webhook processing")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Beta testing with select users")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Documentation and runbook creation")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Production deployment with monitoring")],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 5: Technical Specifications
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("5. Technical Specifications")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("5.1 Thinkific Service Module")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "New file: src/lib/thinkific.ts",
              font: "Courier New",
              size: 20,
            }),
          ],
        }),

        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: "// Core Thinkific API client with rate limiting",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "export class ThinkificClient {",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  private apiKey: string;",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  private subdomain: string;",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  private rateLimiter: RateLimiter;",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  ",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // REST API methods",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  getCourses(): Promise<Course[]>",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  getChapters(courseId: string): Promise<Chapter[]>",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  getLessons(chapterId: string): Promise<Lesson[]>",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  getEnrollments(userId: string): Promise<Enrollment[]>",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  ",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // GraphQL methods for detailed data",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  getQuizResults(userId: string, courseId: string)",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: "  getStudentProgress(userId: string): Promise<Progress>",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "}",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("5.2 Webhook Handler Structure")],
        }),

        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: "// src/app/api/thinkific/webhook/route.ts",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "export async function POST(request: NextRequest) {",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // 1. Verify webhook signature",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // 2. Parse event type",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // 3. Route to appropriate handler:",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  //    - handleUserCreated()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  //    - handleEnrollmentCreated()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  //    - handleLessonCompleted()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  //    - handleProgressUpdate()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  //    - handleCourseCompleted()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  // 4. Log to thinkific_sync_log",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "}",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("5.3 Database Migration")],
        }),

        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: "-- 015_thinkific_integration.sql",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "CREATE TABLE thinkific_courses (",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  id UUID PRIMARY KEY,",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  thinkific_id INTEGER UNIQUE NOT NULL,",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  local_module_id UUID REFERENCES learning_modules(id),",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  name VARCHAR(255),",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  description TEXT,",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  slug VARCHAR(100),",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  chapters_count INTEGER,",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "  synced_at TIMESTAMPTZ DEFAULT NOW()",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),
        new Paragraph({
          shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: ");",
              font: "Courier New",
              size: 18,
            }),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 6: Gamification Integration
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("6. Gamification Integration Points")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "The following gamification triggers will be connected to Thinkific events:",
            }),
          ],
        }),

        // Gamification Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2800, 3000, 3560],
          rows: [
            new TableRow({
              children: [
                cell("Thinkific Event", { bold: true, color: "FFFFFF", shading: headerShading, width: 2800 }),
                cell("Gamification Action", { bold: true, color: "FFFFFF", shading: headerShading, width: 3000 }),
                cell("Achievement/Reward", { bold: true, color: "FFFFFF", shading: headerShading, width: 3560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("First lesson.completed", { width: 2800 }),
                cell("Award XP, check streak", { width: 3000 }),
                cell("Possible: first_trade equivalent", { width: 3560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Quiz 100% score", { width: 2800, shading: altRowShading }),
                cell("Track perfect quizzes", { width: 3000, shading: altRowShading }),
                cell("quiz_master (5 perfect quizzes)", { width: 3560, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("course.completed", { width: 2800 }),
                cell("Major XP award, unlock win card", { width: 3000 }),
                cell("Module completion badge", { width: 3560 }),
              ],
            }),
            new TableRow({
              children: [
                cell("7 consecutive days", { width: 2800, shading: altRowShading }),
                cell("Streak achievement", { width: 3000, shading: altRowShading }),
                cell("week_streak (7-day engagement)", { width: 3560, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("All modules complete", { width: 2800 }),
                cell("Graduation achievement", { width: 3000 }),
                cell("New: ltp_graduate badge", { width: 3560 }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("6.1 New Achievement Types")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Add to the existing achievement definitions in achievements/route.ts:",
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "module_complete_[slug]: ", bold: true }),
            new TextRun("Completed [Module Name] module"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "ltp_graduate: ", bold: true }),
            new TextRun("Completed all LTP Framework modules"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "learning_streak_30: ", bold: true }),
            new TextRun("30-day learning streak"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "quiz_perfectionist: ", bold: true }),
            new TextRun("100% on all module quizzes"),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 7: Analytics Dashboard
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("7. Analytics Dashboard Enhancements")],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "The integration will enable powerful cross-platform analytics:",
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("7.1 User Analytics View")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Combined learning progress (Thinkific) + trading performance (KCU)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Quiz scores correlated with LTP compliance scores")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Time spent learning vs. trading win rate trends")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Module completion timeline with milestone markers")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("7.2 Admin Analytics View")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Cohort analysis: learning progress by enrollment month")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Drop-off analysis: which lessons/modules lose students")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Quiz difficulty analysis: question-level pass rates")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Correlation: module completion rates vs. trading success")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("7.3 Sample Dashboard Metrics")],
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({
              children: [
                cell("Metric", { bold: true, color: "FFFFFF", shading: headerShading, width: 4680 }),
                cell("Data Source", { bold: true, color: "FFFFFF", shading: headerShading, width: 4680 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Overall Course Completion Rate", { width: 4680 }),
                cell("Thinkific GraphQL API", { width: 4680 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Average Quiz Score by Module", { width: 4680, shading: altRowShading }),
                cell("Thinkific Quiz Results + KCU quiz_attempts", { width: 4680, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Learning-to-Trading Conversion", { width: 4680 }),
                cell("Cross-reference: Thinkific completion + KCU trades", { width: 4680 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Most Rewatched Lessons", { width: 4680, shading: altRowShading }),
                cell("Thinkific video engagement data", { width: 4680, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("LTP Compliance by Module Completed", { width: 4680 }),
                cell("KCU trades.ltp_score + thinkific_courses", { width: 4680 }),
              ],
            }),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 8: Security Considerations
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("8. Security Considerations")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("8.1 API Key Management")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "NEVER ", bold: true }),
            new TextRun("store API keys in code or share in chat (as was done in the initial request)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Use environment variables: THINKIFIC_API_KEY, THINKIFIC_SUBDOMAIN")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Rotate API keys periodically (recommend quarterly)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Use separate keys for development/staging/production")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("8.2 Webhook Security")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Verify webhook signatures using Thinkific's signing secret")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement replay attack prevention (check timestamps)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Use HTTPS only for webhook endpoints")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Log all webhook events for audit trail")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("8.3 Data Privacy")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Only sync necessary user data (avoid PII where possible)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Implement data retention policies for synced data")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Respect Thinkific's data handling requirements")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun("Enable user data export/deletion for GDPR compliance")],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 9: Risk Mitigation
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("9. Risk Mitigation")],
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [2800, 3200, 3360],
          rows: [
            new TableRow({
              children: [
                cell("Risk", { bold: true, color: "FFFFFF", shading: headerShading, width: 2800 }),
                cell("Impact", { bold: true, color: "FFFFFF", shading: headerShading, width: 3200 }),
                cell("Mitigation", { bold: true, color: "FFFFFF", shading: headerShading, width: 3360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Thinkific API downtime", { width: 2800 }),
                cell("Learning content unavailable", { width: 3200 }),
                cell("Cache content locally with 24hr TTL, graceful degradation", { width: 3360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Rate limit exceeded", { width: 2800, shading: altRowShading }),
                cell("Sync failures, stale data", { width: 3200, shading: altRowShading }),
                cell("Implement exponential backoff, queue system for bulk ops", { width: 3360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Webhook delivery failure", { width: 2800 }),
                cell("Progress not synced", { width: 3200 }),
                cell("Scheduled sync job as backup, manual sync option", { width: 3360 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Data mapping errors", { width: 2800, shading: altRowShading }),
                cell("Wrong content displayed", { width: 3200, shading: altRowShading }),
                cell("Thorough testing, admin override capability", { width: 3360, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("API breaking changes", { width: 2800 }),
                cell("Integration breaks", { width: 3200 }),
                cell("Version pinning, monitoring Thinkific changelogs", { width: 3360 }),
              ],
            }),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 10: Timeline & Resources
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("10. Timeline & Resource Estimates")],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("10.1 Timeline Summary")],
        }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [4000, 2500, 2860],
          rows: [
            new TableRow({
              children: [
                cell("Phase", { bold: true, color: "FFFFFF", shading: headerShading, width: 4000 }),
                cell("Duration", { bold: true, color: "FFFFFF", shading: headerShading, width: 2500 }),
                cell("Dependencies", { bold: true, color: "FFFFFF", shading: headerShading, width: 2860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 1: Foundation", { width: 4000 }),
                cell("2 weeks", { width: 2500 }),
                cell("Thinkific API access", { width: 2860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 2: Content Sync", { width: 4000, shading: altRowShading }),
                cell("2 weeks", { width: 2500, shading: altRowShading }),
                cell("Phase 1 complete", { width: 2860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 3: Progress Tracking", { width: 4000 }),
                cell("2 weeks", { width: 2500 }),
                cell("Phase 2, Webhooks configured", { width: 2860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 4: Analytics Integration", { width: 4000, shading: altRowShading }),
                cell("2 weeks", { width: 2500, shading: altRowShading }),
                cell("Phases 1-3 complete", { width: 2860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 5: UI Integration", { width: 4000 }),
                cell("2 weeks", { width: 2500 }),
                cell("Phases 1-4 complete", { width: 2860 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Phase 6: Testing & Launch", { width: 4000, shading: altRowShading }),
                cell("2 weeks", { width: 2500, shading: altRowShading }),
                cell("All phases complete", { width: 2860, shading: altRowShading }),
              ],
            }),
            new TableRow({
              children: [
                cell("TOTAL", { bold: true, width: 4000 }),
                cell("12 weeks", { bold: true, width: 2500 }),
                cell("", { width: 2860 }),
              ],
            }),
          ],
        }),

        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun("10.2 Required Resources")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Development: ", bold: true }),
            new TextRun("1 Full-stack developer (primary), 1 Frontend developer (UI phase)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Testing: ", bold: true }),
            new TextRun("QA resources for end-to-end testing, beta users"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Infrastructure: ", bold: true }),
            new TextRun("Minimal additional costs (existing Supabase/Redis infrastructure)"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [
            new TextRun({ text: "Thinkific: ", bold: true }),
            new TextRun("API access (verify current plan includes API access)"),
          ],
        }),

        // Page Break
        new Paragraph({ children: [new PageBreak()] }),

        // Section 11: Next Steps
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun("11. Recommended Next Steps")],
        }),

        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: [
            new TextRun({ text: "Regenerate API Key: ", bold: true }),
            new TextRun("The key shared in chat should be revoked and replaced immediately"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: [
            new TextRun({ text: "Verify Thinkific Plan: ", bold: true }),
            new TextRun("Confirm API access is included in your current subscription"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: [
            new TextRun({ text: "Review & Approve Proposal: ", bold: true }),
            new TextRun("Stakeholder sign-off on scope and timeline"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: [
            new TextRun({ text: "Set Up Development Environment: ", bold: true }),
            new TextRun("Create staging Thinkific instance for testing"),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          children: [
            new TextRun({ text: "Begin Phase 1: ", bold: true }),
            new TextRun("Start with API client development and database migrations"),
          ],
        }),

        new Paragraph({
          spacing: { before: 400 },
          shading: { fill: "FFF8E1", type: ShadingType.CLEAR },
          children: [
            new TextRun({
              text: "IMPORTANT SECURITY NOTE: ",
              bold: true,
              color: "F57C00",
            }),
            new TextRun({
              text: "Please regenerate your Thinkific API key immediately, as it was shared in plain text. Store the new key securely in environment variables only.",
              color: "333333",
            }),
          ],
        }),

        // Footer
        new Paragraph({
          spacing: { before: 600 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "--- End of Proposal ---",
              color: "666666",
              italics: true,
            }),
          ],
        }),
      ],
    },
  ],
});

// Generate the document
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(
    "/sessions/clever-happy-ride/mnt/kcu-coach-dashboard/Thinkific_Integration_Proposal.docx",
    buffer
  );
  console.log("Document created successfully!");
});
