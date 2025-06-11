# 🚀 The Bogey Club - Project Development Plan

This document outlines the step-by-step plan for building The Bogey Club application from scratch. We will update the status of each phase and task as we proceed.

## Phase 0: Foundation & Service Setup

**➡️ Status: ✅ Complete**
*(All tasks completed)*

---

## Phase 1: Multi-Tenant Foundation & Authentication

**➡️ Status: ✅ Complete**

**Goal:** Establish the database schema and implement user sign-up, league creation, and profile management.

- [✔] **Task 1.1:** Define the initial `schema.prisma` file.
- [✔] **Task 1.2:** Set up the Clerk webhook handler to sync new users to our database.
- [✔] **Task 1.3:** Implement the Clerk-powered `/sign-up` and `/sign-in` pages.
- [✔] **Task 1.4:** Build the UI and logic for a user to create a new League.
- [✔] **Task 1.5:** Implement the "Join League via Code" functionality.
- [✔] **Task 1.6:** Create a protected `/onboarding` page for new users to complete their profile.
- [✔] **Task 1.7:** Implement a middleware-based "self-healing" check that verifies every authenticated user has a corresponding record in our local DB and creates one on-the-fly if it's missing.

---

## Phase 2: Core App Layout & Course Management

**➡️ Status: ✅ Complete**

**Goal:** Build the main application shell and the tools for League Admins to manage their courses.

- [✔] **Task 2.1:** Create the main authenticated, tenant-aware layout, including a way for users to switch between their leagues.
- [✔] **Task 2.2:** Define the `Course` model in `schema.prisma`, including an `isOfficial` flag to distinguish between our master course list and user-created courses.
- [✔] **Task 2.3:** Build the UI and API routes for Course Management (Create, Read, Update, Delete). The UI should allow searching the master list first.

---

Phase 3: Real-time Money Games (MVP)
➡️ Status: ⏳ In Progress

Goal: Implement the core Auto-Press Match Play feature using Ably for live scoring.

[✔] Task 3.1: Design the client-side logic for subscribing to Ably channels (e.g., league-ID-game-ID).
[ ] Task 3.2: Build the UI for players to create and join a new money game. This includes support for Guest Players, a Quick Start option (no date/time), and Currency Selection. (⬅️ We are here)
[ ] Task 3.3: Create the API route that initiates a game and publishes the "start game" event to Ably. The API must handle guest data and optional dates.
[ ] Task 3.4: Develop the digital scorecard UI and the API route that receives score updates. This API must publish both score changes and granular game events (e.g., birdie, match-status-change) to the correct Ably channel.
[ ] Task 3.5: Implement the public, read-only view for a money game that can be shared via a link.
[ ] Task 3.6: Implement the Money Game Ledger system, including the necessary database models (Transaction) and UI for players to view and settle debts.
[ ] Task 3.7: Integrate a third-party currency conversion API for settling debts in different currencies.

Phase 4: Social Features (MVP)
➡️ Status: 📋 Not Started

Goal: Build the initial social features to increase user engagement.

[ ] Task 4.0 (New): Design and implement the Player vs. Player Challenge system.
[ ] Task 4.1: Add a Comment model to Prisma, linked to scorecards or rounds.
[ ] Task 4.2: Build the UI to display and post comments on a scorecard page.
[ ] Task 4.3: Use Ably to make new comments appear in real-time without a page refresh.
[ ] Task 4.4: Set up basic push notifications via a service for key events (e.g., "Player X made a birdie").
Phase 5: Handicap System (MVP & Visualization)
➡️ Status: 📋 Not Started

Goal: Implement the core handicapping system and the player-facing visualization tool.

[ ] Task 5.1: Implement the handicap calculation engine based on the globalHandicapIndex stored on the User model.
[ ] Task 5.2: Create an API route or scheduled Vercel Cron Job to update handicaps.
[ ] Task 5.3: Build the handicap visualization tool on the player dashboard to show progression of the globalHandicapIndex.
[ ] Task 5.4: Implement the UI for League Admins to set a league-specific handicapIndex override on a Player record.
Phase 6: Integrations & Advanced Features
➡️ Status: 📋 Not Started

Goal: Add high-value integrations and other enhancements after the core MVP is complete.

[ ] Task 6.1 (New): Implement Calendar Integration (.ics file export for games and events).
(Subsequent phases will be detailed as we complete these initial milestones.)