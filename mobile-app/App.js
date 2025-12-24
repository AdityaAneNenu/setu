import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import PhotoUploadScreen from './src/screens/PhotoUploadScreen';
import SyncScreen from './src/screens/SyncScreen';
import ComplaintsScreen from './src/screens/ComplaintsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'PM-AJAY Mobile' }}
        />
        <Stack.Screen 
          name="QRScanner" 
          component={QRScannerScreen}
          options={{ title: 'Scan QR Code' }}
        />
        <Stack.Screen 
          name="PhotoUpload" 
          component={PhotoUploadScreen}
          options={{ title: 'Upload Photos' }}
        />
        <Stack.Screen 
          name="Sync" 
          component={SyncScreen}
          options={{ title: 'Sync Data' }}
        />
        <Stack.Screen 
          name="Complaints" 
          component={ComplaintsScreen}
          options={{ title: 'Complaints' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

