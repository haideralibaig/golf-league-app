import { clerkMiddleware, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  
  // Only process authenticated users
  if (userId) {
    try {
      // Check if user is already marked as synced in their session metadata
      const dbSynced = sessionClaims?.publicMetadata?.db_synced;
      
      if (!dbSynced) {
        // User not marked as synced, call our internal API to handle sync
        try {
          const baseUrl = req.nextUrl.origin;
          const syncResponse = await fetch(`${baseUrl}/api/internal/sync-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userId}`, // Use userId as auth token for internal API
            },
            body: JSON.stringify({ userId }),
          });
          
          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log(`User sync completed for ${userId}:`, syncResult.message);
            
            // Mark user as synced in their Clerk metadata to avoid future DB checks
            try {
              const clerk = await clerkClient();
              await clerk.users.updateUserMetadata(userId, {
                publicMetadata: {
                  ...sessionClaims?.publicMetadata,
                  db_synced: true
                }
              });
              console.log(`Marked user ${userId} as db_synced in metadata`);
            } catch (metadataError) {
              console.error(`Error updating metadata for user ${userId}:`, metadataError);
              // Continue request even if metadata update fails
            }
          } else {
            console.error(`Sync API failed for user ${userId}:`, syncResponse.statusText);
          }
        } catch (fetchError) {
          console.error(`Error calling sync API for user ${userId}:`, fetchError);
          // Continue request even if sync fails to avoid blocking user experience
        }
      }
    } catch (error) {
      console.error(`Error in user sync middleware for user ${userId}:`, error);
      // Continue request even if sync fails to avoid blocking user experience
    }
  }
  
  return NextResponse.next();
}, {
  // An array of routes that can be accessed by both signed-in and signed-out users.
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/webhooks/clerk', // This webhook needs to be public for Clerk to reach it
    '/api/internal/sync-user' // Internal API for user sync - skip auth check
  ],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};