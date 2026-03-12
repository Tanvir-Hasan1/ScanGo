import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as FileSystem from 'expo-file-system';
import { zip, unzip } from 'react-native-zip-archive';
import { Alert } from 'react-native';

const GOOGLE_DRIVE_FOLDER_NAME = 'CardsManager';
const BACKUP_FILE_NAME = 'scango_backup.zip';

export const configureGoogleSignin = () => {
  GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    // webClientId and iosClientId should be provided by the user in a real scenario
  });
};

const getAccessToken = async () => {
  try {
    const { accessToken } = await GoogleSignin.getTokens();
    return accessToken;
  } catch (error) {
    console.error('Google Access Token Error:', error);
    return null;
  }
};

export const findOrCreateFolder = async (accessToken: string) => {
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=name='${GOOGLE_DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folderData = await createResponse.json();
  return folderData.id;
};

export const backupToDrive = async () => {
  try {
    const user = await GoogleSignin.signInSilently();
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('No access token');

    const folderId = await findOrCreateFolder(accessToken);

    // 1. Zip DB and Images
    const dbPath = `${FileSystem.documentDirectory}SQLite/scango.db`;
    // Quick SQLite might store it differently depending on the platform/config
    // For react-native-quick-sqlite, it's usually in DocumentDirectory + 'scango.db' or similar
    
    const imagesDir = `${FileSystem.documentDirectory}`;
    const zipPath = `${FileSystem.cacheDirectory}${BACKUP_FILE_NAME}`;
    
    // We need to carefully select what to zip. We want only cards and the db.
    // Simplifying: zip the entire DocumentDirectory (excluding cache)
    await zip(imagesDir, zipPath);

    // 2. Search for existing backup file to update
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files[0];

    // 3. Upload
    const metadata = {
      name: BACKUP_FILE_NAME,
      parents: [folderId],
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', {
      uri: `file://${zipPath}`,
      name: BACKUP_FILE_NAME,
      type: 'application/zip',
    } as any);

    const uploadUrl = existingFile 
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const uploadRes = await fetch(uploadUrl, {
      method: existingFile ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    if (uploadRes.ok) {
      Alert.alert('Success', 'Backup uploaded to Google Drive');
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Backup Error:', error);
    Alert.alert('Error', 'Backup failed. Please check your connection and login.');
  }
};

export const restoreFromDrive = async () => {
  try {
    const user = await GoogleSignin.signInSilently();
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('No access token');

    const folderId = await findOrCreateFolder(accessToken);
    
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    const backupFile = searchData.files && searchData.files[0];

    if (!backupFile) {
      Alert.alert('Backup not found', 'No backup file found in CardsManager folder.');
      return;
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${backupFile.id}?alt=media`;
    const zipPath = `${FileSystem.cacheDirectory}${BACKUP_FILE_NAME}`;

    const { uri } = await FileSystem.downloadAsync(downloadUrl, zipPath, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const targetPath = FileSystem.documentDirectory!;
    await unzip(uri, targetPath);

    Alert.alert('Success', 'Restore complete! Please restart the app.');
  } catch (error) {
    console.error('Restore Error:', error);
    Alert.alert('Error', 'Restore failed.');
  }
};
