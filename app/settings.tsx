import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';
import { Ionicons } from '@expo/vector-icons';
import { s, vs, ms } from 'react-native-size-matters';
import { configureGoogleSignin, backupToDrive, restoreFromDrive } from '../src/services/googleDrive';
import { COLORS, SIZES } from '../src/constants/theme';

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    configureGoogleSignin();
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error(error);
    }
  };

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      setUser(userInfo);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Google Sign-In failed');
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
      setUser(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user ? (
          <View style={styles.profileCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.user.name}</Text>
              <Text style={styles.userEmail}>{user.user.email}</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.signInBtn} onPress={signIn}>
            <Ionicons name="logo-google" size={s(20)} color={COLORS.white} />
            <Text style={styles.signInText}>Sign in with Google</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup & Restore</Text>
        <TouchableOpacity 
          style={[styles.actionRow, !user && styles.disabled]} 
          onPress={backupToDrive}
          disabled={!user}
        >
          <View style={styles.actionInfo}>
            <Ionicons name="cloud-upload-outline" size={s(24)} color={COLORS.primary} />
            <Text style={styles.actionText}>Backup to Drive</Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.gray} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionRow, !user && styles.disabled]} 
          onPress={restoreFromDrive}
          disabled={!user}
        >
          <View style={styles.actionInfo}>
            <Ionicons name="cloud-download-outline" size={s(24)} color={COLORS.success} />
            <Text style={styles.actionText}>Restore from Drive</Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.gray} />
        </TouchableOpacity>
        
        <Text style={styles.note}>
          Backups are stored in a folder named "CardsManager" on your Google Drive.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
  },
  section: {
    marginBottom: vs(32),
  },
  sectionTitle: {
    fontSize: SIZES.font.sm,
    fontWeight: 'bold',
    color: COLORS.gray,
    textTransform: 'uppercase',
    marginBottom: vs(12),
  },
  profileCard: {
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: SIZES.font.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: SIZES.font.sm,
    color: COLORS.gray,
  },
  signOutBtn: {
    paddingVertical: vs(6),
    paddingHorizontal: s(12),
    borderRadius: s(4),
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  signOutText: {
    color: COLORS.danger,
    fontSize: SIZES.font.xs,
    fontWeight: 'bold',
  },
  signInBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: COLORS.white,
    fontWeight: 'bold',
    marginLeft: s(10),
    fontSize: SIZES.font.md,
  },
  actionRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(12),
    elevation: 1,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: s(16),
    fontSize: SIZES.font.md,
    color: COLORS.text,
  },
  disabled: {
    opacity: 0.5,
  },
  note: {
    fontSize: SIZES.font.xs,
    color: COLORS.gray,
    marginTop: vs(8),
    fontStyle: 'italic',
  },
});
