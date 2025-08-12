import { ChatMessageStorage } from "@token-ring/ai-client";
import { Body, Response } from "@token-ring/chat/ChatService";
import {StoredChatMessage} from "@token-ring/ai-client/ChatMessageStorage";

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
  /** The SQLite database connection. */
  db: any;

  /**
   * Creates a new SQLiteChatMessageStorage instance.
   *
   * @param {Object} options - Configuration options.
   * @param options.db - Database connection object.
   * @throws {Error} When db object is not provided.
   */
  constructor({ db }: { db: any }) {
    super();
    if (!db) {
      throw new Error("Missing db object in constructor");
    }
    this.db = db;
  }

  /**
   * Stores a chat message in the database.
   *
   * @param currentMessage - The current chat message.
   * @param request - The request object to store.
   * @param response - The response object to store.
   * @returns The stored message with parsed request and response.
   * @throws {Error} If the database operation fails.
   */
  async storeChat(currentMessage: StoredChatMessage, request: Body, response: Response): Promise<StoredChatMessage> {
    let sessionId: number;
    if (currentMessage?.sessionId) {
        sessionId = parseInt(currentMessage.sessionId);
    } else {
      const lastMessage = request.messages?.[request.messages.length - 1];

      const title =
        lastMessage?.content?.replace(/^(.{1,100})(\s.*|$)/, (_: unknown, a: string) => a) ??
        "New Chat";

      const chatSession = this.db
        .prepare(`
        INSERT INTO ChatSession (title)
        VALUES (?)
        RETURNING *
      `)
        .get(title);

      sessionId = chatSession.id;
    }

    const msg = this.db
      .prepare(
        `INSERT INTO ChatMessage (sessionId,
                             previousMessageId,
                             request,
                             response)
       VALUES (?, ?, ?, ?)
       RETURNING id, sessionId, previousMessageId, request, response`,
      )
      .get(
        sessionId,
        currentMessage?.id,
        JSON.stringify(request),
        JSON.stringify(response),
      );

    return formatMessage(msg);
  }

  /**
   * Retrieves a message by its ID from the database.
   * Parses the stored JSON data back into objects for the request and response.
   *
   * @param id - The message ID.
   * @returns The retrieved message with parsed request and response.
   * @throws {Error} When message is not found or database error occurs.
   */
  async retrieveMessageById(id: string): Promise<StoredChatMessage> {
    const data = this.db
      .prepare(
        `SELECT *
       FROM ChatMessage
       WHERE id = ?`,
      )
      .get(id);

    if (!data) {
      throw new Error(`Message with id ${id} not found`);
    }

    return formatMessage(data);
  }
}

function formatMessage(msg: any): StoredChatMessage {
    return {
        id: msg.id.toString(),
        sessionId: msg.sessionId.toString(),
        request: JSON.parse(msg.request),
        response: msg.response ? JSON.parse(msg.response) : null,
        previousMessageId: msg.previousMessageId?.toString?.(),
        createdAt: msg.createdAt as number,
        updatedAt: msg.updatedAt as number
    }
}
