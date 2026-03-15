import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { moderateScale, verticalScale } from 'react-native-size-matters';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabIconWrap}>
      <View style={[styles.iconBackground, focused && styles.iconBackgroundActive]}>
        <Text style={styles.tabEmoji}>{emoji}</Text>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🪪" label="Cards" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="Settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: verticalScale(0),
    borderWidth: 2,
    borderColor: '#3A3A3C',
    backgroundColor: '#ffffffff',
    borderRadius: moderateScale(0),
    height: verticalScale(64),
    paddingBottom: 0,
    borderTopWidth: 1,
    
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(20),
    marginVertical: 0,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconBackground: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBackgroundActive: {
    backgroundColor: '#3A3A3C',
  },
  tabEmoji: {
    fontSize: moderateScale(22),
    opacity: 0.7,
  },
});