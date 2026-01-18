import { redirect } from 'next/navigation';

/**
 * Content Sync has been consolidated into Knowledge CMS
 * Redirect to the new unified page
 */
export default function ContentSyncPage() {
  redirect('/admin/knowledge');
}
