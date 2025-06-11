import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  // Get the headers from the request object
  const headersList = req.headers;
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return new Response("Server configuration error", { status: 500 });
  }

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === "user.created") {
    try {
      const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

      // Find the primary email address
      const primaryEmail = email_addresses.find(
        (email: { id: string; email_address: string }) => email.id === evt.data.primary_email_address_id
      );

      if (!primaryEmail) {
        console.error("No primary email found for user:", id);
        return NextResponse.json({ error: "No primary email address found" }, { status: 400 });
      }

      // Find the primary phone number if it exists
      const primaryPhone = phone_numbers?.find(
        (phone: { id: string; phone_number: string }) => phone.id === evt.data.primary_phone_number_id
      );

      // Create the user in our database
      await prisma.user.create({
        data: {
          clerkId: id,
          email: primaryEmail.email_address,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          phoneNumber: primaryPhone?.phone_number ?? null,
        },
      });

      console.log(`User created successfully with Clerk ID: ${id}`);
      return NextResponse.json({ message: "User created successfully" }, { status: 201 });

    } catch (error) {
      // Check if it's a unique constraint violation (user already exists)
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        console.log(`User already exists for Clerk ID: ${evt.data.id}`);
        return NextResponse.json({ message: "User already exists" }, { status: 200 });
      }

      console.error("Error creating user:", error);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
  }

  // For other event types, just acknowledge receipt
  return NextResponse.json({ message: "Webhook received" }, { status: 200 });
}