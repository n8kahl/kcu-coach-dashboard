import { redirect } from 'next/navigation';

/**
 * Legacy Lesson Page Redirect
 *
 * This page previously displayed individual lessons.
 * Now redirects to the resolver API which maps to the canonical /learn path.
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ module: string; lesson: string }>;
}) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  redirect(`/api/learn/resolve-legacy?module=${encodeURIComponent(moduleSlug)}&lesson=${encodeURIComponent(lessonSlug)}`);
}
