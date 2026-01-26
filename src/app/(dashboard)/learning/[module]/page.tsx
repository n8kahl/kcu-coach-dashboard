import { redirect } from 'next/navigation';

/**
 * Legacy Course Player Redirect
 *
 * This page previously displayed the course player.
 * Now redirects to the canonical /learn/[courseSlug] route.
 */
export default async function CoursePlayerPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module: courseSlug } = await params;
  redirect(`/learn/${courseSlug}`);
}
