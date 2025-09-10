import {StoredChatMessage, StoredChatSession} from "@tokenring-ai/ai-client/ChatMessageStorage";
import ChatHistoryService from "@tokenring-ai/history/ChatHistoryService";
// @ts-ignore
import {Database} from "bun:sqlite";

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
  /** The name of the service. */
  name = "LocalChatHistoryService";

  /** A description of the service. */
  description = "Provides LocalChatHistory functionality";

  /** The SQLite database connection. */
  private db: Database;

  /**
   * Creates a new SQLiteChatHistoryStorage instance.
   *
   * @param {Object} options - Configuration options.
   * @param options.db - Database connection object.
   * @throws {Error} When db object is not provided.
   */
  constructor({db}: { db: Database }) {
    if (!db) {
      throw new Error("Missing db object in constructor");
    }
    super();
    this.db = db;
  }

  /**
   * Returns all chat sessions ordered by creation date (newest first).
   */
  async listSessions(): Promise<StoredChatSession[]> {
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
   */
  async getThreadTree(sessionId: string): Promise<StoredChatMessage[]> {
    const sql = `
     SELECT id, previousMessageId, sessionId, request, response, createdAt, updatedAt
     FROM ChatMessage
     WHERE sessionId = ?
     ORDER BY createdAt
    `;
    return this.db.prepare(sql).all([sessionId]);
  }

  /**
   * Gets the N most recent messages from a session.
   * Messages are returned in chronological order (oldest first) after being limited and reversed.
   */
  async getRecentMessages(sessionId: string, limit = 10): Promise<any[]> {
    const sql = `
     SELECT id, previousMessageId, sessionId, request, response, createdAt, updatedAt
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
   */
  async searchMessages(keyword: string, _sessionId?: string): Promise<StoredChatMessage[]> {
    if (!keyword) return [];

    const sql = `
     SELECT id, previousMessageId, sessionId, request, response, createdAt, updatedAt
     FROM ChatMessage
     WHERE request LIKE ?
        OR response LIKE ?
     ORDER BY createdAt DESC
     LIMIT 20
    `;
    return this.db.prepare(sql).all([`%${keyword}%`, `%${keyword}%`]);
  }

  /**
   * Gets the complete chat history leading up to and including a specific message.
   * Uses a recursive CTE to traverse the message chain backwards from the specified message.
   * This reconstructs the full conversation context for the given message.
   */
  async getChatHistoryByMessageId(messageId: string): Promise<StoredChatMessage[]> {
    const sql = `
     WITH RECURSIVE message_history(id, previousMessageId, sessionId, request, response,
                                    createdAt, updatedAt) AS (SELECT id,
                                                                     previousMessageId,
                                                                     sessionId,
                                                                     request,
                                                                     response,
                                                                     createdAt,
                                                                     updatedAt
                                                              FROM ChatMessage
                                                              WHERE id = ?
                                                              UNION ALL
                                                              SELECT cm.id,
                                                                     cm.previousMessageId,
                                                                     cm.sessionId,
                                                                     cm.request,
                                                                     cm.response,
                                                                     cm.createdAt,
                                                                     cm.updatedAt
                                                              FROM ChatMessage cm
                                                                    INNER JOIN message_history mh ON cm.id = mh.previousMessageId)
     SELECT id,
            previousMessageId,
            sessionId,
            request,
            response,
            createdAt,
            updatedAt
     FROM message_history
    `;
    return this.db.prepare(sql).all([messageId]);
  }

  /**
   * Closes the database connection.
   * Should be called when the service is no longer needed to free resources.
   */
  close(): void {
    this.db.close();
  }
}
