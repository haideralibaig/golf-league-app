# ⛳ The Bogey Club

A comprehensive golf league management system for amateur golf tours and clubs. The platform handles tournaments, money games, handicapping, and player statistics.

## 🎯 Platform Overview

The Bogey Club is a modern, web-based application designed to manage all aspects of an amateur golf tour or league, including:

- Tournament management with multiple formats. Tournaments can be one off or tied to a specific season.
- Live-scored money games with various betting formats
- An automated, modern handicapping system based on the WHS and USGA
- Detailed player statistics and performance tracking
- Support for multiple chapters or locations and leagues. The system will be multi-tenant based.
- Users can join multiple leagues, clubs and will be required to join via a code or magic link.
- League management with player registrations, subscriptions fees, announcements, manual handicap changes as per USGA, Blogs/News, league dashboard and reports.
- Guest access across all playing formats for players who aren't registered with the platform. We will not track the guest data or send them their score card after a round.

## 👥 User Roles & Permissions

- **Player**: Can manage their profile, view stats, register for tournaments, and participate in money games.

- **Tournament Director**: Can create and manage all aspects of a tournament, from registration to publishing results.
- **Chapter Administrator**: Manages chapter-specific events, memberships, and prize distributions. Each league can have multiple chapters if they have members spread geographically.
- **System Administrator**: Has full system access for configuration, user management, and maintenance.

## 🏌️ Core Features

### 1. Tournament Management

- **Player of the Year (POTY) Events**: Individual stroke play format with net/gross scoring and season-long points tracking.
- **Match Play Events**: Singles (LMP) and Doubles (DMP) knockout bracket tournaments.
- **Team Competitions**: Future support for league-vs-league and inter-chapter events.
- **Professional Competitions**: Golf clubs who host one off professional tournaments can manage them and broadcast them live using the platform.

### 2. Money Games System

- **Live Scoring**: Real-time updates for all players in a group.
- **Supported Formats**:
  - 2v2 Best Ball Auto-Press (at 2-Up)
  - Future support for Skins, Nassau, and other custom formats.
- **Features**: Player-initiated games, dynamic stake setting, and automatic calculations. Players can choose to make the game private or public for viewing and following and can share link with users who aren't registered with the platform to follow along.

### 3. Handicap System

- **Automated Calculations**: Based on WHS/USGA rules (best 8 of last 20 scores). All USGA and WHS rules must be implemented.
- **Score Tracking**: All scores from tournaments and money games are automatically recorded for handicap purposes.
- **Admin Controls**: Admins can review scores and override handicaps for specific events.

### 4. Player Statistics

- **Performance Tracking**: Tracks key stats like Scoring Average, Fairways in Regulation (FIR), Greens in Regulation (GIR), and Putts Per Round (PPR).
- **Financials**: Tracks money game performance and tournament prize money earned.

### 5. Key Considerations

- **Reusable Components**: The development should focus on building reusable components like scorecards, player profiles to make it easy to build out new playing formats across all categories.
- **Handicapping System**: Any golf app is is only as good as the handicapping system. We must follow this strictly and provide an interactive visual tool for players to understand their handicap calculations, progression, trends and help players work towards reducing and improving their handicap.
- **Social Aspect**: Also we need to think of ways we can involve users on a daily basis using social engineering i.e. give users the ability to comment on score cards, live chat during matches, push notification with key round evens like birdies, bogeys or matchplay events.
- **Golf Club Managemt**: The eventual goal is to make this into a full blown golf course and club management app so we should consider everything from now like Tee Times, Food and Beverage Kiosks or orders, whatever we can do think of a golf course might need to run their business, but a lot of these features will be ear-marked for later to be built.
  
## 🏗️ Technical Stack

- **Hosting & Deployment**: Vercel Platform
- **Framework**: Next.js (App Router) with TypeScript
- **Component Library**: shadcn/ui on Tailwind CSS
- **Database**: Vercel Postgres, managed via Prisma ORM
- **Authentication**: Clerk
- **Real-time Engine**: Ably
- **Email Delivery**: Resend
- **File Storage**: Vercel Blob
