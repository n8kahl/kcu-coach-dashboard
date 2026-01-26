import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * Lesson Resolver Route
 *
 * Resolves legacy AI/chat links in the format /learn/lesson/[moduleSlug]/[lessonSlug]
 * to the canonical /learn/[courseSlug]/[moduleSlug]/[lessonSlug] path.
 *
 * Queries the native course_* schema to find matching lesson.
 */

interface PageProps {
  params: Promise<{
    moduleSlug: string;
    lessonSlug: string;
  }>;
}

// Type for the Supabase query result
interface LessonQueryResult {
  id: string;
  slug: string;
  title: string;
  course_modules: {
    id: string;
    slug: string;
    title: string;
    courses: {
      id: string;
      slug: string;
      title: string;
    };
  };
}

export default async function LessonResolverPage({ params }: PageProps) {
  const { moduleSlug, lessonSlug } = await params;

  // Query Supabase to find the course, module, and lesson
  // We need to join course_lessons -> course_modules -> courses
  const { data: lessonData, error } = await supabaseAdmin
    .from('course_lessons')
    .select(`
      id,
      slug,
      title,
      course_modules!inner (
        id,
        slug,
        title,
        courses!inner (
          id,
          slug,
          title
        )
      )
    `)
    .eq('slug', lessonSlug)
    .eq('course_modules.slug', moduleSlug)
    .single();

  if (error || !lessonData) {
    // Try alternative: maybe the lesson exists but with a different module slug
    // Search by lesson slug alone
    const { data: altData } = await supabaseAdmin
      .from('course_lessons')
      .select(`
        id,
        slug,
        title,
        course_modules!inner (
          id,
          slug,
          title,
          courses!inner (
            id,
            slug,
            title
          )
        )
      `)
      .eq('slug', lessonSlug)
      .single();

    if (altData) {
      // Found lesson by slug alone, redirect to canonical path
      const result = altData as unknown as LessonQueryResult;
      const courseSlug = result.course_modules.courses.slug;
      const foundModuleSlug = result.course_modules.slug;
      redirect(`/learn/${courseSlug}/${foundModuleSlug}/${result.slug}`);
    }

    // Lesson not found - render error page
    return (
      <>
        <Header
          title="Lesson Not Found"
          breadcrumbs={[
            { label: 'Dashboard' },
            { label: 'Learning', href: '/learn' },
            { label: 'Not Found' },
          ]}
        />
        <PageShell>
          <div className="max-w-lg mx-auto">
            <Card className="border-[var(--border-secondary)]">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="w-16 h-16 flex items-center justify-center bg-[var(--bg-tertiary)]">
                    <AlertCircle className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                      Lesson Not Found
                    </h2>
                    <p className="text-[var(--text-secondary)] mb-4">
                      The lesson you&apos;re looking for couldn&apos;t be found. It may have been moved or removed.
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Looking for: <code className="text-[var(--accent-primary)]">{moduleSlug}/{lessonSlug}</code>
                    </p>
                  </div>

                  <Link href="/learn">
                    <Button variant="primary" icon={<ArrowLeft className="w-4 h-4" />}>
                      Back to Learning
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </PageShell>
      </>
    );
  }

  // Found the lesson - redirect to canonical path
  const result = lessonData as unknown as LessonQueryResult;
  const courseSlug = result.course_modules.courses.slug;
  const foundModuleSlug = result.course_modules.slug;

  redirect(`/learn/${courseSlug}/${foundModuleSlug}/${result.slug}`);
}
