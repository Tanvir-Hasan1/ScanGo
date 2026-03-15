import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let db = null;

/**
 * IMAGE STORAGE CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * The DB stores only the FILENAME (e.g. "card_front_1712345678.jpg").
 * Full paths are resolved at runtime:
 *   FileSystem.documentDirectory + filename
 *
 * This makes backup/restore migration-proof — when the ZIP is extracted on
 * a new device, the filenames remain the same and the runtime path resolves
 * correctly to the new device's documentDirectory.
 */

export const initDB = async () => {
  try {
    if (!db) {
      console.log('--- InitDB: Requesting cards.db handle ---');
      db = await SQLite.openDatabaseAsync('cards.db');
      console.log('--- InitDB: Handle acquired successfully ---');
      
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT,
          company TEXT,
          phone TEXT,
          address TEXT,
          front_image TEXT,
          back_image TEXT,
          email TEXT,
          website TEXT,
          timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
        );
      `);

      // Migrations
      const columns = await db.getAllAsync("PRAGMA table_info('cards')");
      const hasEmail = columns.some(c => c.name === 'email');
      if (!hasEmail) await db.runAsync('ALTER TABLE cards ADD COLUMN email TEXT;');
      
      const hasWebsite = columns.some(c => c.name === 'website');
      if (!hasWebsite) await db.runAsync('ALTER TABLE cards ADD COLUMN website TEXT;');
    }
  } catch (err) {
    console.error('CRITICAL: initDB failed:', err);
    db = null; // Reset handle on failure
    throw err;
  }
};

export const checkpointDB = async () => {
  try {
    await initDB();
    if (!db) throw new Error('Database not initialized');
    console.log('--- Checkpoint: Running PRAGMA wal_checkpoint(FULL) ---');
    await db.execAsync('PRAGMA wal_checkpoint(FULL);');
    console.log('--- Checkpoint: Completed successfully ---');
  } catch (err) {
    console.error('Checkpoint failed:', err);
    // Don't re-throw if it's just a pragma failure, but log it
  }
};

export const closeDB = async () => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

export const addCard = async (card) => {
  await initDB();
  const id = Crypto.randomUUID();
  const { name = '', company = '', phone = '', address = '', email = '', website = '', front_image = '', back_image = '' } = card;
  await db.runAsync(
    'INSERT INTO cards (id, name, company, phone, address, email, website, front_image, back_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, company, phone, address, email, website, front_image, back_image]
  );
  return id;
};

export const getAllCards = async () => {
  await initDB();
  return db.getAllAsync('SELECT * FROM cards ORDER BY timestamp DESC');
};

export const searchCards = async (query) => {
  await initDB();
  if (!query || query.trim() === '') return getAllCards();
  const q = `%${query.trim()}%`;
  return db.getAllAsync(
    'SELECT * FROM cards WHERE name LIKE ? OR company LIKE ? OR phone LIKE ? ORDER BY timestamp DESC',
    [q, q, q]
  );
};

export const getCardById = async (id) => {
  await initDB();
  return db.getFirstAsync('SELECT * FROM cards WHERE id = ?', [id]);
};

export const updateCard = async (id, fields) => {
  await initDB();
  const { name, company, phone, address, email, website } = fields;
  await db.runAsync(
    'UPDATE cards SET name=?, company=?, phone=?, address=?, email=?, website=? WHERE id=?',
    [name ?? '', company ?? '', phone ?? '', address ?? '', email ?? '', website ?? '', id]
  );
};

export const deleteCard = async (id) => {
  await initDB();
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
};
