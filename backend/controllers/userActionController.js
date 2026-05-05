// controllers/userActionController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

// BLOCK USER
const blockUser = async (req, res, next) => {
    try {
        const blockerId = req.user.id;
        const { blockedId } = req.body;

        if (!blockedId) {
            return res.status(400).json({ success: false, message: 'Blocked user ID is required' });
        }

        if (blockerId === blockedId) {
            return res.status(400).json({ success: false, message: 'You cannot block yourself' });
        }

        const { error } = await repositories.users.db.from('user_blocks').insert({
            blocker_id: blockerId,
            blocked_id: blockedId
        });

        if (error) {
            // Postgres unique constraint violation
            if (error.code === '23505') {
                return res.status(400).json({ success: false, message: 'User is already blocked' });
            }
            throw error;
        }

        res.status(200).json({ success: true, message: 'User blocked successfully' });
    } catch (error) {
        logger.error(`Error blocking user: ${error.message}`);
        next(error);
    }
};

// UNBLOCK USER
const unblockUser = async (req, res, next) => {
    try {
        const blockerId = req.user.id;
        const { blockedId } = req.params;

        if (!blockedId) {
            return res.status(400).json({ success: false, message: 'Blocked user ID is required' });
        }

        const { error, count } = await repositories.users.db.from('user_blocks')
            .delete()
            .match({ blocker_id: blockerId, blocked_id: blockedId });

        if (error) throw error;

        res.status(200).json({ success: true, message: 'User unblocked successfully' });
    } catch (error) {
        logger.error(`Error unblocking user: ${error.message}`);
        next(error);
    }
};

// GET BLOCKED USERS
const getBlockedUsers = async (req, res, next) => {
    try {
        const blockerId = req.user.id;

        const { data, error } = await repositories.users.db.from('user_blocks')
            .select(`
                blocked_id,
                created_at,
                blocked_user:users!user_blocks_blocked_id_fkey(
                    id,
                    user_profiles(full_name, avatar_url)
                )
            `)
            .eq('blocker_id', blockerId);

        if (error) throw error;

        res.status(200).json({ success: true, blockedUsers: data });
    } catch (error) {
        logger.error(`Error fetching blocked users: ${error.message}`);
        next(error);
    }
};

// REPORT ENTITY (USER OR STORE)
const reportEntity = async (req, res, next) => {
    try {
        const reporterId = req.user.id;
        const { entityType, entityId, reason, details } = req.body;

        if (!entityType || !entityId || !reason) {
            return res.status(400).json({ success: false, message: 'Entity type, entity ID, and reason are required' });
        }

        if (entityType !== 'user' && entityType !== 'store') {
            return res.status(400).json({ success: false, message: 'Invalid entity type' });
        }

        const insertData = {
            reporter_id: reporterId,
            entity_type: entityType,
            reason,
            details
        };

        if (entityType === 'user') {
            if (entityId === reporterId) {
                return res.status(400).json({ success: false, message: 'You cannot report yourself' });
            }
            insertData.reported_user_id = entityId;
        } else {
            insertData.reported_store_id = entityId;
        }

        const { error } = await repositories.users.db.from('user_reports').insert(insertData);

        if (error) throw error;

        res.status(200).json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        logger.error(`Error submitting report: ${error.message}`);
        next(error);
    }
};

module.exports = {
    blockUser,
    unblockUser,
    getBlockedUsers,
    reportEntity
};
