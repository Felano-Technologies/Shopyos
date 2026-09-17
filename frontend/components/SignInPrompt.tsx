import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ThemeColors } from '@/constants/Colors';

type Props = Readonly<{
  title?: string;
  message?: string;
  /** Route to return to after a successful login. */
  redirect: string;
}>;

/**
 * Inline "sign in to continue" state for account-only screens (Settings,
 * Orders, Profile) that guests can still reach via the persistent bottom
 * nav — shown in place of the screen's real content instead of a broken
 * placeholder or a forced redirect.
 */
export function SignInPrompt({ title, message, redirect }: Props) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name="user" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title || 'Sign in to continue'}</Text>
      <Text style={styles.message}>{message || 'Create an account or sign in to see this.'}</Text>
      <TouchableOpacity
        accessibilityLabel="Log in"
        accessibilityRole="button"
        style={styles.primaryBtn}
        onPress={() => router.push({ pathname: '/login', params: { redirect } })}
      >
        <Text style={styles.primaryBtnText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Create an account"
        accessibilityRole="button"
        style={styles.secondaryBtn}
        onPress={() => router.push('/register')}
      >
        <Text style={styles.secondaryBtnText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  secondaryBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
});
