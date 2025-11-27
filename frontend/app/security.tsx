import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Image,
  useColorScheme,
  Alert,
} from "react-native";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SecuritySettings() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === "dark";

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [securityQuestionsEnabled, setSecurityQuestionsEnabled] = useState(false);

  // ─── Load toggle states on mount ───
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const tfa = await AsyncStorage.getItem("twoFactorEnabled");
        const bio = await AsyncStorage.getItem("biometricEnabled");
        const sec = await AsyncStorage.getItem("securityQuestionsEnabled");

        if (tfa !== null) setTwoFactorEnabled(JSON.parse(tfa));
        if (bio !== null) setBiometricEnabled(JSON.parse(bio));
        if (sec !== null) setSecurityQuestionsEnabled(JSON.parse(sec));
      } catch (error) {
        console.error("Error loading security settings:", error);
      }
    };
    loadSettings();
  }, []);

  // ─── Save to AsyncStorage ───
  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  // ─── Handlers ───
  const handleChangePassword = () => router.push("/settings/changePassword");

  const handleLoginHistory = () => router.push("/settings/loginHistory");

  const handleToggleTwoFactor = async (value: boolean) => {
    setTwoFactorEnabled(value);
    await saveSetting("twoFactorEnabled", value);
    Alert.alert(
      "Two-Factor Authentication",
      value
        ? "Two-factor authentication has been enabled."
        : "Two-factor authentication has been disabled."
    );
  };

  const handleToggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
    await saveSetting("biometricEnabled", value);
    Alert.alert(
      "Biometric Authentication",
      value
        ? "Biometric authentication is now active."
        : "Biometric authentication has been turned off."
    );
  };

  const handleToggleSecurityQuestions = async (value: boolean) => {
    setSecurityQuestionsEnabled(value);
    await saveSetting("securityQuestionsEnabled", value);
    Alert.alert(
      "Security Questions",
      value
        ? "Security questions have been set up."
        : "Security questions have been disabled."
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Image
          source={require("../assets/images/splash-icon.png")}
          style={styles.headerWatermark}
        />
        <FontAwesome5 name="user-shield" size={55} color="#fff" />
        <Text style={styles.headerTitle}>Security Settings</Text>
      </View>

      {/* ─── Content ─── */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Change Password */}
        <TouchableOpacity style={styles.item} onPress={handleChangePassword}>
          <View style={styles.iconLabel}>
            <Ionicons name="lock-closed" size={22} color="#081059" />
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>Change Password</Text>
              <Text style={styles.itemDescription}>
                Update your current password to ensure your account remains
                secure.
              </Text>
            </View>
          </View>
          <Text style={styles.arrow}>{">"}</Text>
        </TouchableOpacity>

        {/* Two-Factor Authentication */}
        <View style={styles.item}>
          <View style={styles.iconLabel}>
            <FontAwesome5 name="user-shield" size={22} color="#081059" />
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>Two-Factor Authentication</Text>
              <Text style={styles.itemDescription}>
                Enhance the security of your account by requiring a second
                verification.
              </Text>
            </View>
          </View>
          <Switch
            value={twoFactorEnabled}
            onValueChange={handleToggleTwoFactor}
            trackColor={{ false: "#D1D5DB", true: "#A3E635" }}
            thumbColor="#fff"
          />
        </View>

        {/* Biometric Authentication */}
        <View style={styles.item}>
          <View style={styles.iconLabel}>
            <MaterialIcons name="fingerprint" size={24} color="#081059" />
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>Biometric Authentication</Text>
              <Text style={styles.itemDescription}>
                Use your device’s biometric for a quick and secure login.
              </Text>
            </View>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: "#D1D5DB", true: "#A3E635" }}
            thumbColor="#fff"
          />
        </View>

        {/* Security Questions */}
        <View style={styles.item}>
          <View style={styles.iconLabel}>
            <Ionicons name="key-outline" size={22} color="#081059" />
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>Security Questions</Text>
              <Text style={styles.itemDescription}>
                Add an extra layer of security by setting up security questions.
              </Text>
            </View>
          </View>
          <Switch
            value={securityQuestionsEnabled}
            onValueChange={handleToggleSecurityQuestions}
            trackColor={{ false: "#D1D5DB", true: "#A3E635" }}
            thumbColor="#fff"
          />
        </View>

        {/* Login History */}
        <TouchableOpacity style={styles.item} onPress={handleLoginHistory}>
          <View style={styles.iconLabel}>
            <MaterialIcons name="login" size={24} color="#081059" />
            <View style={styles.textContainer}>
              <Text style={styles.itemTitle}>Login History</Text>
              <Text style={styles.itemDescription}>
                Log all of your login attempts, including successful and failed
                attempts.
              </Text>
            </View>
          </View>
          <Text style={styles.arrow}>{">"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F6FF",
  },
  header: {
    backgroundColor: "#081059",
    height: 180,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  headerWatermark: {
    position: "absolute",
    opacity: 0.08,
    width: 150,
    height: 150,
    right: -20,
    bottom: -10,
    resizeMode: "contain",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
  },
  iconLabel: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  itemTitle: {
    color: "#081059",
    fontSize: 15,
    fontWeight: "700",
  },
  itemDescription: {
    color: "#555",
    fontSize: 12,
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: "#000",
  },
  bottomNav: {
    position: "absolute",
    bottom: 15,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    elevation: 5,
  },
  navItem: {
    alignItems: "center",
  },
  navLabel: {
    fontSize: 12,
    color: "#000",
    marginTop: 2,
  },
});
