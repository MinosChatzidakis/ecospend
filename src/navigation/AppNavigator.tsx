import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import DashboardScreen from '../screens/DashboardScreen';
import ScannerScreen from '../screens/ScannerScreen';
import BudgetScreen from '../screens/BudgetScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuth } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: 'bold', color: '#2D3748' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 0, elevation: 10, shadowOpacity: 0.1, shadowRadius: 10 },
        tabBarActiveTintColor: '#38A169', // Eco-friendly Green
        tabBarInactiveTintColor: '#A0AEC0',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={({ navigation }) => ({ 
          title: 'Dashboard',
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ marginRight: 20 }}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </TouchableOpacity>
          )
        })} 
      />
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scan Receipt' }} />
      <Tab.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budget' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{ headerShown: true, title: 'My Profile', headerBackTitle: 'Back' }} 
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
