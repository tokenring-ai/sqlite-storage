import {ChatMessageStorage} from "@token-ring/ai-client";

/**
 * SQLite-based implementation of ChatMessageStorage that provides persistent
 * storage for chat messages and sessions using a SQLite database.
 *
 * This implementation:
 * - Persists chat messages and sessions to disk.
 * - Supports message history and retrieval.
 * - Maintains conversation context across application restarts.
 * - Provides efficient querying and storage operations.
 *
 * Database Schema Requirements:
 * - ChatSession table with id and title columns.
 * - ChatMessage table with id, sessionId, previousMessageId, request, response,
 *   cumulativeInputLength, createdAt, and updatedAt columns.
 *
 * @extends ChatMessageStorage
 */
export default class SQLiteChatMessageStorage extends ChatMessageStorage {
  /**
   * Creates a new SQLiteChatMessageStorage instance.
   *
   * @param {Object} options - Configuration options.
   * @param {import('better-sqlite3').Database} options.db - Database connection object.
   * @throws {Error} When db object is not provided.
   */
  constructor({db}) {
    super();
    if (!db) {
      throw new Error("Missing db object in constructor");
    }
    this.db = db;
  }

  /** @type {import('better-sqlite3').Database} The SQLite database connection. */
  db;

  /**
   * Stores a chat message in the database.
   *
   * @param {import('@token-ring/ai-client/ChatMessageStorage').ChatMessage} currentMessage - The current chat message.
   * @param {import('@token-ring/chat/ChatService').Body} request - The request object to store.
   * @param {Object} response - The response object to store.
   * @returns {Promise<import('@token-ring/ai-client/ChatMessageStorage').ChatMessage>} The stored message with parsed request and response.
   * @throws {Error} If the database operation fails.
   */
  storeChat(currentMessage, request, response) {
    let sessionId = currentMessage?.sessionId;
    if (!sessionId) {
      const lastMessage = request.messages?.[request.messages.length - 1];

      const title = lastMessage?.content?.replace(/^(.{1,100})(\s.*|$)/, (_, a) => a) ?? "New Chat";

      const chatSession = this.db.prepare(`
        INSERT INTO ChatSession (title)
        VALUES (?)
        RETURNING *
      `).get(title);

      sessionId = chatSession.id;
    }

    const msg = this.db.prepare(
      `INSERT INTO ChatMessage (sessionId,
                              previousMessageId,
                              request,
                              response)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    ).get(
      sessionId,
      currentMessage?.id,
      JSON.stringify(request),
      JSON.stringify(response)
    );

    msg.request = JSON.parse(msg.request);
    msg.response = JSON.parse(msg.response);
    return msg;
  }

  /**
   * Retrieves a message by its ID from the database.
   * Parses the stored JSON data back into objects for the request and response.
   *
   * @param {number|string} id - The message ID.
   * @returns {Promise<import('@token-ring/ai-client/ChatMessageStorage').ChatMessage>} The retrieved message with parsed request and response.
   * @throws {Error} When message is not found or database error occurs.
   */
  async retrieveMessageById(id) {
    const data = this.db.prepare(
      `SELECT *
       FROM ChatMessage
       WHERE id = ?`
    ).get(id);

    if (!data) {
      throw new Error(`Message with id ${id} not found`);
    }

    data.request = JSON.parse(data.request);
    data.response = data.response ? JSON.parse(data.response) : null;
    return data;
  }
}