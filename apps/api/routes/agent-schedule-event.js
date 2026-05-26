/**
 * Schedule Event — /api/agent/schedule-event
 *
 * Agent endpoint to schedule fashion events in user's calendar.
 * Uses Google Calendar API directly (Token Vault integration available on Vercel).
 *
 * Ported from apps/web/app/api/agent/schedule-event/route.ts
 *
 * GET  /api/agent/schedule-event?days=7 — Get upcoming events
 * POST /api/agent/schedule-event — Schedule a new event
 *
 * Auth: serviceKeyAuth (applied at server.js mount level)
 *
 * Note: Full Token Vault integration (Auth0) is on Vercel side.
 * This Express port supports direct Google Calendar API key usage
 * for server-side operations, and returns canConnect=true for clients
 * that want to use the Vercel-side integration.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

const GOOGLE_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY || '';

// ── POST /api/agent/schedule-event — Schedule a new event ──

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const { summary, description, start, end, location } = body;

    if (!summary || !start || !end) {
      return res.status(400).json({
        error: 'Missing required fields: summary, start, end',
      });
    }

    // Try direct Google Calendar API if API key is configured
    if (GOOGLE_API_KEY) {
      try {
        const eventPayload = {
          summary,
          description,
          start: { dateTime: start, timeZone: 'America/New_York' },
          end: { dateTime: end, timeZone: 'America/New_York' },
          location: location || undefined,
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 30 }],
          },
        };

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
            signal: AbortSignal.timeout(10000),
          },
        );

        if (response.ok) {
          const data = await response.json();
          return res.json({
            success: true,
            message: 'Event scheduled successfully',
            eventId: data.id,
            event: { summary, start, end },
          });
        }

        // Google API returned an error — fall through to connection hint
        logger.warn('Google Calendar API error', {
          component: 'schedule-event',
          status: response.status,
        });
      } catch (apiErr) {
        logger.warn('Google Calendar API call failed', {
          component: 'schedule-event',
          error: apiErr.message,
        });
      }
    }

    // No API key or API call failed — return connection hint
    // Client can redirect user to connect Google Calendar via Auth0 Token Vault
    res.status(403).json({
      error: 'Please connect your Google Calendar first.',
      requiresConnection: true,
      connectionUrl:
        '/api/auth/connect?connection=google-oauth2&scope=https://www.googleapis.com/auth/calendar.events',
    });
  } catch (error) {
    logger.error('Schedule event error', { component: 'schedule-event' }, error);
    res.status(500).json({
      error: 'Failed to schedule event',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ── GET /api/agent/schedule-event — Get upcoming events ──

router.get('/', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 7;

    if (GOOGLE_API_KEY) {
      try {
        const now = new Date();
        const future = new Date();
        future.setDate(future.getDate() + daysAhead);

        const params = new URLSearchParams({
          timeMin: now.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '10',
          key: GOOGLE_API_KEY,
        });

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          { signal: AbortSignal.timeout(10000) },
        );

        if (response.ok) {
          const data = await response.json();
          return res.json({
            success: true,
            events: data.items || [],
            daysAhead,
          });
        }
      } catch (apiErr) {
        logger.warn('Google Calendar API fetch failed', {
          component: 'schedule-event',
          error: apiErr.message,
        });
      }
    }

    // Fallback: return connection required
    res.status(403).json({
      error: 'Please connect your Google Calendar first.',
      requiresConnection: true,
      events: [],
      daysAhead,
    });
  } catch (error) {
    logger.error('Get events error', { component: 'schedule-event' }, error);
    res.status(500).json({
      error: 'Failed to get events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

module.exports = router;
