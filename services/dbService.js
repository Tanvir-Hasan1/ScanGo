import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let db = null;

// Ensure database is initialized before any operation
export const initDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('cards.db');
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
        timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);
  }
};

export const addCard = async (card) => {
  await initDB();
  const id = Crypto.randomUUID();
  const { name, company, phone, address, front_image, back_image } = card;
  const result = await db.runAsync(
    'INSERT INTO cards (id, name, company, phone, address, front_image, back_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, company, phone, address, front_image, back_image]
  );
  return id; // Return the generated UUID
};

export const getAllCards = async () => {
  await initDB();
  const allRows = await db.getAllAsync('SELECT * FROM cards ORDER BY timestamp DESC');
  return allRows;
};

export const getCardById = async (id) => {
  await initDB();
  const row = await db.getFirstAsync('SELECT * FROM cards WHERE id = ?', [id]);
  return row;
};

export const deleteCard = async (id) => {
  await initDB();
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
};
