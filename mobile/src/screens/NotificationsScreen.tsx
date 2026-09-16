import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl,
  StatusBar, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { clearToken } from '../utils/tokenStorage';
import { COLORS, SHADOWS, hashPhone } from '../theme';

export default function NotificationsScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState([]);
  const [acceptedByMe, setAcceptedByMe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState({});

  useEffect(() => {
    (async () => {
      const u = await AsyncStorage.getItem('penzi_user');
      if (!u) { navigation.replace('Login'); return; }
      const user = JSON.parse(u);
      setPhone(user.phone_number);
    })();
  }, []);

  useEffect(() => {
    if (!phone) return;
    fetchAll();
  }, [phone]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchInterests(), fetchAcceptedByMe()]);
    setLoading(false);
  };

  const fetchInterests = async () => {
    try {
      const res = await api.get(`/interest/pending/${phone}`);
      setInterests(res.data);
    } catch {}
  };

  const fetchAcceptedByMe = async () => {
    try {
      const res = await api.get(`/interest/accepted-by-me/${phone}`);
      setAcceptedByMe(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const handleRespond = async (id, response) => {
    setResponding(p => ({ ...p, [id]: true }));
    try {
      await api.post('/webhook/onfon', { sender: phone, message: response });
      setInterests(p => p.filter(i => i.interest_request_id !== id));
    } catch {}
    finally { setResponding(p => ({ ...p, [id]: false })); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await clearToken();
    await AsyncStorage.removeItem('penzi_user');
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerLogo}>Notifications</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.content}>

          {/* ── Section 1: Interest Requests ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Interest Requests</Text>
            {interests.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{interests.length}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={[styles.card, styles.loadingCard]}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : interests.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyIcon}>💌</Text>
              <Text style={styles.emptyText}>No pending interest requests.</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('Matches')}
              >
                <Text style={styles.primaryBtnText}>Find Matches</Text>
              </TouchableOpacity>
            </View>
          ) : (
            interests.map(interest => (
              <View key={interest.interest_request_id} style={[styles.card, styles.interestCard]}>
                <View style={styles.avatarRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{interest.requester_name?.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{interest.requester_name}</Text>
                    <Text style={styles.personMeta}>Age: {interest.requester_age}</Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>County</Text>
                    <Text style={styles.detailChipVal}>{interest.requester_county}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>Town</Text>
                    <Text style={styles.detailChipVal}>{interest.requester_town}</Text>
                  </View>
                </View>
                <Text style={styles.phoneText}>📞 {hashPhone(interest.requester_phone)}</Text>

                <View style={styles.promptBox}>
                  <Text style={styles.promptText}>
                    {interest.requester_name} is interested in you. Do you accept?
                  </Text>
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1 }]}
                    onPress={() => handleRespond(interest.interest_request_id, 'YES')}
                    disabled={responding[interest.interest_request_id]}
                  >
                    {responding[interest.interest_request_id]
                      ? <ActivityIndicator color={COLORS.white} size="small" />
                      : <Text style={styles.primaryBtnText}>✓ Accept</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.grayBtn, { flex: 1 }]}
                    onPress={() => handleRespond(interest.interest_request_id, 'NO')}
                    disabled={responding[interest.interest_request_id]}
                  >
                    <Text style={styles.grayBtnText}>✗ Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* ── Section 2: Your accepted interests ── */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Text style={styles.sectionTitle}>My Accepted Interests</Text>
            {acceptedByMe.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: COLORS.green500 }]}>
                <Text style={styles.countBadgeText}>{acceptedByMe.length}</Text>
              </View>
            )}
          </View>

          {acceptedByMe.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyIcon}>🤞</Text>
              <Text style={styles.emptyText}>None of your interests accepted yet.</Text>
            </View>
          ) : (
            acceptedByMe.map(item => (
              <View key={item.interest_request_id} style={[styles.card, styles.acceptedCard]}>
                <View style={styles.acceptedBanner}>
                  <Text style={styles.acceptedBannerText}>✓ Your interest was accepted!</Text>
                </View>

                <View style={styles.avatarRow}>
                  <View style={[styles.avatar, { backgroundColor: COLORS.green500 }]}>
                    <Text style={styles.avatarText}>{item.acceptor_name?.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{item.acceptor_name}</Text>
                    <Text style={styles.personMeta}>Age: {item.acceptor_age}</Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>County</Text>
                    <Text style={styles.detailChipVal}>{item.acceptor_county}</Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipLabel}>Town</Text>
                    <Text style={styles.detailChipVal}>{item.acceptor_town}</Text>
                  </View>
                </View>

                <View style={styles.phoneRevealBox}>
                  <Text style={styles.phoneRevealLabel}>📞 Phone Number</Text>
                  <Text style={styles.phoneRevealNumber}>{item.acceptor_phone}</Text>
                </View>

                <Text style={styles.celebText}>
                  🎉 {item.acceptor_name} accepted! You can now reach out to them.
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  backIcon: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  headerLogo: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  logoutText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, backgroundColor: COLORS.gray100 },
  content: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, gap: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.gray800 },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
  },
  countBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18, padding: 16,
    marginBottom: 14, ...SHADOWS.card,
  },
  loadingCard: { alignItems: 'center', paddingVertical: 24 },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: COLORS.gray400, fontWeight: '600', marginBottom: 16 },
  interestCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  acceptedCard: { borderLeftWidth: 4, borderLeftColor: COLORS.green500 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  personName: { fontSize: 17, fontWeight: '800', color: COLORS.gray800 },
  personMeta: { fontSize: 13, color: COLORS.gray500 },
  detailsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  detailChip: {
    flex: 1, backgroundColor: COLORS.gray50,
    borderRadius: 10, padding: 10,
  },
  detailChipLabel: { fontSize: 10, color: COLORS.gray400, marginBottom: 2 },
  detailChipVal: { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },
  phoneText: { fontSize: 12, color: COLORS.gray400, marginBottom: 10 },
  promptBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  promptText: { color: COLORS.primary, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', ...SHADOWS.card,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  grayBtn: {
    backgroundColor: COLORS.gray200, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  grayBtnText: { color: COLORS.gray700, fontWeight: '700', fontSize: 15 },
  acceptedBanner: {
    backgroundColor: COLORS.green50, borderRadius: 10,
    padding: 10, marginBottom: 12, alignItems: 'center',
  },
  acceptedBannerText: { color: COLORS.green600, fontWeight: '700', fontSize: 13 },
  phoneRevealBox: {
    backgroundColor: COLORS.green50,
    borderWidth: 1, borderColor: COLORS.green200,
    borderRadius: 12, padding: 14, marginVertical: 10,
  },
  phoneRevealLabel: { fontSize: 11, color: COLORS.green600, fontWeight: '700', marginBottom: 4 },
  phoneRevealNumber: { fontSize: 22, fontWeight: '900', color: COLORS.green700 },
  celebText: {
    color: COLORS.green700, fontWeight: '700',
    fontSize: 14, textAlign: 'center', marginTop: 4,
  },
});
