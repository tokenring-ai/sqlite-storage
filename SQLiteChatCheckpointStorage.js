import CheckpointService from "@token-ring/history/CheckpointService";

/**
 * SQLite-based implementation of CheckpointService that provides persistent
 * storage for conversation checkpoints using a SQLite database.
 *
 * This implementation:
 * - Persists checkpoints to disk for durability across application restarts.
 * - Supports efficient querying and retrieval of checkpoints.
 * - Maintains checkpoint metadata including labels and timestamps.
 * - Links checkpoints to specific messages for context restoration.
 *
 * Database Schema Requirements:
 * - Checkpoint table with id, label, messageId, and createdAt columns.
 *
 * @extends CheckpointService
 */
export default class SQLiteChatCheckpointStorage extends CheckpointService {
	/** @type {string} The name of the service. */
	name = "LocalCheckpointService";

	/** @type {string} A description of the service. */
	description = "Provides LocalCheckpoint functionality";

	/** @type {import('better-sqlite3').Database} The SQLite database connection. */
	db;

	/**
	 * Creates a new SQLiteChatCheckpointStorage instance.
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
	 * Creates a new checkpoint for the specified message.
	 * Stores the checkpoint with a label and links it to the current message.
	 *
	 * @param {string} label - Human-readable label for the checkpoint.
	 * @param {import('@token-ring/ai-client/ChatMessageStorage').ChatMessage} currentMessage - The current message to checkpoint.
	 * @param {string|number} [sessionId] - Session ID (not used in this implementation but kept for interface compatibility).
	 * @returns {Promise<import('@token-ring/history/CheckpointService').Checkpoint>} The created checkpoint.
	 * @throws {Error} When currentMessage is invalid or database operation fails.
	 */
	async createCheckpoint(label, currentMessage, sessionId) {
		if (!currentMessage || !currentMessage.id) {
			throw new Error(
				"Invalid currentMessage provided for checkpoint creation",
			);
		}

		const insertQuery = `
      INSERT INTO Checkpoint (label, messageId)
      VALUES (?, ?)
      RETURNING *
    `;

		return this.db.prepare(insertQuery).get([label, currentMessage.id]);
	}

	/**
	 * Retrieves a checkpoint by its index (0-based, ordered by creation date descending).
	 * Index 0 returns the most recent checkpoint, index 1 the second most recent, etc.
	 *
	 * @param {number} idx - The checkpoint index (0-based).
	 * @param {string|number} [sessionId] - Session ID (not used in this implementation but kept for interface compatibility).
	 * @returns {Promise<import('@token-ring/history/CheckpointService').Checkpoint|null>} The retrieved checkpoint or null if not found.
	 */
	async retrieveCheckpoint(idx, sessionId) {
		const checkpointsQuery = `
      SELECT * FROM Checkpoint 
      ORDER BY createdAt DESC 
      LIMIT 1 OFFSET ?
    `;
		return this.db.prepare(checkpointsQuery).get([idx]);
	}

	/**
	 * Lists all checkpoints ordered by creation date (newest first).
	 *
	 * @param {string|number} [sessionId] - Session ID (not used in this implementation but kept for interface compatibility).
	 * @returns {Promise<Array<import('@token-ring/history/CheckpointService').Checkpoint>>} Array of checkpoints.
	 */
	async listCheckpoint(sessionId) {
		const listQuery = "SELECT * FROM Checkpoint ORDER BY createdAt DESC";
		return this.db.prepare(listQuery).all();
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
