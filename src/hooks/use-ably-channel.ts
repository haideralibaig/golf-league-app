"use client"

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAbly } from '@/components/providers/ably-provider';
import Ably from 'ably';

// Hook options interface
interface UseAblyChannelOptions {
  channelName: string;
  onMessage?: (message: Ably.Message) => void;
  onPresence?: (message: Ably.PresenceMessage) => void;
  subscribe?: boolean; // Allow conditional subscription
  deriveOptions?: Ably.DeriveOptions; // For channel derivation
}

// Hook return interface
interface UseAblyChannelReturn {
  channel: Ably.RealtimeChannel | null;
  publish: (name: string, data: any) => Promise<void>;
  presence: {
    enter: (data?: any) => Promise<void>;
    leave: (data?: any) => Promise<void>;
    update: (data?: any) => Promise<void>;
    get: () => Promise<Ably.PresenceMessage[]>;
  };
  connectionState: Ably.ConnectionState;
  channelState: Ably.ChannelState;
  isChannelAttached: boolean;
  isLoading: boolean;
  error: Ably.ErrorInfo | null;
  // Message history functionality
  getHistory: (options?: Ably.RealtimeHistoryParams) => Promise<Ably.PaginatedResult<Ably.Message>>;
}

export function useAblyChannel(options: UseAblyChannelOptions): UseAblyChannelReturn {
  const { client, connectionState, error: connectionError } = useAbly();
  const { channelName, onMessage, onPresence, subscribe = true, deriveOptions } = options;
  
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [channelState, setChannelState] = useState<Ably.ChannelState>('initialized');
  const [channelError, setChannelError] = useState<Ably.ErrorInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use refs to store latest callback functions to avoid re-subscriptions
  const messageCallbackRef = useRef(onMessage);
  const presenceCallbackRef = useRef(onPresence);
  
  // Update refs when callbacks change
  useEffect(() => {
    messageCallbackRef.current = onMessage;
  }, [onMessage]);
  
  useEffect(() => {
    presenceCallbackRef.current = onPresence;
  }, [onPresence]);

  // Derived state
  const isChannelAttached = channelState === 'attached';
  const error = connectionError || channelError;

  // Initialize channel when client is available
  useEffect(() => {
    if (!client || !channelName) {
      setChannel(null);
      return;
    }

    setIsLoading(true);
    setChannelError(null);

    try {
      // Get or create channel
      const ablyChannel = deriveOptions 
        ? client.channels.getDerived(channelName, deriveOptions)
        : client.channels.get(channelName);

      // Set up channel state listeners
      ablyChannel.on('attached', () => {
        console.log(`Ably Channel: ${channelName} attached`);
        setChannelState('attached');
        setChannelError(null);
      });

      ablyChannel.on('detached', (stateChange) => {
        console.log(`Ably Channel: ${channelName} detached`, stateChange.reason);
        setChannelState('detached');
        if (stateChange.reason) {
          setChannelError(stateChange.reason);
        }
      });

      ablyChannel.on('failed', (stateChange) => {
        console.error(`Ably Channel: ${channelName} failed`, stateChange.reason);
        setChannelState('failed');
        if (stateChange.reason) {
          setChannelError(stateChange.reason);
        }
      });

      ablyChannel.on('suspended', (stateChange) => {
        console.log(`Ably Channel: ${channelName} suspended`, stateChange.reason);
        setChannelState('suspended');
        if (stateChange.reason) {
          setChannelError(stateChange.reason);
        }
      });

      setChannel(ablyChannel);
      setChannelState(ablyChannel.state);

    } catch (err) {
      console.error(`Error initializing channel ${channelName}:`, err);
      setChannelError(err as Ably.ErrorInfo);
    } finally {
      setIsLoading(false);
    }

  }, [client, channelName, deriveOptions]);

  // Subscribe to messages when channel is ready and subscribe is true
  useEffect(() => {
    if (!channel || !subscribe) {
      return;
    }

    const messageHandler = (message: Ably.Message) => {
      if (messageCallbackRef.current) {
        messageCallbackRef.current(message);
      }
    };

    const presenceHandler = (presenceMessage: Ably.PresenceMessage) => {
      if (presenceCallbackRef.current) {
        presenceCallbackRef.current(presenceMessage);
      }
    };

    // Subscribe to all messages on the channel
    channel.subscribe(messageHandler);
    
    // Subscribe to presence events if callback is provided
    if (presenceCallbackRef.current) {
      channel.presence.subscribe(presenceHandler);
    }

    // Cleanup subscriptions
    return () => {
      channel.unsubscribe(messageHandler);
      if (presenceCallbackRef.current) {
        channel.presence.unsubscribe(presenceHandler);
      }
    };
  }, [channel, subscribe]);

  // Publish function
  const publish = useCallback(async (name: string, data: any): Promise<void> => {
    if (!channel) {
      throw new Error('Channel not available');
    }
    
    if (!isChannelAttached) {
      throw new Error('Channel not attached');
    }

    try {
      await channel.publish(name, data);
      console.log(`Message published to ${channelName}:`, { name, data });
    } catch (err) {
      console.error(`Error publishing to ${channelName}:`, err);
      throw err;
    }
  }, [channel, isChannelAttached, channelName]);

  // Presence functions
  const presence = {
    enter: useCallback(async (data?: any): Promise<void> => {
      if (!channel) {
        throw new Error('Channel not available');
      }
      
      try {
        await channel.presence.enter(data);
        console.log(`Entered presence on ${channelName}`, data);
      } catch (err) {
        console.error(`Error entering presence on ${channelName}:`, err);
        throw err;
      }
    }, [channel, channelName]),

    leave: useCallback(async (data?: any): Promise<void> => {
      if (!channel) {
        throw new Error('Channel not available');
      }
      
      try {
        await channel.presence.leave(data);
        console.log(`Left presence on ${channelName}`, data);
      } catch (err) {
        console.error(`Error leaving presence on ${channelName}:`, err);
        throw err;
      }
    }, [channel, channelName]),

    update: useCallback(async (data?: any): Promise<void> => {
      if (!channel) {
        throw new Error('Channel not available');
      }
      
      try {
        await channel.presence.update(data);
        console.log(`Updated presence on ${channelName}`, data);
      } catch (err) {
        console.error(`Error updating presence on ${channelName}:`, err);
        throw err;
      }
    }, [channel, channelName]),

    get: useCallback(async (): Promise<Ably.PresenceMessage[]> => {
      if (!channel) {
        throw new Error('Channel not available');
      }
      
      try {
        const presenceMessages = await channel.presence.get();
        return presenceMessages;
      } catch (err) {
        console.error(`Error getting presence on ${channelName}:`, err);
        throw err;
      }
    }, [channel, channelName]),
  };

  // Get message history
  const getHistory = useCallback(async (historyOptions?: Ably.RealtimeHistoryParams): Promise<Ably.PaginatedResult<Ably.Message>> => {
    if (!channel) {
      throw new Error('Channel not available');
    }
    
    try {
      const history = await channel.history(historyOptions);
      return history;
    } catch (err) {
      console.error(`Error getting history for ${channelName}:`, err);
      throw err;
    }
  }, [channel, channelName]);

  return {
    channel,
    publish,
    presence,
    connectionState,
    channelState,
    isChannelAttached,
    isLoading,
    error,
    getHistory,
  };
}