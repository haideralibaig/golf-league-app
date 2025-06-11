# 🏛️ AI Coding Agent Context: The Bogey Club

## 1. Project Overview

We are building a comprehensive golf league management system called "The Bogey Club". It is a web application for managing tournaments, money games, handicaps, and player statistics.

## 2. Core Architectural Principles (You MUST follow these)

- **Hosting & Deployment**: Vercel Platform
- **Framework**: Next.js (App Router) with TypeScript
- **Styling**: Tailwind CSS.
- **Component Library**: **shadcn/ui**. You will use the `shadcn` CLI to add components and then use them in the code.
- **Database**: Vercel Postgres, managed via Prisma ORM.
- **Authentication**: Managed by **Clerk**. You will not write any code for password hashing, session management, or JWTs. You will use Clerk's components and SDKs.
- **Real-time Engine**: Managed by **Ably**. You will use the Ably SDK to publish messages to channels.
- **Email Delivery**: Managed by **Resend**.
- **File Storage**: Managed by **Vercel Blob**.
- **Code Style**: All code must be strongly typed with TypeScript. Emphasize modular, reusable components and functions.

## 3. My Prompting Rules (How I will interact with you)

1. **Plan Before Code:** For any new feature, I will always prompt you with "**Do not code.**" first. You must respond with a high-level plan or approach for me to approve before you write any code.
2. **Investigate Before Fixing:** For any bugs, I will prompt you with "**Do not code.**" first. You must investigate the potential cause and report back with a rationale for what might be broken and a plan to fix it.
3. **Adherence to Architecture:** All code you generate must strictly adhere to the Core Architectural Principles listed above.
