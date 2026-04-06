/**
 * Google Calendar Agent Tool
 * 
 * Demonstrates Auth0 Token Vault integration.
 * Agent can schedule fashion events in user's calendar
 * without ever seeing the user's Google credentials.
 */

import { TokenVaultService, TokenVaultError } from "../services/token-vault";
import type { AgentAuthContext } from "../../middleware/agent-auth";

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end: string;   // ISO 8601 datetime
  location?: string;
}

export class CalendarTool {
  /**
   * Schedule a fashion event in user's Google Calendar.
   * 
   * Example: "Schedule a try-on appointment at Zara tomorrow at 2pm"
   */
  static async scheduleEvent(
    auth: AgentAuthContext,
    event: CalendarEvent
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      console.log(`[CalendarTool] Scheduling event: ${event.summary}`);

      const result = await TokenVaultService.executeSecureRequest(auth, {
        connection: 'google-oauth2',
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        method: 'POST',
        payload: {
          summary: event.summary,
          description: event.description,
          start: {
            dateTime: event.start,
            timeZone: 'America/New_York'
          },
          end: {
            dateTime: event.end,
            timeZone: 'America/New_York'
          },
          location: event.location,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 }
            ]
          }
        }
      });

      return {
        success: true,
        eventId: result.data?.id,
      };
    } catch (error: any) {
      console.error('[CalendarTool] Failed to schedule event:', error);

      if (error instanceof TokenVaultError) {
        if (error.code === 'NOT_CONNECTED') {
          return {
            success: false,
            error: 'Please connect your Google Calendar first. Go to Settings > Connected Accounts.'
          };
        }
        
        if (error.code === 'TOKEN_EXPIRED') {
          return {
            success: false,
            error: 'Your Google Calendar authorization expired. Please reconnect your account.'
          };
        }
      }

      return {
        success: false,
        error: `Failed to schedule event: ${error.message}`
      };
    }
  }

  /**
   * Get upcoming events from user's calendar.
   * Helps agent avoid scheduling conflicts.
   */
  static async getUpcomingEvents(
    auth: AgentAuthContext,
    daysAhead: number = 7
  ): Promise<{ success: boolean; events?: any[]; error?: string }> {
    try {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + daysAhead);

      const params = new URLSearchParams({
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '10'
      });

      const result = await TokenVaultService.executeSecureRequest(auth, {
        connection: 'google-oauth2',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        method: 'GET'
      });

      return {
        success: true,
        events: result.data?.items || []
      };
    } catch (error: any) {
      console.error('[CalendarTool] Failed to get events:', error);

      if (error instanceof TokenVaultError && error.code === 'NOT_CONNECTED') {
        return {
          success: false,
          error: 'Please connect your Google Calendar first.'
        };
      }

      return {
        success: false,
        error: `Failed to get events: ${error.message}`
      };
    }
  }

  /**
   * Check if user has any conflicts at a specific time.
   * Returns true if the time slot is available.
   */
  static async checkAvailability(
    auth: AgentAuthContext,
    startTime: string,
    endTime: string
  ): Promise<{ available: boolean; conflicts?: any[] }> {
    try {
      const params = new URLSearchParams({
        timeMin: startTime,
        timeMax: endTime,
        singleEvents: 'true'
      });

      const result = await TokenVaultService.executeSecureRequest(auth, {
        connection: 'google-oauth2',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        method: 'GET'
      });

      const events = result.data?.items || [];
      
      return {
        available: events.length === 0,
        conflicts: events
      };
    } catch (error: any) {
      console.error('[CalendarTool] Failed to check availability:', error);
      // If we can't check, assume not available to be safe
      return { available: false };
    }
  }
}
