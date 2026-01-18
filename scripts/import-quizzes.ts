/**
 * Quiz Import Script
 *
 * Imports quiz questions from CSV files into the database.
 *
 * Usage:
 *   npx ts-node scripts/import-quizzes.ts --path="/path/to/quizzes" --dry-run
 *   npx ts-node scripts/import-quizzes.ts --path="/path/to/quizzes"
 *
 * CSV Format:
 *   QuestionType,QuestionText,Explanation,Choice1,Choice2,Choice3,Choice4,...
 *   SA,Question text here,Explanation text,*Correct answer,Wrong1,Wrong2,Wrong3
 *
 * - QuestionType: SA (Single Answer), MA (Multiple Answer)
 * - Correct answers are prefixed with *
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface QuizQuestion {
  type: 'single' | 'multiple';
  text: string;
  explanation: string;
  choices: { text: string; isCorrect: boolean }[];
}

interface QuizFile {
  filePath: string;
  moduleNumber: string;
  questions: QuizQuestion[];
}

interface CsvRow {
  QuestionType?: string;
  QuestionText?: string;
  Explanation?: string;
  [key: string]: string | undefined;
}

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const QUIZ_PATH = getArg('path') || '/path/to/quizzes';
const DRY_RUN = args.includes('--dry-run');
const COURSE_SLUG = getArg('course') || 'kcu-trading-mastery';

function findQuizFiles(basePath: string): string[] {
  const quizFiles: string[] = [];

  if (!fs.existsSync(basePath)) {
    console.error(`Error: Path does not exist: ${basePath}`);
    return quizFiles;
  }

  // Check if basePath itself contains CSV files
  const baseFiles = fs.readdirSync(basePath);
  for (const file of baseFiles) {
    const filePath = path.join(basePath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && file.endsWith('.csv') && file.toLowerCase().includes('quiz')) {
      quizFiles.push(filePath);
    } else if (stat.isDirectory()) {
      // Recursively search subdirectories
      const subFiles = findQuizFiles(filePath);
      quizFiles.push(...subFiles);
    }
  }

  return quizFiles;
}

function parseQuizCSV(filePath: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Parse CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relaxColumnCount: true,
    }) as CsvRow[];

    for (const row of records) {
      // Get question type
      const questionType = row.QuestionType?.toUpperCase() === 'MA' ? 'multiple' : 'single';

      // Get question text and explanation
      const questionText = row.QuestionText?.trim();
      const explanation = row.Explanation?.trim() || '';

      if (!questionText) {
        console.warn(`  Skipping row with empty question text`);
        continue;
      }

      // Parse choices (Choice1, Choice2, ..., Choice10)
      const choices: { text: string; isCorrect: boolean }[] = [];
      for (let i = 1; i <= 10; i++) {
        const choiceText = row[`Choice${i}`]?.trim();
        if (!choiceText) continue;

        const isCorrect = choiceText.startsWith('*');
        choices.push({
          text: isCorrect ? choiceText.slice(1).trim() : choiceText,
          isCorrect,
        });
      }

      if (choices.length < 2) {
        console.warn(`  Skipping question with less than 2 choices: ${questionText.slice(0, 50)}...`);
        continue;
      }

      questions.push({
        type: questionType,
        text: questionText,
        explanation,
        choices,
      });
    }
  } catch (error) {
    console.error(`Error parsing CSV ${filePath}:`, error);
  }

  return questions;
}

function extractModuleNumber(filePath: string): string {
  const filename = path.basename(filePath);

  // Try different patterns
  const patterns = [
    /Module[_\s]*(\d+(?:\.\d+)?)/i,
    /Mod[_\s]*(\d+(?:\.\d+)?)/i,
    /M(\d+(?:\.\d+)?)/i,
    /^(\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return '0';
}

async function importQuizzes() {
  console.log('='.repeat(60));
  console.log('KCU Quiz Import Script');
  console.log('='.repeat(60));
  console.log(`\nSource: ${QUIZ_PATH}`);
  console.log(`Course: ${COURSE_SLUG}`);
  console.log(`Dry Run: ${DRY_RUN}\n`);

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: Supabase credentials are required');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find quiz files
  console.log('Searching for quiz files...');
  const quizFiles = findQuizFiles(QUIZ_PATH);
  console.log(`Found ${quizFiles.length} quiz files\n`);

  if (quizFiles.length === 0) {
    console.log('No quiz files found. Exiting.');
    return;
  }

  // Parse all quiz files
  const quizData: QuizFile[] = [];
  for (const filePath of quizFiles) {
    const moduleNumber = extractModuleNumber(filePath);
    const questions = parseQuizCSV(filePath);

    if (questions.length > 0) {
      quizData.push({
        filePath,
        moduleNumber,
        questions,
      });
      console.log(`  Module ${moduleNumber}: ${questions.length} questions (${path.basename(filePath)})`);
    }
  }

  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN - No changes will be made\n');
    for (const quiz of quizData) {
      console.log(`Module ${quiz.moduleNumber}: ${quiz.questions.length} questions`);
      for (const q of quiz.questions.slice(0, 3)) {
        console.log(`  - ${q.text.slice(0, 60)}...`);
        console.log(`    Choices: ${q.choices.length} (${q.choices.filter(c => c.isCorrect).length} correct)`);
      }
      if (quiz.questions.length > 3) {
        console.log(`  ... and ${quiz.questions.length - 3} more`);
      }
    }
    return;
  }

  // Get course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', COURSE_SLUG)
    .single();

  if (courseError || !course) {
    console.error('Error: Course not found. Run migrate-videos.ts first.');
    process.exit(1);
  }

  // Import quizzes
  let totalImported = 0;
  let totalErrors = 0;

  for (const quiz of quizData) {
    console.log(`\nImporting Module ${quiz.moduleNumber}...`);

    // Get module
    const { data: module, error: moduleError } = await supabase
      .from('course_modules')
      .select('id')
      .eq('course_id', course.id)
      .eq('module_number', quiz.moduleNumber)
      .single();

    if (moduleError || !module) {
      console.error(`  Module ${quiz.moduleNumber} not found, skipping`);
      totalErrors += quiz.questions.length;
      continue;
    }

    // Delete existing questions for this module (to avoid duplicates)
    await supabase
      .from('course_quiz_questions')
      .delete()
      .eq('module_id', module.id);

    // Import questions
    let order = 0;
    for (const question of quiz.questions) {
      // Insert question
      const { data: questionData, error: questionError } = await supabase
        .from('course_quiz_questions')
        .insert({
          module_id: module.id,
          question_type: question.type,
          question_text: question.text,
          explanation: question.explanation,
          sort_order: order++,
          is_published: true,
        })
        .select()
        .single();

      if (questionError) {
        console.error(`  Error inserting question: ${questionError.message}`);
        totalErrors++;
        continue;
      }

      // Insert choices
      const choicesToInsert = question.choices.map((choice, i) => ({
        question_id: questionData.id,
        choice_text: choice.text,
        is_correct: choice.isCorrect,
        sort_order: i,
      }));

      const { error: choicesError } = await supabase
        .from('course_quiz_choices')
        .insert(choicesToInsert);

      if (choicesError) {
        console.error(`  Error inserting choices: ${choicesError.message}`);
        totalErrors++;
        continue;
      }

      totalImported++;
    }

    console.log(`  Imported ${quiz.questions.length} questions`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Import Summary');
  console.log('='.repeat(60));
  console.log(`Total questions imported: ${totalImported}`);
  console.log(`Errors: ${totalErrors}`);
  console.log('\nImport complete!');
}

// Run
importQuizzes().catch(console.error);
