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
  Modal,
  FlatList,
} from 'react-native';
import api from '../api/axios';
import { COLORS, SHADOWS, KENYA_COUNTIES } from '../theme';

const STEPS = ['Basic Info', 'Details', 'About Me', 'Password', 'Done'];

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countyModalVisible, setCountyModalVisible] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  const [form, setForm] = useState({
    phone: '', name: '', age: '', gender: 'Male',
    county: '', town: '', education: '', profession: '',
    maritalStatus: '', religion: '', ethnicity: '',
    description: '', password: '', confirmPassword: '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const sendSms = async (message) =>
    api.post('/webhook/onfon', { sender: form.phone, message }, {
      headers: { 'X-Webhook-Token': 'jobu' },
    });

  const handleStep1 = async () => {
    if (!form.phone || !form.name || !form.age || !form.county || !form.town) {
      setError('Please fill in all fields.'); return;
    }
    if (form.phone.length !== 10) { setError('Phone must be 10 digits.'); return; }
    const age = parseInt(form.age);
    if (isNaN(age) || age < 18) { setError('You must be at least 18.'); return; }
    if (age > 99) { setError('Enter a valid age.'); return; }
    setLoading(true); setError('');
    try {
      await sendSms(`start#${form.name}#${form.age}#${form.gender}#${form.county}#${form.town}`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data || 'Registration failed. Check your details.');
    } finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    if (!form.education || !form.profession || !form.maritalStatus || !form.religion || !form.ethnicity) {
      setError('Please fill in all fields.'); return;
    }
    setLoading(true); setError('');
    try {
      await sendSms(`details#${form.education}#${form.profession}#${form.maritalStatus}#${form.religion}#${form.ethnicity}`);
      setStep(3);
    } catch (err) {
      setError(err.response?.data || 'Failed to save details.');
    } finally { setLoading(false); }
  };

  const handleStep3 = async () => {
    if (!form.description) { setError('Please write a description.'); return; }
    setLoading(true); setError('');
    try {
      await sendSms(`MYSELF ${form.description}`);
      setStep(4);
    } catch (err) {
      setError(err.response?.data || 'Failed to save description.');
    } finally { setLoading(false); }
  };

  const handleStep4 = async () => {
    if (!form.password || !form.confirmPassword) { setError('Fill in all fields.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', { phone_number: form.phone, password: form.password });
      setStep(5);
    } catch (err) {
      if (err.response?.status === 409) setError('Password already set. Please login.');
      else if (err.response?.status === 404) setError('Account not found. Complete earlier steps first.');
      else setError('Failed to set password.');
    } finally { setLoading(false); }
  };

  const inputStyle = (focused) => [styles.input, focused && styles.inputFocused];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* County Picker Modal */}
      <Modal visible={countyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select County</Text>
            <FlatList
              data={KENYA_COUNTIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { set('county', item); setCountyModalVisible(false); }}
                >
                  <Text style={[styles.modalItemText, form.county === item && styles.modalItemSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCountyModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gender Modal */}
      <Modal visible={genderModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: 200 }]}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {['Male', 'Female'].map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.modalItem}
                onPress={() => { set('gender', g); setGenderModalVisible(false); }}
              >
                <Text style={[styles.modalItemText, form.gender === g && styles.modalItemSelected]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.headerBg}>
          <Text style={styles.logo}>Penzi</Text>
          <Text style={styles.tagline}>Create your profile</Text>
        </View>

        <View style={styles.card}>
          {/* Progress Steps */}
          <View style={styles.stepsRow}>
            {STEPS.map((label, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={[styles.stepCircle, step > i + 1 && styles.stepDone, step === i + 1 && styles.stepActive]}>
                  {step > i + 1 ? (
                    <Text style={styles.stepCheckmark}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNum, (step === i + 1 || step > i + 1) && styles.stepNumActive]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${((step - 1) / 4) * 100}%` }]} />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── STEP 1: Basic Info ── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Basic Information</Text>

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0712345678"
                placeholderTextColor={COLORS.gray400}
                keyboardType="phone-pad"
                maxLength={10}
                value={form.phone}
                onChangeText={(val) => set('phone', val.replace(/\D/g, '').slice(0, 10))}
              />
              <Text style={styles.hint}>{form.phone.length}/10 digits</Text>

              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor={COLORS.gray400}
                value={form.name}
                onChangeText={(val) => set('name', val)}
              />

              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="Must be 18+"
                placeholderTextColor={COLORS.gray400}
                keyboardType="number-pad"
                maxLength={2}
                value={form.age}
                onChangeText={(val) => set('age', val.replace(/\D/g, '').slice(0, 2))}
              />

              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setGenderModalVisible(true)}>
                <Text style={styles.selectBtnText}>{form.gender || 'Select Gender'}</Text>
                <Text style={styles.selectArrow}>▾</Text>
              </TouchableOpacity>

              <Text style={styles.label}>County</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setCountyModalVisible(true)}>
                <Text style={styles.selectBtnText}>{form.county || 'Select County'}</Text>
                <Text style={styles.selectArrow}>▾</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Town</Text>
              <TextInput
                style={styles.input}
                placeholder="Your town"
                placeholderTextColor={COLORS.gray400}
                value={form.town}
                onChangeText={(val) => set('town', val)}
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleStep1}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Next →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Details ── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Personal Details</Text>
              {[
                { key: 'education', placeholder: 'Education Level (e.g. University)' },
                { key: 'profession', placeholder: 'Profession' },
                { key: 'maritalStatus', placeholder: 'Marital Status (e.g. Single)' },
                { key: 'religion', placeholder: 'Religion' },
                { key: 'ethnicity', placeholder: 'Ethnicity' },
              ].map(({ key, placeholder }) => (
                <View key={key}>
                  <Text style={styles.label}>{placeholder.split(' (')[0]}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.gray400}
                    value={form[key]}
                    onChangeText={(val) => set(key, val)}
                  />
                </View>
              ))}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setStep(1)}>
                  <Text style={styles.btnOutlineText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1 }, loading && styles.btnDisabled]}
                  onPress={handleStep2}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Next →</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 3: About Me ── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>About You</Text>
              <Text style={styles.label}>Describe yourself</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Tell potential matches about yourself..."
                placeholderTextColor={COLORS.gray400}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={form.description}
                onChangeText={(val) => set('description', val)}
              />
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setStep(2)}>
                  <Text style={styles.btnOutlineText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1 }, loading && styles.btnDisabled]}
                  onPress={handleStep3}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Next →</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 4: Password ── */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set Password</Text>
              <Text style={styles.stepSubtitle}>Almost done! Secure your account.</Text>

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.gray400}
                  secureTextEntry={!showPassword}
                  value={form.password}
                  onChangeText={(val) => set('password', val)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Confirm Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Repeat your password"
                  placeholderTextColor={COLORS.gray400}
                  secureTextEntry={!showConfirmPassword}
                  value={form.confirmPassword}
                  onChangeText={(val) => set('confirmPassword', val)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.btnRow, { marginTop: 20 }]}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => setStep(3)}>
                  <Text style={styles.btnOutlineText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1 }, loading && styles.btnDisabled]}
                  onPress={handleStep4}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>Set Password</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 5: Done ── */}
          {step === 5 && (
            <View style={[styles.stepContent, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
              <Text style={styles.doneTitle}>You're all set!</Text>
              <Text style={styles.doneSubtitle}>
                Your profile and password have been created successfully.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { width: '100%', marginTop: 24 }]}
                onPress={() => navigation.replace('Login')}
              >
                <Text style={styles.btnText}>Login to Find Matches</Text>
              </TouchableOpacity>
            </View>
          )}

          {step < 5 && (
            <TouchableOpacity style={styles.backHome} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.backHomeText}>Already have an account? Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.gray100 },
  headerBg: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 50,
    alignItems: 'center',
  },
  logo: { fontSize: 38, fontWeight: '900', color: COLORS.white, letterSpacing: -1 },
  tagline: { color: COLORS.primaryMid, fontSize: 15, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 24,
    padding: 20,
    marginBottom: 30,
    ...SHADOWS.card,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center', alignItems: 'center',
  },
  stepActive: { backgroundColor: COLORS.primary },
  stepDone: { backgroundColor: COLORS.primary },
  stepNum: { fontSize: 12, fontWeight: '700', color: COLORS.gray500 },
  stepNumActive: { color: COLORS.white },
  stepCheckmark: { fontSize: 12, fontWeight: '900', color: COLORS.white },
  stepLabel: { fontSize: 9, color: COLORS.gray400, marginTop: 3, textAlign: 'center' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
  progressBar: {
    height: 4, backgroundColor: COLORS.gray100,
    borderRadius: 2, marginBottom: 20, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  errorBox: { backgroundColor: COLORS.red50, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: COLORS.red500, fontSize: 13, textAlign: 'center' },
  stepContent: {},
  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.gray800, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: COLORS.gray500, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.gray700, marginBottom: 5, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.gray200,
    borderRadius: 12, padding: 13, fontSize: 15,
    color: COLORS.gray800, backgroundColor: COLORS.gray50, marginBottom: 4,
  },
  hint: { fontSize: 11, color: COLORS.gray400, marginBottom: 2 },
  selectBtn: {
    borderWidth: 1.5, borderColor: COLORS.gray200,
    borderRadius: 12, padding: 13,
    backgroundColor: COLORS.gray50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  selectBtnText: { fontSize: 15, color: COLORS.gray700 },
  selectArrow: { color: COLORS.gray400, fontSize: 16 },
  textarea: { height: 120, paddingTop: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyeBtn: { padding: 10 },
  eyeIcon: { fontSize: 18 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 16, ...SHADOWS.card,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  btnOutline: {
    borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 15,
    paddingHorizontal: 16, alignItems: 'center', marginTop: 16,
  },
  btnOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  btnRow: { flexDirection: 'row', gap: 10 },
  backHome: { marginTop: 16, alignItems: 'center' },
  backHomeText: { color: COLORS.gray400, fontSize: 13 },
  doneTitle: { fontSize: 26, fontWeight: '900', color: COLORS.primary, marginBottom: 8 },
  doneSubtitle: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 20 },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '75%',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.gray800, marginBottom: 12 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  modalItemText: { fontSize: 15, color: COLORS.gray700 },
  modalItemSelected: { color: COLORS.primary, fontWeight: '700' },
  modalClose: {
    marginTop: 12, padding: 14, backgroundColor: COLORS.gray100,
    borderRadius: 12, alignItems: 'center',
  },
  modalCloseText: { color: COLORS.gray700, fontWeight: '700', fontSize: 15 },
});
