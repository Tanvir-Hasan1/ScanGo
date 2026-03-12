import { open } from 'react-native-quick-sqlite';

const db = open({ name: 'scango.db' });

export interface Card {
  id?: number;
  name: string;
  company: string;
  phone: string;
  address: string;
  front_image_name: string;
  back_image_name?: string;
  created_at?: string;
}

export const initDatabase = () => {
  db.execute(
    `CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      address TEXT,
      front_image_name TEXT NOT NULL,
      back_image_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`
  );
};

export const addCard = (card: Card) => {
  return db.execute(
    'INSERT INTO cards (name, company, phone, address, front_image_name, back_image_name) VALUES (?, ?, ?, ?, ?, ?)',
    [card.name, card.company, card.phone, card.address, card.front_image_name, card.back_image_name]
  );
};

export const getCards = (search: string = '') => {
  const query = search
    ? `SELECT * FROM cards WHERE name LIKE ? OR company LIKE ? OR phone LIKE ? ORDER BY created_at DESC`
    : `SELECT * FROM cards ORDER BY created_at DESC`;
  
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  
  const result = db.execute(query, params);
  return result.rows?._array || [];
};

export const getCardById = (id: number) => {
  const result = db.execute('SELECT * FROM cards WHERE id = ?', [id]);
  return result.rows?.item(0);
};

export const deleteCard = (id: number) => {
  return db.execute('DELETE FROM cards WHERE id = ?', [id]);
};

export const updateCard = (id: number, card: Partial<Card>) => {
  const fields = Object.keys(card).filter(key => card[key as keyof Card] !== undefined);
  if (fields.length === 0) return;

  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const params = [...fields.map(field => card[field as keyof Card]), id];

  return db.execute(`UPDATE cards SET ${setClause} WHERE id = ?`, params);
};

export default db;
