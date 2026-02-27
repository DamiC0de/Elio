import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Elio',
          tabBarLabel: 'Conversation',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="💬" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarLabel: 'Services',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="🔗" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarLabel: 'Réglages',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="⚙️" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Simple emoji-based tab icon (replace with proper icons later)
function TabIcon({ name, size }: { name: string; color: string; size: number }) {
  return (
    <React.Fragment>
      {React.createElement(
        require('react-native').Text,
        { style: { fontSize: size - 4 } },
        name
      )}
    </React.Fragment>
  );
}
