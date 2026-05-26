/**
 * Missions API — /api/agent/missions
 *
 * Progress tracking and claims for gamified style challenges.
 *
 * Ported from apps/web/app/api/agent/missions/route.ts
 *
 * GET  /api/agent/missions — Get all missions and user progress
 * POST /api/agent/missions — Update mission progress
 * PUT  /api/agent/missions — Claim a mission reward
 *
 * Auth: serviceKeyAuth (applied at server.js mount level)
 */

const express = require('express');
const router = express.Router();
const { MissionService } = require('../lib/mission-service');
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');

router.use(forwardedUser);

// ── GET /api/agent/missions — Get all missions and user progress ──

router.get('/', async (req, res) => {
  const userId = req.userContext.userId || req.query.userId || 'user-default';

  try {
    const category = req.query.category;
    const allMissions = category
      ? MissionService.getMissionsByCategory(category)
      : MissionService.getAllMissions();

    const userState = MissionService.getUserMissionState(userId);
    const completedMissions = MissionService.getCompletedMissions(userId);
    const inProgressMissions = MissionService.getInProgressMissions(userId);

    res.json({
      success: true,
      missions: allMissions,
      userState: {
        totalXp: userState.totalXp,
        badges: userState.badges,
        completedCount: completedMissions.length,
        inProgressCount: inProgressMissions.length,
        missions: userState.missions,
      },
    });
  } catch (error) {
    logger.error('Missions GET error', { component: 'missions' }, error);
    res.status(500).json({ success: false, error: 'Failed to fetch missions' });
  }
});

// ── POST /api/agent/missions — Update mission progress ──

router.post('/', async (req, res) => {
  const userId = req.userContext.userId || req.body.userId;

  try {
    const { eventType, metadata } = req.body;

    if (!userId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, eventType',
      });
    }

    const updates = MissionService.updateMissionProgress(userId, eventType, metadata);

    res.json({
      success: true,
      updates,
      message: `Mission progress updated for event: ${eventType}`,
    });
  } catch (error) {
    logger.error('Missions POST error', { component: 'missions' }, error);
    res.status(500).json({ success: false, error: 'Failed to update mission progress' });
  }
});

// ── PUT /api/agent/missions — Claim a mission reward ──

router.put('/', async (req, res) => {
  const userId = req.userContext.userId || req.body.userId;

  try {
    const { missionId } = req.body;

    if (!userId || !missionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, missionId',
      });
    }

    const result = MissionService.claimMissionReward(userId, missionId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Cannot claim reward — mission not completed or already claimed',
      });
    }

    res.json({
      success: true,
      reward: result.reward,
      message: 'Mission reward claimed successfully',
    });
  } catch (error) {
    logger.error('Missions PUT error', { component: 'missions' }, error);
    res.status(500).json({ success: false, error: 'Failed to claim mission reward' });
  }
});

module.exports = router;
