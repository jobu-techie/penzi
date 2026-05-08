import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";
import { getUser } from "../utils/storage";
import { WEBHOOK_HEADERS } from "../constants";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { phone }  = route.params;

  const [profile, setProfile]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [senderPhone, setSenderPhone]   = useState("");
  const [interestSent, setInterestSent] = useState(false);
  const [interestMsg, setInterestMsg]   = useState("");

  useEffect(() => {
    (async () => {
      const user = await getUser();
      if (user) setSenderPhone(user.phone_number);
      try {
        const res = await api.get(`/users/profile/${phone}`);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [phone]);

  const handleInterest = async () => {
    try {
      const res = await api.post(
        "/webhook/onfon",
        { sender: senderPhone, message: phone },
        { headers: WEBHOOK_HEADERS }
      );
      setInterestSent(true);
      setInterestMsg(res.data);
    } catch (err) {
      if (err.response?.status === 409) {
        setInterestSent(true);
        setInterestMsg("Interest already sent.");
      }
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#db2777" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100 px-6">
        <Ionicons name="person-outline" size={60} color="#f9a8d4" />
        <Text className="text-gray-400 mt-4 text-center">Profile not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4">
          <Text className="text-pink-600 font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const details = [
    { label: "County",         value: profile.county },
    { label: "Town",           value: profile.town },
    { label: "Phone",          value: profile.phone_number },
    profile.details && { label: "Education",     value: profile.details.education_level },
    profile.details && { label: "Profession",    value: profile.details.profession },
    profile.details && { label: "Marital Status",value: profile.details.marital_status },
    profile.details && { label: "Religion",      value: profile.details.religion },
    profile.details && { label: "Ethnicity",     value: profile.details.ethnicity },
  ].filter(Boolean);

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-pink-600 pt-12 pb-5 px-6 flex-row justify-between items-center">
        <Text className="text-white text-xl font-extrabold tracking-widest">PENZI</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-white rounded-full px-4 py-1.5"
        >
          <Text className="text-pink-600 font-semibold text-sm">← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-6 pb-10">
        <View className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          {/* Avatar + name */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-pink-100 rounded-full items-center justify-center mb-3">
              <Text className="text-3xl font-bold text-pink-600">{profile.name?.charAt(0)}</Text>
            </View>
            <Text className="text-2xl font-extrabold text-gray-800">{profile.name}</Text>
            <Text className="text-gray-500 mt-1">
              {profile.gender} · {profile.age} years old
            </Text>
          </View>

          {/* Detail rows */}
          {details.map(({ label, value }) => (
            <View key={label} className="flex-row justify-between py-3 border-b border-gray-50">
              <Text className="text-gray-400">{label}</Text>
              <Text className="font-semibold text-gray-700 max-w-[60%] text-right">{value}</Text>
            </View>
          ))}

          {/* About */}
          {profile.description && (
            <View className="mt-4 bg-pink-50 rounded-xl p-4">
              <Text className="text-xs text-gray-400 mb-1">About</Text>
              <Text className="text-gray-700 italic">"{profile.description}"</Text>
            </View>
          )}
        </View>

        {/* Interest message */}
        {interestMsg ? (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <Text className="text-green-700 text-center">{interestMsg}</Text>
          </View>
        ) : null}

        {/* Send interest button */}
        {senderPhone !== profile.phone_number && (
          <TouchableOpacity
            onPress={handleInterest}
            disabled={interestSent}
            className="bg-pink-600 rounded-2xl py-4 items-center mb-8"
            style={{ opacity: interestSent ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {interestSent ? "Interest Sent ✓" : "Send Interest"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
