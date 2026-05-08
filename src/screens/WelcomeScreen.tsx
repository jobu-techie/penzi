import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  ImageBackground, StatusBar, Dimensions, Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";

const { height, width } = Dimensions.get("window");

const photos = [
  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80",
  "https://images.unsplash.com/photo-1529636798458-92182e662485?w=800&q=80",
  "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&q=80",
  "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80",
  "https://images.unsplash.com/photo-1502945015378-0e284ca1a5be?w=800&q=80",
];

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % photos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "white" }} bounces={false}>
      <StatusBar barStyle="light-content" />

      {/* Hero Image */}
      <ImageBackground
        source={{ uri: photos[current] }}
        style={{ height: height * 0.6 }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "rgba(219,39,119,0.9)"]}
          style={{ flex: 1, justifyContent: "flex-end", padding: 28 }}
        >
          {/* Top bar */}
          <View style={{
            position: "absolute", top: 48, left: 24, right: 24,
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          }}>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "800", letterSpacing: 3 }}>
              PENZI
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login" as never)}
              style={{ borderWidth: 1, borderColor: "white", borderRadius: 99, paddingHorizontal: 20, paddingVertical: 8 }}
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>Login</Text>
            </TouchableOpacity>
          </View>

          {/* Hero text */}
          <Text style={{ color: "white", fontSize: 36, fontWeight: "800", lineHeight: 44, marginBottom: 8 }}>
            Find Your{"\n"}
            <Text style={{ color: "#fbcfe8" }}>Perfect Match</Text>
          </Text>
          <Text style={{ color: "#fce7f3", fontSize: 14, marginBottom: 24 }}>
            Kenya's premier dating platform
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("Register" as never)}
            style={{ backgroundColor: "white", borderRadius: 99, paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: "#db2777", fontWeight: "700", fontSize: 16 }}>
              Get Started — It's Free
            </Text>
          </TouchableOpacity>

          {/* Dots */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 16, gap: 6 }}>
            {photos.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCurrent(i)}>
                <View style={{
                  height: 8, borderRadius: 99,
                  width: i === current ? 24 : 8,
                  backgroundColor: i === current ? "white" : "rgba(255,255,255,0.4)",
                }} />
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* Stats Row */}
      <View style={{ flexDirection: "row", backgroundColor: "#db2777", paddingVertical: 20 }}>
        {[
          { value: "6,000+", label: "Members" },
          { value: "47", label: "Counties" },
          { value: "100%", label: "Free" },
        ].map((stat, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>{stat.value}</Text>
            <Text style={{ color: "#fbcfe8", fontSize: 12, marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 36, backgroundColor: "white" }}>
        <Text style={{ color: "#1f2937", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 24 }}>
          How It Works
        </Text>
        {[
          { step: "1", title: "Register Free", desc: "Create your profile in minutes" },
          { step: "2", title: "Find Matches", desc: "Search by age, county & more" },
          { step: "3", title: "Connect", desc: "Chat and meet your match" },
        ].map((item) => (
          <View key={item.step} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 24 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 99,
              backgroundColor: "#fce7f3", alignItems: "center", justifyContent: "center", marginRight: 16,
            }}>
              <Text style={{ color: "#db2777", fontWeight: "700" }}>{item.step}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#1f2937", fontWeight: "700", fontSize: 15 }}>{item.title}</Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 2 }}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA Bottom */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 40, backgroundColor: "#f9fafb" }}>
        <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
          Already have an account?
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login" as never)}
          style={{
            borderWidth: 2, borderColor: "#db2777",
            borderRadius: 99, paddingVertical: 16, alignItems: "center",
          }}
        >
          <Text style={{ color: "#db2777", fontWeight: "700", fontSize: 16 }}>Login</Text>
        </TouchableOpacity>

        {/* Contact info */}
        <Text style={{ color: "#9ca3af", fontSize: 11, textAlign: "center", marginTop: 32, lineHeight: 18 }}>
          SMS: 22141 · support@penzi.co.ke{"\n"}© 2026 Penzi Dating Platform
        </Text>
      </View>
    </ScrollView>
  );
}
