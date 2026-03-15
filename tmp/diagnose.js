import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

export async function diagnoseStorage() {
  const docDir = FileSystem.documentDirectory;
  console.log('Document Directory:', docDir);

  const listDir = async (path, indent = '') => {
    try {
      const items = await FileSystem.readDirectoryAsync(path);
      for (const item of items) {
        const fullPath = path + item;
        const info = await FileSystem.getInfoAsync(fullPath);
        console.log(`${indent}${info.isDirectory ? '[D]' : '[F]'} ${item} (${info.size} bytes)`);
        if (info.isDirectory) {
          await listDir(fullPath + '/', indent + '  ');
        }
      }
    } catch (e) {
      console.log(indent + 'Error reading:', path);
    }
  };

  console.log('--- File System Tree ---');
  await listDir(docDir);

  try {
    const db = await SQLite.openDatabaseAsync('cards.db');
    const result = await db.getAllAsync('SELECT COUNT(*) as count FROM cards');
    console.log('--- Database Stats ---');
    console.log('Card Count:', result[0].count);
    await db.closeAsync();
  } catch (e) {
    console.log('--- Database Error ---');
    console.log(e.message);
  }
}
