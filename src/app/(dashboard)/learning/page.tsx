import { redirect } from 'next/navigation';

/**
 * Legacy Learning Page Redirect
 *
 * This page previously displayed the course library.
 * Now redirects to the canonical /learn route.
 */
export default function LearningPage() {
  redirect('/learn');
}
