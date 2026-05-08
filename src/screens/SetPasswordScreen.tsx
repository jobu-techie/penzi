import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";

const API_URL = "http://10.0.2.2:5000";

export default function SetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [phone, setPhone] = useState((route.params as any)?.phone || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSetPassword = async () => {
    if (!phone || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API_URL}/auth/register`, {
        phone_number: phone,
        password: password,
      });
      setSuccess("Password set successfully! You can now login.");
      setTimeout(() => navigation.navigate("Login" as never), 2000);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Phone number not found. Please register via SMS first.");
      } else if (err.response?.status === 409) {
        setError("Password already set. Please login instead.");
      } else {
        setError("Failed to set password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#ec4899" }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{
        backgroundColor: "white",
        borderRadius: 24,
        padding: 32,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}>

        {/* Header */}
        <Text style={{ fontSize: 32, fontWeight: "800", color: "#db2777", textAlign: "center" }}>
          Penzi
        </Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 4, marginBottom: 28 }}>
          Set your password
        </Text>

        {/* Error */}
        {error ? (
          <View style={{ backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: "#ef4444", textAlign: "center", fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {/* Success */}
        {success ? (
          <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: "#16a34a", textAlign: "center", fontSize: 13 }}>{success}</Text>
          </View>
        ) : null}

        {/* Phone */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
          Phone Number
        </Text>
        <TextInput
          value={phone}
          onChangeText={(val) => setPhone(val.replace(/\D/g, "").slice(0, 10))}
          placeholder="e.g. 0712345678"
          keyboardType="numeric"
          maxLength={10}
          style={{
            borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
            padding: 14, fontSize: 15, marginBottom: 4,
          }}
        />
        <Text style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
          {phone.length}/10 digits
        </Text>

        {/* New Password */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
          New Password
        </Text>
        <View style={{ position: "relative", marginBottom: 16 }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry={!showPassword}
            style={{
              borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
              padding: 14, fontSize: 15, paddingRight: 50,
            }}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ position: "absolute", right: 14, top: 14 }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 13 }}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Password */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
          Confirm Password
        </Text>
        <View style={{ position: "relative", marginBottom: 24 }}>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat your password"
            secureTextEntry={!showConfirm}
            style={{
              borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10,
              padding: 14, fontSize: 15, paddingRight: 50,
            }}
          />
          <TouchableOpacity
            onPress={() => setShowConfirm(!showConfirm)}
            style={{ position: "absolute", right: 14, top: 14 }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 13 }}>
              {showConfirm ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSetPassword}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#f9a8d4" : "#db2777",
            borderRadius: 10, padding: 16, alignItems: "center",
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              Set Password
            </Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Login" as never)}
          style={{ marginTop: 20, alignItems: "center" }}
        >
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
