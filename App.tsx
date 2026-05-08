import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import SetPasswordScreen from './src/screens/SetPasswordScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerStyle: {backgroundColor: '#e91e8c'},
          headerTintColor: '#fff',
          headerTitleStyle: {fontWeight: 'bold'},
        }}>
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{title: 'Create Profile'}}
        />
        <Stack.Screen
          name="SetPassword"
          component={SetPasswordScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Matches"
          component={MatchesScreen}
          options={{title: 'Find Matches'}}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{title: 'Notifications'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
