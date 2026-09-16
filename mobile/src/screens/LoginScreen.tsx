import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { setToken } from '../utils/tokenStorage';
import { COLORS, SHADOWS } from '../theme';

// ── OTP Input — 6 individual boxes ───────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    onChange(next.join(''));
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyPress = (i, e) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      const next = [...digits];
      next[i - 1] = '';
      onChange(next.join(''));
    }
  };

  return (
    <View style={otpStyles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={el => (inputs.current[i] = el)}
          style={[otpStyles.box, d ? otpStyles.boxFilled : null]}
          keyboardType="number-pad"
          maxLength={1}
          value={d}
          onChangeText={val => handleChange(i, val)}
          onKeyPress={e => handleKeyPress(i, e)}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const otpStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  box: {
    width: 46,
    height: 54,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.gray800,
    backgroundColor: COLORS.gray50,
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF1F2',
    color: COLORS.primary,
  },
});

// ── Resend Timer ──────────────────────────────────────────────────────────────
function ResendTimer({ onResend, resending }) {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    setSeconds(60);
    const iv = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(iv); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [onResend]);

  if (seconds > 0) {
    return (
      <Text style={styles.resendTimer}>
        Resend code in <Text style={styles.resendCountdown}>{seconds}s</Text>
      </Text>
    );
  }

  return (
    <TouchableOpacity onPress={onResend} disabled={resending}>
      <Text style={[styles.linkText, { textAlign: 'center' }]}>
        {resending ? 'Sending...' : 'Resend code'}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main Login Screen ─────────────────────────────────────────────────────────
export default function LoginScreen({ navigation, route }) {
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'

  // Credentials step
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP step
  const [otpId, setOtpId] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [devOtp, setDevOtp] = useState('');

  // Prefill phone if passed from Register screen
  useEffect(() => {
    if (route?.params?.phone) setPhone(route.params.phone);
  }, [route?.params?.phone]);

  // ── Step 1: Credentials → request OTP ────────────────────────────────────
  const handleLogin = async () => {
    setError('');

    if (!phone || !password) {
      setError('Please enter both phone number and password.');
      return;
    }
    if (phone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/auth/request-otp', {
        phone_number: phone,
        password,
      });

      setOtpId(res.data.otp_id);
      if (res.data._dev_otp) setDevOtp(res.data._dev_otp);
      setStep('otp');

    } catch (err) {
      console.log('Login error:', JSON.stringify(err?.response?.data), err?.response?.status);

      if (err.response?.status === 404) {
        setError('Phone number not found. Please register first.');
        setTimeout(() => navigation.navigate('Register', { phone }), 1500);
      } else if (err.response?.status === 401) {
        setError('Incorrect password. Please try again.');
      } else if (err.response?.status === 403) {
        navigation.navigate('SetPassword', { phone });
      } else if (!err.response) {
        // No response = network error (wrong IP, server down, no internet)
        setError(
          'Cannot reach the server. Check your internet connection.\n\n' +
          'If using an emulator, make sure the API uses 10.0.2.2 instead of localhost.'
        );
      } else {
        setError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          `Login failed (${err.response?.status}). Please try again.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP → save token and navigate ──────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter the full 6-digit code.');
      return;
    }

    setVerifying(true);
    setOtpError('');

    try {
      const res = await api.post('/auth/verify-otp', {
        otp_id: otpId,
        code: otpCode,
      });

      const { token, user } = res.data;

      // Token goes to the Keychain (encrypted); user profile is non-sensitive
      // display data cached in AsyncStorage, mirroring the web app's localStorage.
      await setToken(token);
      await AsyncStorage.setItem('penzi_user', JSON.stringify(user));

      navigation.replace('Matches');

    } catch (err) {
      console.log('OTP verify error:', JSON.stringify(err?.response?.data));
      setOtpError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Invalid or expired code. Please try again.'
      );
      setOtpCode('');
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true);
    setOtpError('');
    setOtpCode('');
    try {
      const res = await api.post('/auth/resend-otp', { otp_id: otpId });
      setOtpId(res.data.otp_id);
      if (res.data._dev_otp) setDevOtp(res.data._dev_otp);
    } catch (err) {
      setOtpError(
        err.response?.data?.error ||
        'Failed to resend. Please try again.'
      );
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone
    ? `${phone.slice(0, 3)}****${phone.slice(-3)}`
    : '';

  // ── Render ────────────────────────────────────────────────────────────────
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
        {/* ── Header ── */}
        <View style={styles.headerBg}>
          <View style={styles.headerContent}>
            <Text style={styles.logo}>Penzi</Text>
            <Text style={styles.tagline}>
              {step === 'credentials' ? 'Welcome back 👋' : "Verify it's you 🔐"}
            </Text>
          </View>
          <View style={styles.headerCurve} />
        </View>

        {/* ── Card ── */}
        <View style={styles.card}>

          {/* ══ STEP 1: Credentials ══ */}
          {step === 'credentials' && (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0712345678"
                placeholderTextColor={COLORS.gray400}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={val => {
                  setError('');
                  setPhone(val.replace(/\D/g, '').slice(0, 10));
                }}
              />
              <Text style={styles.hint}>{phone.length}/10 digits</Text>

              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.gray400}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={val => { setError(''); setPassword(val); }}
                  onSubmitEditing={handleLogin}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>Continue →</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.linkText}>Register here</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Registered but no password? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('SetPassword', { phone })}>
                  <Text style={styles.linkText}>Set password</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.navigate('Welcome')}
              >
                <Text style={styles.backText}>← Back to Home</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══ STEP 2: OTP Verification ══ */}
          {step === 'otp' && (
            <>
              <View style={styles.otpHeader}>
                <Text style={styles.otpIcon}>📱</Text>
                <Text style={styles.otpInfo}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={styles.otpPhone}>{maskedPhone}</Text>
                </Text>
                <Text style={styles.otpExpiry}>Valid for 5 minutes</Text>
              </View>

              {/* Sandbox dev OTP helper — only ever renders in a __DEV__ build */}
              {__DEV__ && devOtp ? (
                <View style={styles.devBox}>
                  <Text style={styles.devLabel}>🧪 Sandbox — your OTP:</Text>
                  <Text style={styles.devOtp}>{devOtp}</Text>
                  <Text style={styles.devNote}>Remove in production</Text>
                </View>
              ) : null}

              {otpError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{otpError}</Text>
                </View>
              ) : null}

              <OtpInput value={otpCode} onChange={setOtpCode} />

              <TouchableOpacity
                style={[
                  styles.btn,
                  (verifying || otpCode.length !== 6) && styles.btnDisabled,
                  { marginTop: 16 },
                ]}
                onPress={handleVerifyOtp}
                disabled={verifying || otpCode.length !== 6}
                activeOpacity={0.85}
              >
                {verifying ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnText}>Verify & Login ✓</Text>
                )}
              </TouchableOpacity>

              <View style={{ marginBottom: 12 }}>
                <ResendTimer key={otpId} onResend={handleResend} resending={resending} />
              </View>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep('credentials');
                  setOtpCode('');
                  setOtpError('');
                  setDevOtp('');
                }}
              >
                <Text style={styles.backText}>← Use a different number</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 32,
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.card,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
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
    marginBottom: 20,
  },
  eyeBtn: { padding: 10 },
  eyeIcon: { fontSize: 18 },
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
  btnDisabled: { opacity: 0.6 },
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
  backBtn: {
    alignItems: 'center',
    marginTop: 8,
  },
  backText: {
    color: COLORS.gray400,
    fontSize: 13,
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  otpInfo: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  otpPhone: {
    fontWeight: '700',
    color: COLORS.gray800,
  },
  otpExpiry: {
    fontSize: 11,
    color: COLORS.gray400,
    marginTop: 4,
  },
  resendTimer: {
    fontSize: 13,
    color: COLORS.gray400,
    textAlign: 'center',
  },
  resendCountdown: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  devBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  devLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  devOtp: {
    fontSize: 28,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 8,
    marginTop: 4,
  },
  devNote: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 2,
  },
});
