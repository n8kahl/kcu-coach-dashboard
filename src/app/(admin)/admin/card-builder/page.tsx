'use client';

import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { CardBuilder } from '@/components/admin/card-builder';

export default function CardBuilderPage() {
  return (
    <>
      <Header
        title="Card Builder"
        subtitle="Create and customize trade win card templates"
        breadcrumbs={[
          { label: 'Admin', href: '/admin/users' },
          { label: 'Card Builder' },
        ]}
      />

      <PageShell padding="none" maxWidth="full">
        <CardBuilder />
      </PageShell>
    </>
  );
}
