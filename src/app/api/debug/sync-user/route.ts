import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerkUser = await currentUser();
    
    if (!clerkUser) {
      return NextResponse.json({ error: 'Could not fetch Clerk user' }, { status: 404 });
    }

    // Try to import Prisma dynamically
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: userId }
      });

      if (existingUser) {
        return NextResponse.json({ 
          message: 'User already exists',
          user: existingUser 
        });
      }

      // Create user
      const newUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
        }
      });

      await prisma.$disconnect();

      return NextResponse.json({
        message: 'User created successfully',
        user: newUser
      });
    } catch (prismaError: any) {
      return NextResponse.json({ 
        error: 'Prisma error', 
        details: prismaError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error syncing user:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}