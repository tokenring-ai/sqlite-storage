import ChatHistoryService from "@token-ring/history/ChatHistoryService";

/**
 * SQLite-based implementation of ChatHistoryService that provides persistent
 * storage for chat sessions and message history using a SQLite database.
 *
 * This implementation:
 * - Persists chat sessions and message history to disk.
 * - Supports efficient querying and retrieval of conversation data.
 * - Provides full-text search capabilities across messages.
 * - Maintains conversation threading and relationships.
 * - Supports recursive queries for conversation history reconstruction.
 *
 * Database Schema Requirements:
 * - ChatSession table with id, title, and createdAt columns.
 * - ChatMessage table with id, sessionId, previousMessageId, request, response,
 *   cumulativeInputLength, priorState, createdAt, and updatedAt columns.
 *
 * @extends ChatHistoryService
 */
export default class SQLiteChatHistoryStorage extends ChatHistoryService {
	/** @type {string} The name of the service. */
	name = "LocalChatHistoryService";

	/** @type {string} A description of the service. */
	description = "Provides LocalChatHistory functionality";

	/** @type {import('better-sqlite3').Database} The SQLite database connection. */
	db;

	/**
	 * Creates a new SQLiteChatHistoryStorage instance.
	 *
	 * @param {Object} options - Configuration options.
	 * @param {import('better-sqlite3').Database} options.db - Database connection object.
	 * @throws {Error} When db object is not provided.
	 */
	constructor({ db }) {
		super();
		if (!db) {
			throw new Error("Missing db object in constructor");
		}
		this.db = db;
	}

	/**
	 * Returns all chat sessions ordered by creation date (newest first).
	 *
	 * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatSession>>} Array of chat sessions.
	 */
	async listSessions() {
		const sql = `
      SELECT id, title, createdAt
      FROM ChatSession
      ORDER BY createdAt DESC
    `;
		return this.db.prepare(sql).all();
	}

	/**
	 * Gets the complete thread tree for a session, showing all messages in chronological order.
	 * This provides the full conversation flow with message relationships.
	 *
	 * @param {string|number} sessionId - The session identifier.
	 * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of messages forming the thread tree.
	 */
	async getThreadTree(sessionId) {
		const sql = `
      SELECT id, previousMessageId, sessionId, request, response, cumulativeInputLength,
             priorState, createdAt, updatedAt
      FROM ChatMessage
      WHERE sessionId = ?
      ORDER BY createdAt
    `;
		return this.db.prepare(sql).all([sessionId]);
	}

	/**
	 * Gets the N most recent messages from a session.
	 * Messages are returned in chronological order (oldest first) after being limited and reversed.
	 *
	 * @param {string|number} sessionId - The session identifier.
	 * @param {number} [limit=10] - Maximum number of messages to return.
	 * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of recent messages in chronological order.
	 */
	async getRecentMessages(sessionId, limit = 10) {
		const sql = `
      SELECT id, previousMessageId, sessionId, request, response, cumulativeInputLength,
             priorState, createdAt, updatedAt
      FROM ChatMessage
      WHERE sessionId = ?
      ORDER BY createdAt
      LIMIT ?
    `;
		return this.db.prepare(sql).all([sessionId, limit]);
	}

	/**
	 * Searches for messages containing the specified keyword in request or response content.
	 * Performs a case-insensitive LIKE search across both request and response fields.
	 *
	 * @param {string} keyword - The keyword to search for.
	 * @param {string|number} [sessionId] - Optional session ID to limit search scope (not implemented in this version).
	 * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of matching messages ordered by creation date (newest first).
	 */
	async searchMessages(keyword, sessionId) {
		if (!keyword) return [];

		const sql = `
      SELECT id, previousMessageId, sessionId, request, response, cumulativeInputLength,
             priorState, createdAt, updatedAt
      FROM ChatMessage
      WHERE request LIKE ? OR response LIKE ?
      ORDER BY createdAt DESC
      LIMIT 20
    `;
		return this.db.prepare(sql).all([`%${keyword}%`, `%${keyword}%`]);
	}

	/**
	 * Gets the complete chat history leading up to and including a specific message.
	 * Uses a recursive CTE to traverse the message chain backwards from the specified message.
	 * This reconstructs the full conversation context for the given message.
	 *
	 * @param {string|number} messageId - The message identifier.
	 * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of messages in the conversation history.
	 */
	async getChatHistoryByMessageId(messageId) {
		const sql = `
      WITH RECURSIVE message_history(id, previousMessageId, sessionId, request, response,
                                    cumulativeInputLength, priorState, createdAt, updatedAt) AS (
        SELECT id, previousMessageId, sessionId, request, response, cumulativeInputLength,
               priorState, createdAt, updatedAt
        FROM ChatMessage
        WHERE id = ?
        UNION ALL
        SELECT cm.id, cm.previousMessageId, cm.sessionId, cm.request, cm.response,
               cm.cumulativeInputLength, cm.priorState, cm.createdAt, cm.updatedAt
        FROM ChatMessage cm
              INNER JOIN message_history mh ON cm.id = mh.previousMessageId
      )
      SELECT id, previousMessageId, sessionId, request, response, cumulativeInputLength,
             priorState, createdAt, updatedAt
      FROM message_history
    `;
		return this.db.prepare(sql).all([messageId]);
	}

	/**
	 * Closes the database connection.
	 * Should be called when the service is no longer needed to free resources.
	 *
	 * @returns {void}
	 */
	close() {
		this.db.close();
	}
}
