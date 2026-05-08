import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { COLORS, SHADOWS } from '../theme';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Please enter both phone number and password.');
      return;
    }
    if (phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', {
        phone_number: phone,
        password,
      });
      const { token, user } = res.data;
      await AsyncStorage.setItem('penzi_token', token);
      await AsyncStorage.setItem('penzi_user', JSON.stringify(user));
      navigation.replace('Matches');
    } catch (err) {
      if (err.response?.status === 404) {
        // User does not exist — go to Register with phone prefilled
        setError('Phone number not found. Redirecting to register...');
        setTimeout(() => {
          navigation.navigate('Register', { phone });
        }, 1500);
      } else if (err.response?.status === 401) {
        setError('Incorrect password. Please try again.');
      } else if (err.response?.status === 403) {
        // User exists but no password — go to SetPassword with phone prefilled
        navigation.navigate('SetPassword', { phone });
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Gradient Header */}
        <View style={styles.headerBg}>
          <View style={styles.headerContent}>
            <Text style={styles.logo}>Penzi</Text>
            <Text style={styles.tagline}>Welcome back 💕</Text>
          </View>
          <View style={styles.headerCurve} />
        </View>

        {/* Card */}
        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Phone */}
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 0712345678"
            placeholderTextColor={COLORS.gray400}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={(val) => setPhone(val.replace(/\D/g, '').slice(0, 10))}
          />
          <Text style={styles.hint}>{phone.length}/10 digits</Text>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.btnText}>Login</Text>
            )}
          </TouchableOpacity>

          {/* Footer links */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Register here</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Registered but no password? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('SetPassword', { phone })}
            >
              <Text style={styles.linkText}>Set password</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 8 }}
            onPress={() => navigation.navigate('Welcome')}
          >
            <Text style={{ color: COLORS.gray400, fontSize: 13 }}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.gray100,
  },
  headerBg: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 60,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  headerCurve: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: COLORS.gray100,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
  },
  tagline: {
    color: COLORS.primaryMid,
    fontSize: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.card,
  },
  errorBox: {
    backgroundColor: COLORS.red50,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.red500,
    fontSize: 13,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.gray800,
    backgroundColor: COLORS.gray50,
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: COLORS.gray400,
    marginBottom: 4,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eyeBtn: {
    padding: 10,
  },
  eyeIcon: {
    fontSize: 18,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: 6,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOWS.card,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  footerText: {
    color: COLORS.gray500,
    fontSize: 13,
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
