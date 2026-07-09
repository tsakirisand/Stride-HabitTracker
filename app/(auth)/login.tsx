import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider, signInWithCredential, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState, useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { auth } from '@/firebase/config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '393508081606-657jgpagr1djhfqiolukkc1nrhfcopgh.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .catch(error => {
          Alert.alert('Google Sign-In Error', error.message);
          setLoading(false);
        });
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      let msg = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
      else if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
      else if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
      else if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymous = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (error) {
      Alert.alert('Error', 'Failed to continue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Logo Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Svg height="32" width="32" viewBox="0 0 24 24">
                <Path
                  d="M5 12l5 5L19 7"
                  fill="none"
                  stroke="#121212"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
          <Text style={styles.logo}>Stride</Text>
          <Text style={styles.tagline}>Build better habits, one day at a time</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchTextBold}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social */}
        <View style={styles.socialContainer}>
          <TouchableOpacity 
            style={styles.socialBtn} 
            onPress={() => promptAsync()}
            disabled={!request || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={22} color="#FFF" />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity 
              style={[styles.socialBtn, styles.appleBtn]} 
              onPress={() => Alert.alert('Ενημέρωση', 'Η σύνδεση με Apple χρειάζεται ρύθμιση στο Firebase & Apple Developer.')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={22} color="#000" />
              <Text style={[styles.socialBtnText, styles.appleBtnText]}>Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Anonymous */}
        <TouchableOpacity
          style={styles.anonymousBtn}
          onPress={handleAnonymous}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons name="flash-outline" size={20} color="#AAA" />
          <Text style={styles.anonymousBtnText}>Continue without account</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimerText}>
          Data from anonymous accounts cannot be recovered if you uninstall the app.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4DA8DA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4DA8DA',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: '#888',
    marginTop: 8,
    fontWeight: '500',
  },
  formSection: {
    gap: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    paddingVertical: 16,
  },
  eyeBtn: {
    padding: 8,
    marginLeft: 4,
  },
  loginBtn: {
    backgroundColor: '#4DA8DA',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4DA8DA',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#121212',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  switchBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchText: {
    color: '#888',
    fontSize: 14,
  },
  switchTextBold: {
    color: '#4DA8DA',
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2C2C2C',
  },
  dividerText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  anonymousBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    gap: 10,
  },
  anonymousBtnText: {
    color: '#AAA',
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimerText: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  appleBtn: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  socialBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  appleBtnText: {
    color: '#000',
  },
});
