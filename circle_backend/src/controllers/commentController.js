// controllers/commentController.js
const CommentModel = require('../models/commentModel');
const { sendOk, sendError } = require('../middleware/response');

async function getComment(req, res) {
  const userId = req.actorId ?? null;
  const commentId = parseInt(req.params.id);
  if (!commentId || isNaN(commentId)) return sendError(res, 400, 'Invalid comment ID.');

  try {
    const comment = await CommentModel.getCommentById(commentId, userId);
    if (!comment) return sendError(res, 404, 'Comment not found.');
    const replies = await CommentModel.getReplies(commentId, userId);
    comment.replies = replies;
    return sendOk(res, 200, 'Comment fetched.', comment);
  } catch (err) {
    console.error('getComment error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

async function replyToComment(req, res) {
  const userId = req.actorId;
  if (!userId) return sendError(res, 401, 'Authentication required.');

  const commentId = parseInt(req.params.id);
  const { text } = req.body;
  if (!text?.trim()) return sendError(res, 400, 'Reply text is required.');

  try {
    const reply = await CommentModel.createReply(userId, commentId, text.trim());
    return sendOk(res, 201, 'Reply added.', reply);
  } catch (err) {
    console.error('replyToComment error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = { getComment, replyToComment };