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
import { theme } from '../../theme';

// ─── Constants & Setup ───────────────────────────────────────────────────────

// NOTE: Replace webClientId with your actual Google Cloud web client ID to fully test!
const GOOGLE_WEB_CLIENT_ID = 'PLACEHOLDER_WEB_CLIENT_ID.apps.googleusercontent.com';

const BACKUP_FOLDER_NAME = 'CardsManager';
const BACKUP_FILE_NAME = 'ScanGoBackup.zip';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');

  // ─── Auth Flow ───
  useEffect(() => {
    // Check if user is already signed in quietly
    const checkSignInInfo = async () => {
      try {
        const userInfo = await GoogleSignin.signInSilently();
        setUserInfo(userInfo);
      } catch (error: any) {
        if (error.code !== statusCodes.SIGN_IN_REQUIRED) {
          console.warn('Silent sign in error:', error);
        }
      }
    };
    checkSignInInfo();
  }, []);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      setUserInfo(userInfo);
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation already in progress
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services not available or outdated');
      } else {
        Alert.alert('Sign-In Error', error?.message || 'Unknown error');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      setUserInfo(null);
    } catch (error) {
      console.error(error);
    }
  };

  // ─── Drive API Helpers ───

  const getDriveFolderId = async (accessToken: string): Promise<string | null> => {
    // Search for existing CardsManager folder
    const q = encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  const createDriveFolder = async (accessToken: string): Promise<string | null> => {
    const metadata = {
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    return data.id || null;
  };

  const findBackupFileId = async (accessToken: string, folderId: string): Promise<string | null> => {
    const q = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  };

  // ─── Backup Flow ───

  const handleBackup = useCallback(async () => {
    if (!userInfo) return;
    setIsProcessing(true);
    try {
      setProcessStatus('Compressing app data...');
      // 1. Create ZIP of document directory (where cards.db and photos live)
      const zipPath = `${FileSystem.cacheDirectory}ScanGoBackup_temp.zip`;
      const sourceDir = FileSystem.documentDirectory;
      if (!sourceDir) throw new Error('Document directory unavailable');

      await zip(sourceDir, zipPath);

      // 2. Get tokens for Drive Upload
      setProcessStatus('Connecting to Google Drive...');
      
      // Ensure user is actually signed in
      const currentUser = await GoogleSignin.getCurrentUser();
      if (!currentUser) {
        setUserInfo(null);
        throw new Error('You must be signed in to Google to perform a backup.');
      }

      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      // 3. Find or create folder
      let folderId = await getDriveFolderId(accessToken);
      if (!folderId) {
        folderId = await createDriveFolder(accessToken);
      }
      if (!folderId) throw new Error('Could not create Drive folder');

      // 4. Check if backup file exists to overwrite
      const existingFileId = await findBackupFileId(accessToken, folderId);

      setProcessStatus('Uploading backup...');
      
      // 5. Read ZIP file as base64
      const zipBase64 = await FileSystem.readAsStringAsync(zipPath, { encoding: FileSystem.EncodingType.Base64 });
      
      // 6. Construct multipart request manually
      const boundary = 'foo_bar_baz_scan_go';
      
      const metadata = {
        name: BACKUP_FILE_NAME,
        parents: existingFileId ? undefined : [folderId], // pass parent only on create
      };

      let body = '';
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
      body += JSON.stringify(metadata) + '\r\n';
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/zip\r\n';
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += zipBase64 + '\r\n';
      body += `--${boundary}--`;

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

      // Cleanup
      await FileSystem.deleteAsync(zipPath, { idempotent: true });

      Alert.alert('Backup Successful', 'Your cards and photos have been backed up to Google Drive.');
    } catch (err: any) {
      console.error('Backup error:', err);
      Alert.alert('Backup Error', err.message || 'An unknown error occurred.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  }, [userInfo]);

  // ─── Restore Flow ───

  const handleRestore = useCallback(async () => {
    if (!userInfo) return;
    
    Alert.alert(
      'Restore Backup',
      'This will overwrite all current local cards and photos with the Drive backup. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restore', 
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              setProcessStatus('Connecting to Google Drive...');
              
              // Ensure user is actually signed in
              const currentUser = await GoogleSignin.getCurrentUser();
              if (!currentUser) {
                setUserInfo(null);
                throw new Error('You must be signed in to Google to perform a restore.');
              }

              const tokens = await GoogleSignin.getTokens();
              const accessToken = tokens.accessToken;

              // 1. Find folder & file
              const folderId = await getDriveFolderId(accessToken);
              if (!folderId) throw new Error('Backup folder not found on Drive.');
              
              const fileId = await findBackupFileId(accessToken, folderId);
              if (!fileId) throw new Error('Backup file not found in Drive folder.');

              // 2. Download from Google Drive
              setProcessStatus('Downloading backup...');
              const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
              const zipPath = `${FileSystem.cacheDirectory}ScanGoBackup_restore.zip`;
              
              const downloadResult = await FileSystem.downloadAsync(
                downloadUrl,
                zipPath,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );

              if (downloadResult.status !== 200) {
                throw new Error('Failed to download backup file');
              }

              // 3. Extract to Document Directory
              setProcessStatus('Extracting backup...');
              const destDir = FileSystem.documentDirectory;
              if (!destDir) throw new Error('Document directory unavailable');
              
              await unzip(zipPath, destDir);
              
              // Cleanup
              await FileSystem.deleteAsync(zipPath, { idempotent: true });

              Alert.alert(
                'Restore Complete',
                'Your cards and photos have been restored. Please restart the app completely for the database to load the restored data.',
                [{ text: 'OK' }]
              );

            } catch (err: any) {
              console.error('Restore error:', err);
              Alert.alert('Restore Error', err.message || 'An unknown error occurred.');
            } finally {
              setIsProcessing(false);
              setProcessStatus('');
            }
          }
        }
      ]
    );
  }, [userInfo]);

  // ─── Render ───

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Settings & Backup</Text>
          <Text style={styles.subtitle}>Manage your cloud sync and preferences</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Google Drive Sync</Text>
          
          {userInfo ? (
            <View style={styles.authContainer}>
              <View style={styles.userRow}>
                <Text style={styles.userLabel}>Signed in as:</Text>
                <Text style={styles.userName}>{userInfo.user?.email || 'User'}</Text>
              </View>

              {!isProcessing ? (
                <>
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleBackup}>
                    <Text style={styles.btnIcon}>☁️</Text>
                    <Text style={styles.primaryBtnText}>Backup to Google Drive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleRestore}>
                    <Text style={styles.btnIcon}>📥</Text>
                    <Text style={styles.secondaryBtnText}>Restore from Drive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.textBtn} onPress={handleSignOut}>
                    <Text style={styles.textBtnText}>Sign Out</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.processingWrap}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.processingText}>{processStatus}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.authContainer}>
              <Text style={styles.authDesc}>
                Sign in with Google to securely backup your scanned business cards and photos to your personal Google Drive.
              </Text>
              
              {isSigningIn ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
              ) : (
                <TouchableOpacity style={styles.googleBtn} onPress={handleSignIn}>
                  <Text style={styles.googleBtnIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Sign In with Google</Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.placeholderWarning}>
                Note: Ensure the GOOGLE_WEB_CLIENT_ID constant in the code matches your Google Cloud project config.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About ScanGo</Text>
          <Text style={styles.aboutText}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>Offline OCR Business Card Scanner</Text>
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
    padding: theme.spacing.m,
  },
  header: {
    marginBottom: theme.spacing.l,
    marginTop: theme.spacing.s,
  },
  title: {
    fontSize: theme.fontSize.xlarge,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: theme.fontSize.small,
    color: theme.colors.placeholder,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#f8fafd',
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.l,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
  },
  aboutText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    marginBottom: 4,
  },
  authContainer: {
    alignItems: 'center',
    width: '100%',
  },
  authDesc: {
    fontSize: theme.fontSize.small,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.l,
    lineHeight: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.l,
    gap: 8,
  },
  userLabel: {
    fontSize: theme.fontSize.small,
    color: theme.colors.placeholder,
  },
  userName: {
    fontSize: theme.fontSize.small,
    fontWeight: '600',
    color: theme.colors.text,
  },
  
  // Buttons
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.m,
    gap: 12,
  },
  googleBtnIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: theme.fontSize.medium,
    fontWeight: '600',
    color: '#3c4043',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.m,
    width: '100%',
    justifyContent: 'center',
    marginBottom: theme.spacing.m,
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf0ff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.m,
    width: '100%',
    justifyContent: 'center',
    marginBottom: theme.spacing.l,
    gap: 8,
  },
  secondaryBtnText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.medium,
    fontWeight: '700',
  },
  btnIcon: {
    fontSize: 18,
  },
  textBtn: {
    padding: 10,
  },
  textBtnText: {
    color: '#e74c3c',
    fontSize: theme.fontSize.small,
    fontWeight: '600',
  },
  placeholderWarning: {
    fontSize: 11,
    color: '#e67e22',
    textAlign: 'center',
    marginTop: theme.spacing.l,
    fontStyle: 'italic',
  },
  processingWrap: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  processingText: {
    fontSize: theme.fontSize.small,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
