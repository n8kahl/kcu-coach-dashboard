# Seed Curriculum - Claude Code MCP Prompt

Copy and paste this prompt into Claude Code that has the Supabase MCP server connected:

---

## Prompt

```
Execute the SQL script at scripts/seed-curriculum.sql against the Supabase database.

This script seeds the curriculum content:
- Creates the course "kcu-trading-mastery"
- Creates 9 modules (fundamentals, price-action, indicators, ltp-framework, strategies, entries-exits, psychology, trading-rules, watchlist-setup)
- Creates 37 lessons with video IDs, durations, and descriptions

The script uses ON CONFLICT clauses so it's safe to run multiple times (idempotent).

After running, verify by querying:
1. SELECT count(*) FROM courses WHERE slug = 'kcu-trading-mastery';
2. SELECT count(*) FROM course_modules;
3. SELECT count(*) FROM course_lessons;

Expected results: 1 course, 9 modules, 37 lessons.
```

---

## Alternative: Supabase Dashboard

If MCP doesn't work:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `scripts/seed-curriculum.sql`
4. Paste and click **Run**

---

## What This Fixes

After seeding, the AI recommendation flow works:

```
AI recommends: [[LESSON:ltp-framework/patience-candles|...]]
     ↓
User clicks → /learn/lesson/ltp-framework/patience-candles
     ↓
Resolver queries Supabase → FINDS THE LESSON ✓
     ↓
Redirects to /learn/kcu-trading-mastery/ltp-framework/patience-candles
     ↓
Lesson page loads with video content ✓
```

---

## Verification Queries

After seeding, run these to confirm:

```sql
-- Check course
SELECT id, slug, title FROM courses WHERE slug = 'kcu-trading-mastery';

-- Check modules
SELECT cm.slug, cm.title, cm.sort_order
FROM course_modules cm
JOIN courses c ON cm.course_id = c.id
WHERE c.slug = 'kcu-trading-mastery'
ORDER BY cm.sort_order;

-- Check lessons count per module
SELECT cm.slug as module, COUNT(cl.id) as lessons
FROM course_modules cm
JOIN courses c ON cm.course_id = c.id
LEFT JOIN course_lessons cl ON cl.module_id = cm.id
WHERE c.slug = 'kcu-trading-mastery'
GROUP BY cm.slug, cm.sort_order
ORDER BY cm.sort_order;
```
