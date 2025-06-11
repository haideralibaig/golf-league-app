"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Ably from 'ably';

// Types for our Ably context
interface UserLeague {
  leagueId: string;
  leagueName: string;
  chapterId: string;
  role: string;
}

interface AblyContextValue {
  client: Ably.Realtime | null;
  connectionState: Ably.ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  error: Ably.ErrorInfo | null;
  userLeagues: UserLeague[];
  reconnect: () => void;
}

// Create the context
const AblyContext = createContext<AblyContextValue | undefined>(undefined);

// Hook to use the Ably context
export function useAbly(): AblyContextValue {
  const context = useContext(AblyContext);
  if (context === undefined) {
    throw new Error('useAbly must be used within an AblyProvider');
  }
  return context;
}

// Provider component props
interface AblyProviderProps {
  children: React.ReactNode;
}

export function AblyProvider({ children }: AblyProviderProps) {
  const { isSignedIn, user } = useUser();
  const [client, setClient] = useState<Ably.Realtime | null>(null);
  const [connectionState, setConnectionState] = useState<Ably.ConnectionState>('initialized');
  const [error, setError] = useState<Ably.ErrorInfo | null>(null);
  const [userLeagues, setUserLeagues] = useState<UserLeague[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // Derived state
  const isConnected = connectionState === 'connected';

  // Function to initialize Ably client
  const initializeAblyClient = useCallback(async () => {
    if (!isSignedIn || !user) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Fetch token from our API
      const response = await fetch('/api/ably-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get Ably token: ${response.statusText}`);
      }

      const { tokenRequest, leagues } = await response.json();
      setUserLeagues(leagues);

      // Create Ably client with token authentication
      const ablyClient = new Ably.Realtime({
        authCallback: (data, callback) => {
          callback(null, tokenRequest);
        },
        clientId: `user_${user.id}`,
        // Connection options for reliability
        disconnectedRetryTimeout: 15000,
        suspendedRetryTimeout: 30000,
        // Enable automatic token renewal
        autoConnect: true,
      });

      // Set up connection state listeners
      ablyClient.connection.on('connected', () => {
        console.log('Ably: Connected successfully');
        setConnectionState('connected');
        setError(null);
      });

      ablyClient.connection.on('connecting', () => {
        console.log('Ably: Connecting...');
        setConnectionState('connecting');
      });

      ablyClient.connection.on('disconnected', (stateChange) => {
        console.log('Ably: Disconnected', stateChange.reason);
        setConnectionState('disconnected');
        if (stateChange.reason) {
          setError(stateChange.reason);
        }
      });

      ablyClient.connection.on('suspended', (stateChange) => {
        console.log('Ably: Connection suspended', stateChange.reason);
        setConnectionState('suspended');
        if (stateChange.reason) {
          setError(stateChange.reason);
        }
      });

      ablyClient.connection.on('failed', (stateChange) => {
        console.error('Ably: Connection failed', stateChange.reason);
        setConnectionState('failed');
        if (stateChange.reason) {
          setError(stateChange.reason);
        }
      });

      ablyClient.connection.on('closed', () => {
        console.log('Ably: Connection closed');
        setConnectionState('closed');
      });

      setClient(ablyClient);

    } catch (err) {
      console.error('Error initializing Ably client:', err);
      setError(err as Ably.ErrorInfo);
      setConnectionState('failed');
    } finally {
      setIsConnecting(false);
    }
  }, [isSignedIn, user]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (client) {
      client.connection.connect();
    } else {
      initializeAblyClient();
    }
  }, [client, initializeAblyClient]);

  // Initialize client when user signs in
  useEffect(() => {
    if (isSignedIn && user && !client) {
      initializeAblyClient();
    }
  }, [isSignedIn, user, client, initializeAblyClient]);

  // Cleanup on unmount or user sign out
  useEffect(() => {
    if (!isSignedIn && client) {
      console.log('Ably: Cleaning up client due to sign out');
      client.close();
      setClient(null);
      setConnectionState('closed');
      setUserLeagues([]);
      setError(null);
    }
  }, [isSignedIn, client]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (client) {
        console.log('Ably: Cleaning up client on unmount');
        client.close();
      }
    };
  }, [client]);

  const contextValue: AblyContextValue = {
    client,
    connectionState,
    isConnected,
    isConnecting,
    error,
    userLeagues,
    reconnect,
  };

  return (
    <AblyContext.Provider value={contextValue}>
      {children}
    </AblyContext.Provider>
  );
}