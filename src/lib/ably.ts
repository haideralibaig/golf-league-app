import Ably from 'ably';

// Singleton instance of Ably REST client for server-side operations
let ablyClient: Ably.Rest | null = null;

export function getAblyServerClient(): Ably.Rest {
  if (!ablyClient) {
    const apiKey = process.env.ABLY_API_KEY;
    
    if (!apiKey) {
      throw new Error('ABLY_API_KEY is not set in environment variables');
    }
    
    ablyClient = new Ably.Rest({
      key: apiKey,
    });
  }
  
  return ablyClient;
}

// Utility function to generate capability-based permissions
export function generateCapabilities(userId: string, leagueIds: string[]): Record<string, string[]> {
  const capabilities: Record<string, string[]> = {};
  
  // Private user channel - full access
  capabilities[`private-user-${userId}`] = ['*'];
  
  // League channels - based on user's league memberships
  leagueIds.forEach(leagueId => {
    capabilities[`league-${leagueId}`] = ['publish', 'subscribe', 'presence'];
    capabilities[`chapter-${leagueId}-*`] = ['publish', 'subscribe', 'presence'];
    capabilities[`game-${leagueId}-*`] = ['publish', 'subscribe', 'presence'];
    capabilities[`tournament-${leagueId}-*`] = ['subscribe', 'presence'];
  });
  
  return capabilities;
}

// Type definitions for our Ably integration
export interface AblyTokenRequest {
  keyName: string;
  ttl: number;
  timestamp: number;
  capability: Record<string, string[]>;
  nonce: string;
  mac: string;
  clientId: string;
}

export interface AblyTokenResponse {
  token: string;
  expires: number;
  issued: number;
  capability: Record<string, string[]>;
  clientId: string;
}