// ============================================================
//  controllers/groupController.js
//  Routes for Circle's auto-created topic groups.
//
//  GET    /api/groups                       → trending groups (Explore)
//  GET    /api/groups/mine                  → groups the user has joined
//  GET    /api/groups/:groupId              → single group details
//  GET    /api/groups/topic/:topic          → group by topic slug
//  POST   /api/groups/:groupId/join         → join a group (opt-in)
//  DELETE /api/groups/:groupId/join         → leave a group
//  GET    /api/groups/:groupId/feed         → group post feed
// ============================================================

const GroupModel            = require('../models/groupModel');
const { sendOk, sendError } = require('../middleware/response');

// ── GET /api/groups?page=<n>&limit=<n> ──────────────────
async function getTrendingGroups(req, res) {
  const userId = req.actorId ?? null;
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  try {
    const result = await GroupModel.getTrendingGroups({ limit, offset, userId });
    
    if (userId && result.groups) {
      for (const group of result.groups) {
        try {
          const member = await GroupModel.isMember(userId, group.id);
          group.isMember = !!member;
        } catch (err) {
          group.isMember = false;
        }
      }
    }
    
    return sendOk(res, 200, 'Groups fetched.', { ...result, page, limit });
  } catch (err) {
    console.error('getTrendingGroups error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/groups/mine ─────────────────────────────────
async function getMyGroups(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Authentication required.');

  try {
    const groups = await GroupModel.getUserGroups(userId);
    return sendOk(res, 200, 'Your groups fetched.', groups);
  } catch (err) {
    console.error('getMyGroups error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/groups/:groupId ─────────────────────────────
async function getGroup(req, res) {
  const userId  = req.actorId ?? null;
  const groupId = parseInt(req.params.groupId);
  if (!groupId || isNaN(groupId)) return sendError(res, 400, 'Invalid group ID.');

  try {
    let group = await GroupModel.getGroupById(groupId, userId);
    if (!group) return sendError(res, 404, 'Group not found.');

    if (userId) {
      try {
        const member = await GroupModel.isMember(userId, groupId);
        group.isMember = !!member;
      } catch (err) {
        group.isMember = false;
      }
    } else {
      group.isMember = false;
    }

    return sendOk(res, 200, 'Group fetched.', group);
  } catch (err) {
    console.error('getGroup error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/groups/topic/:topic ─────────────────────────
async function getGroupByTopic(req, res) {
  const userId = req.actorId ?? null;
  const topic  = req.params.topic?.toLowerCase().trim();
  if (!topic) return sendError(res, 400, 'Topic is required.');

  try {
    let group = await GroupModel.getGroupByTopic(topic, userId);
    if (!group) return sendError(res, 404, 'Group not found for that topic.');

    if (userId) {
      try {
        const member = await GroupModel.isMember(userId, group.id);
        group.isMember = !!member;
      } catch (err) {
        group.isMember = false;
      }
    } else {
      group.isMember = false;
    }

    return sendOk(res, 200, 'Group fetched.', group);
  } catch (err) {
    console.error('getGroupByTopic error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/groups/:groupId/join ───────────────────────
async function joinGroup(req, res) {
  const userId  = req.actorId;
  if (!userId) return sendError(res, 401, 'Authentication required.');

  const groupId = parseInt(req.params.groupId);
  if (!groupId || isNaN(groupId)) return sendError(res, 400, 'Invalid group ID.');

  try {
    const group = await GroupModel.getGroupById(groupId);
    if (!group) return sendError(res, 404, 'Group not found.');

    const isAlreadyMember = await GroupModel.isMember(userId, groupId);
    if (isAlreadyMember) {
      return sendOk(res, 200, `Already a member of ${group.displayName}.`, { 
        groupId, 
        isMember: true,
        memberCount: group.memberCount
      });
    }

    const joined = await GroupModel.joinGroup(userId, groupId);
    
    if (!joined) {
      return sendError(res, 500, 'Failed to join group.');
    }

    const updatedGroup = await GroupModel.getGroupById(groupId, userId);

    return sendOk(res, 200, `Joined ${group.displayName}.`, { 
      groupId, 
      isMember: true,
      memberCount: updatedGroup?.memberCount || group.memberCount + 1,
      group: updatedGroup
    });
  } catch (err) {
    console.error('joinGroup error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── DELETE /api/groups/:groupId/join ─────────────────────
async function leaveGroup(req, res) {
  const userId  = req.actorId;
  if (!userId) return sendError(res, 401, 'Authentication required.');

  const groupId = parseInt(req.params.groupId);
  if (!groupId || isNaN(groupId)) return sendError(res, 400, 'Invalid group ID.');

  try {
    const group = await GroupModel.getGroupById(groupId);
    if (!group) return sendError(res, 404, 'Group not found.');

    const isMember = await GroupModel.isMember(userId, groupId);
    if (!isMember) {
      return sendOk(res, 200, `Not a member of ${group.displayName}.`, { 
        groupId, 
        isMember: false,
        memberCount: group.memberCount
      });
    }

    const left = await GroupModel.leaveGroup(userId, groupId);
    
    if (!left) {
      return sendError(res, 500, 'Failed to leave group.');
    }

    const updatedGroup = await GroupModel.getGroupById(groupId, userId);

    return sendOk(res, 200, `Left ${group.displayName}.`, { 
      groupId, 
      isMember: false,
      memberCount: updatedGroup?.memberCount || Math.max(0, group.memberCount - 1),
      group: updatedGroup
    });
  } catch (err) {
    console.error('leaveGroup error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/groups/:groupId/feed?page=<n>&limit=<n> ────
async function getGroupFeed(req, res) {
  const userId  = req.actorId ?? null;
  const groupId = parseInt(req.params.groupId);
  if (!groupId || isNaN(groupId)) return sendError(res, 400, 'Invalid group ID.');

  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    const result = await GroupModel.getGroupFeed(groupId, { page, limit, userId });
    return sendOk(res, 200, 'Group feed fetched.', result);
  } catch (err) {
    console.error('getGroupFeed error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  getTrendingGroups,
  getMyGroups,
  getGroup,
  getGroupByTopic,
  joinGroup,
  leaveGroup,
  getGroupFeed,
};