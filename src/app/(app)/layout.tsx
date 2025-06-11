import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { AblyProvider } from '@/components/providers/ably-provider';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default async function AuthenticatedLayout({
  children
}: AuthenticatedLayoutProps) {
  // Check authentication
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Wrap children with AblyProvider for real-time features
  return (
    <AblyProvider>
      {children}
    </AblyProvider>
  );
}