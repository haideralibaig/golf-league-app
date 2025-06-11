import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    // Get authorization header to verify this is an internal request
    const authHeader = req.headers.get('Authorization');
    const userId = authHeader?.replace('Bearer ', '');
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json();
    const { userId: bodyUserId } = body;
    
    // Ensure the userId in auth header matches the body
    if (userId !== bodyUserId) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 400 });
    }
    
    // Check if user already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });
    
    if (existingUser) {
      return NextResponse.json({ 
        message: "User already exists in database",
        userExists: true 
      });
    }
    
    // User doesn't exist, create them from Clerk data
    console.log(`Creating missing user in database for Clerk ID: ${userId}`);
    
    try {
      // Fetch full user data from Clerk
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      
      // Find primary email
      const primaryEmail = clerkUser.emailAddresses.find(
        email => email.id === clerkUser.primaryEmailAddressId
      );
      
      if (!primaryEmail) {
        console.error(`No primary email found for user ${userId}`);
        return NextResponse.json({ 
          error: "No primary email address found" 
        }, { status: 400 });
      }
      
      // Find primary phone if exists
      const primaryPhone = clerkUser.phoneNumbers.find(
        phone => phone.id === clerkUser.primaryPhoneNumberId
      );
      
      // Create user in our database
      const newUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: primaryEmail.emailAddress,
          firstName: clerkUser.firstName ?? null,
          lastName: clerkUser.lastName ?? null,
          phoneNumber: primaryPhone?.phoneNumber ?? null,
        },
      });
      
      console.log(`User created successfully in database for Clerk ID: ${userId}`);
      
      return NextResponse.json({
        message: "User created successfully",
        userExists: false,
        userId: newUser.id
      });
      
    } catch (createError) {
      // Handle race condition where user was created by another request
      if (createError instanceof Error && createError.message.includes('Unique constraint')) {
        console.log(`User already exists (race condition) for Clerk ID: ${userId}`);
        return NextResponse.json({ 
          message: "User already exists (created by another request)",
          userExists: true 
        });
      } else {
        console.error(`Error creating user ${userId}:`, createError);
        return NextResponse.json({ 
          error: "Failed to create user in database" 
        }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error("Error in sync-user API:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}