Based on my analysis of the requirements, here's my proposed Prisma schema design for the multi-tenant golf league management system:

  Proposed Schema Design

  1. League Model

  Purpose: The top-level tenant model. Each league represents an independent golf organization that can have multiple chapters and manage its own tournaments, players, and settings.

  Key Fields:

- Unique identifier
- Name and description
- Join code (for inviting new members)
- Settings (JSON for flexible configuration)
- Timestamps

  2. User Model

  Purpose: Represents authenticated users across the entire platform. A user can be a member of multiple leagues and have different roles in each.

  Key Fields:

- Clerk ID (external auth reference)
- Email and profile information
- Global settings
- Timestamps

  Relationships:

- One-to-many with Player (a user can be a player in multiple leagues)

  3. Player Model

  Purpose: Represents a user's membership and profile within a specific league. This is the pivot model that enables multi-tenancy.

  Key Fields:

- User reference
- League reference
- Role (Player, Tournament Director, Chapter Admin, System Admin)
- League-specific profile data (display name, bio, avatar)
- Handicap index
- Status (active, inactive, suspended)
- Timestamps

  Relationships:

- Many-to-one with User
- Many-to-one with League
- One-to-one with PlayerStatistics

4. PlayerStatistics Model

  Purpose: Stores aggregated performance metrics for a player within a specific league. Separated from Player model to optimize queries and updates.

  Key Fields:

- Player reference
- Scoring metrics (average, best score, worst score)
- Performance stats (FIR%, GIR%, PPR)
- Financial tracking (money won/lost)
- Tournament results summary
- Handicap history tracking
- Timestamps for last calculation

  Relationships:

- One-to-one with Player

  Key Design Decisions:

  1. Multi-tenancy via Player Model: The Player model acts as the junction between Users and Leagues, enabling true multi-tenant functionality where users can belong to multiple leagues with
  different profiles and roles in each.
  2. Separated Statistics: PlayerStatistics is a separate model to optimize performance - statistics can be updated independently without locking the Player record, and can be efficiently queried
   for leaderboards.
  3. Role-based Access: Roles are stored at the Player level, not User level, allowing users to have different permissions in different leagues.
  4. Flexible League Settings: Using JSON for league settings allows customization without schema changes.
  5. Handicap at Player Level: Since handicaps are league-specific (a player might have different handicaps in different leagues based on which rounds count), it's stored on the Player model.

  This schema provides the foundation for the multi-tenant system while maintaining data integrity and query performance. Future models (Tournament, Round, Course, etc.) will reference the League and Player models to maintain tenant isolation.