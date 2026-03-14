import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { zip, unzip } from 'react-native-zip-archive';
import { moderateScale, verticalScale } from 'react-native-size-matters';
import { theme } from '../../theme';
import { closeDB, initDB } from '../../services/dbService';

// ─── Constants ────────────────────────────────────────────────────────────────

// ⚠️  Replace with your actual Google Cloud OAuth 2.0 Web Client ID
const GOOGLE_WEB_CLIENT_ID = 'PLACEHOLDER_WEB_CLIENT_ID.apps.googleusercontent.com';

const BACKUP_FOLDER_NAME = 'CardsManager';
const BACKUP_FILE_NAME = 'ScanGoBackup.zip';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});

// ─── Drive API Helpers ────────────────────────────────────────────────────────

async function getDriveFolderId(accessToken: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.files?.length ? data.files[0].id : null;
}

async function createDriveFolder(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const data = await res.json();
  return data.id || null;
}

async function findBackupFileId(accessToken: string, folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data.files?.length ? data.files[0].id : null;
}

/**
 * Build a staging directory in cache containing:
 *  - cards.db   (from expo-sqlite location)
 *  - images/    (all card_*.jpg files from documentDirectory)
 * Returns the path of the staging directory.
 */
async function buildBackupStaging(): Promise<string> {
  const stagingDir = `${FileSystem.cacheDirectory}scango_backup_staging/`;
  const imagesDir = `${stagingDir}images/`;

  // Clean up any previous staging
  await FileSystem.deleteAsync(stagingDir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

  // Copy SQLite database
  const dbSrc = `${FileSystem.documentDirectory}SQLite/cards.db`;
  const dbSrcAlt = `${FileSystem.documentDirectory}cards.db`;
  const dbInfo = await FileSystem.getInfoAsync(dbSrc);
  const dbInfoAlt = await FileSystem.getInfoAsync(dbSrcAlt);

  if (dbInfo.exists) {
    await FileSystem.copyAsync({ from: dbSrc, to: `${stagingDir}cards.db` });
  } else if (dbInfoAlt.exists) {
    await FileSystem.copyAsync({ from: dbSrcAlt, to: `${stagingDir}cards.db` });
  }

  // Copy card images
  const docDir = FileSystem.documentDirectory ?? '';
  const docContents = await FileSystem.readDirectoryAsync(docDir);
  const cardImages = docContents.filter(
    (f) => f.startsWith('card_') && f.endsWith('.jpg')
  );
  for (const img of cardImages) {
    await FileSystem.copyAsync({
      from: `${docDir}${img}`,
      to: `${imagesDir}${img}`,
    });
  }

  return stagingDir;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  // Silent sign-in on mount
  useEffect(() => {
    (async () => {
      try {
        const info = await GoogleSignin.signInSilently();
        setUserInfo(info);
      } catch (err: any) {
        if (err.code !== statusCodes.SIGN_IN_REQUIRED) {
          console.warn('Silent sign in error:', err);
        }
      }
    })();
  }, []);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await GoogleSignin.hasPlayServices();
      const info = await GoogleSignin.signIn();
      setUserInfo(info);
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled – no error alert
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated.');
      } else {
        Alert.alert('Sign-In Error', err?.message || 'Unknown error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      setUserInfo(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Backup ───

  const handleBackup = useCallback(async () => {
    if (!userInfo) return;
    setIsProcessing(true);
    const zipPath = `${FileSystem.cacheDirectory}ScanGoBackup_upload.zip`;
    let stagingDir: string | null = null;

    try {
      setProcessStatus('Preparing files…');
      stagingDir = await buildBackupStaging();

      setProcessStatus('Compressing…');
      await zip(stagingDir, zipPath);

      setProcessStatus('Connecting to Google Drive…');
      const currentUser = await GoogleSignin.getCurrentUser();
      if (!currentUser) { setUserInfo(null); throw new Error('Sign in required.'); }
      const { accessToken } = await GoogleSignin.getTokens();

      // Find or create folder
      let folderId = await getDriveFolderId(accessToken);
      if (!folderId) folderId = await createDriveFolder(accessToken);
      if (!folderId) throw new Error('Could not create Drive folder.');

      // Check if backup file already exists (for PATCH / overwrite)
      const existingFileId = await findBackupFileId(accessToken, folderId);

      setProcessStatus('Uploading backup…');
      const zipBase64 = await FileSystem.readAsStringAsync(zipPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const boundary = 'scango_backup_boundary_20240101';
      const metadata = {
        name: BACKUP_FILE_NAME,
        ...(existingFileId ? {} : { parents: [folderId] }),
      };

      const body =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) + '\r\n' +
        `--${boundary}\r\n` +
        'Content-Type: application/zip\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        zipBase64 + '\r\n' +
        `--${boundary}--`;

      const method = existingFileId ? 'PATCH' : 'POST';
      const uploadUrl = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

      const response = await fetch(uploadUrl, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upload failed: ${err}`);
      }

      Alert.alert('✅ Backup Successful', 'Your cards and photos have been backed up to Google Drive.');
    } catch (err: any) {
      console.error('Backup error:', err);
      Alert.alert('Backup Error', err.message || 'An unknown error occurred.');
    } finally {
      if (stagingDir) await FileSystem.deleteAsync(stagingDir, { idempotent: true });
      await FileSystem.deleteAsync(zipPath, { idempotent: true });
      setIsProcessing(false);
      setProcessStatus('');
    }
  }, [userInfo]);

  // ─── Restore ───

  const handleRestore = useCallback(async () => {
    if (!userInfo) return;

    Alert.alert(
      'Restore Backup',
      'This will overwrite all current local cards and photos with the Drive backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            const zipPath = `${FileSystem.cacheDirectory}ScanGoBackup_restore.zip`;
            try {
              setProcessStatus('Connecting to Google Drive…');
              const currentUser = await GoogleSignin.getCurrentUser();
              if (!currentUser) { setUserInfo(null); throw new Error('Sign in required.'); }
              const { accessToken } = await GoogleSignin.getTokens();

              // Find the CardsManager folder
              const folderId = await getDriveFolderId(accessToken);
              if (!folderId) {
                Alert.alert(
                  'Backup Not Found',
                  'No backup was found in your Google Drive CardsManager folder.'
                );
                return;
              }

              // Find the backup ZIP
              const fileId = await findBackupFileId(accessToken, folderId);
              if (!fileId) {
                Alert.alert(
                  'Backup Not Found',
                  'No backup was found in your Google Drive CardsManager folder.'
                );
                return;
              }

              setProcessStatus('Downloading backup…');
              const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
              const downloadResult = await FileSystem.downloadAsync(
                downloadUrl,
                zipPath,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );

              if (downloadResult.status !== 200) {
                throw new Error('Failed to download backup file.');
              }

              // Close the DB so the file can be overwritten
              setProcessStatus('Closing database…');
              await closeDB();

              // Extract ZIP to a temp location then move files
              setProcessStatus('Extracting backup…');
              const extractDir = `${FileSystem.cacheDirectory}scango_restore_tmp/`;
              await FileSystem.deleteAsync(extractDir, { idempotent: true });
              await FileSystem.makeDirectoryAsync(extractDir, { intermediates: true });
              await unzip(zipPath, extractDir);

              // Move cards.db → documentDirectory/SQLite/cards.db
              const docDir = FileSystem.documentDirectory ?? '';
              const sqliteDir = `${docDir}SQLite/`;
              const dbExtracted = `${extractDir}cards.db`;
              const dbInfo = await FileSystem.getInfoAsync(dbExtracted);
              if (dbInfo.exists) {
                await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
                // Also write to docDir directly (expo-sqlite may look there)
                await FileSystem.copyAsync({ from: dbExtracted, to: `${sqliteDir}cards.db` });
                await FileSystem.copyAsync({ from: dbExtracted, to: `${docDir}cards.db` });
              }

              // Move card images from images/ sub-folder
              const imagesExtracted = `${extractDir}images/`;
              const imagesInfo = await FileSystem.getInfoAsync(imagesExtracted);
              if (imagesInfo.exists) {
                const imgs = await FileSystem.readDirectoryAsync(imagesExtracted);
                for (const img of imgs) {
                  await FileSystem.copyAsync({
                    from: `${imagesExtracted}${img}`,
                    to: `${docDir}${img}`,
                  });
                }
              }

              // Re-init DB with restored data
              setProcessStatus('Reloading database…');
              await initDB();

              // Cleanup
              await FileSystem.deleteAsync(extractDir, { idempotent: true });
              await FileSystem.deleteAsync(zipPath, { idempotent: true });

              Alert.alert(
                '✅ Restore Complete',
                'Your cards and photos have been restored. Please restart the app to see all your data.',
                [{ text: 'OK' }]
              );
            } catch (err: any) {
              console.error('Restore error:', err);
              Alert.alert('Restore Error', err.message || 'An unknown error occurred.');
            } finally {
              setIsProcessing(false);
              setProcessStatus('');
            }
          },
        },
      ]
    );
  }, [userInfo]);

  // ─── Render ───

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your cloud sync</Text>
        </View>

        {/* Google Drive Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>☁️  Google Drive Backup</Text>

          {userInfo ? (
            <View style={styles.authContainer}>
              <View style={styles.userRow}>
                <Text style={styles.userLabel}>Signed in as</Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {userInfo.user?.email || 'Unknown'}
                </Text>
              </View>

              {isProcessing ? (
                <View style={styles.processingWrap}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.processingText}>{processStatus}</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleBackup}>
                    <Text style={styles.primaryBtnText}>📤  Backup to Google Drive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleRestore}>
                    <Text style={styles.secondaryBtnText}>📥  Restore from Drive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Text style={styles.signOutBtnText}>Sign Out</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.authContainer}>
              <Text style={styles.authDesc}>
                Sign in with Google to backup your scanned cards and photos to your personal Google Drive. Your data is stored in a private{' '}
                <Text style={{ fontWeight: '700' }}>CardsManager</Text> folder.
              </Text>

              {isSigningIn ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
              ) : (
                <TouchableOpacity style={styles.googleBtn} onPress={handleSignIn} activeOpacity={0.85}>
                  <Text style={styles.googleBtnIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Sign In with Google</Text>
                </TouchableOpacity>
              )}

              {GOOGLE_WEB_CLIENT_ID.includes('PLACEHOLDER') && (
                <Text style={styles.placeholderWarning}>
                  ⚠️  Set GOOGLE_WEB_CLIENT_ID in settings.tsx before testing Google Sign-In.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ℹ️  About ScanGo</Text>
          <Text style={styles.aboutText}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>Offline-First Business Card Scanner</Text>
          <Text style={styles.aboutNote}>
            All data is stored on-device. No cloud processing. No paid APIs.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: verticalScale(40),
  },
  header: {
    marginBottom: verticalScale(16),
    marginTop: verticalScale(4),
  },
  title: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: moderateScale(13),
    color: theme.colors.placeholder,
    marginTop: verticalScale(2),
  },
  card: {
    backgroundColor: '#f8fafd',
    borderRadius: moderateScale(14),
    padding: moderateScale(18),
    marginBottom: moderateScale(14),
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: verticalScale(14),
  },
  aboutText: {
    fontSize: moderateScale(14),
    color: theme.colors.text,
    marginBottom: verticalScale(4),
  },
  aboutNote: {
    fontSize: moderateScale(12),
    color: theme.colors.placeholder,
    marginTop: verticalScale(6),
    fontStyle: 'italic',
  },
  authContainer: {
    alignItems: 'center',
    width: '100%',
    gap: verticalScale(12),
  },
  authDesc: {
    fontSize: moderateScale(13),
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(4),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    backgroundColor: '#eef3ff',
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(30),
    alignSelf: 'center',
  },
  userLabel: {
    fontSize: moderateScale(12),
    color: theme.colors.placeholder,
  },
  userName: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: theme.colors.primary,
    maxWidth: moderateScale(200),
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    paddingVertical: verticalScale(13),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(10),
    gap: moderateScale(12),
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  googleBtnIcon: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#3c4043',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(12),
    width: '100%',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf0ff',
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(12),
    width: '100%',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  signOutBtn: {
    paddingVertical: verticalScale(8),
  },
  signOutBtnText: {
    color: '#e74c3c',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  placeholderWarning: {
    fontSize: moderateScale(11),
    color: '#e67e22',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: moderateScale(8),
  },
  processingWrap: {
    alignItems: 'center',
    gap: verticalScale(14),
    paddingVertical: verticalScale(20),
  },
  processingText: {
    fontSize: moderateScale(13),
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
