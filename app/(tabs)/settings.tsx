import { useHabitsContext } from '@/context/HabitsContext';
import { auth } from '@/firebase/config';
import { triggerHaptic } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
   const { user, isLoaded } = useHabitsContext();

   const handleSignOut = () => {
      triggerHaptic('warning');
      const isAnonymous = user?.isAnonymous;

      Alert.alert(
         'Sign Out',
         isAnonymous
            ? 'You are using an anonymous account. Signing out will permanently delete all your data. Are you sure?'
            : 'Are you sure you want to sign out?',
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Sign Out',
               style: 'destructive',
               onPress: async () => {
                  try {
                     await signOut(auth);
                  } catch (e) {
                     console.error('Failed to sign out', e);
                     Alert.alert('Error', 'Failed to sign out. Please try again.');
                  }
               }
            }
         ]
      );
   };

   if (!isLoaded) return null;

   return (
      <SafeAreaView style={styles.container} edges={['top']}>
         <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
         </View>

         <View style={styles.content}>
            {/* Account Card */}
            <View style={styles.card}>
               <Text style={styles.cardLabel}>Account</Text>

               <View style={styles.accountRow}>
                  <View style={styles.avatar}>
                     <Ionicons
                        name={user?.isAnonymous ? 'person-outline' : 'person'}
                        size={24}
                        color="#4DA8DA"
                     />
                  </View>
                  <View style={styles.accountInfo}>
                     <Text style={styles.accountName} numberOfLines={1}>
                        {user?.isAnonymous
                           ? 'Anonymous User'
                           : (user?.displayName || user?.email || 'User')}
                     </Text>
                     <Text style={styles.accountEmail} numberOfLines={1}>
                        {user?.isAnonymous
                           ? 'No account linked'
                           : (user?.email || '')}
                     </Text>
                  </View>
               </View>
            </View>

            {/* App Info Card */}
            <View style={styles.card}>
               <Text style={styles.cardLabel}>App</Text>

               <View style={styles.infoRow}>
                  <View style={styles.infoLeft}>
                     <Ionicons name="information-circle-outline" size={22} color="#888" />
                     <Text style={styles.infoText}>Version</Text>
                  </View>
                  <Text style={styles.infoValue}>1.0.0</Text>
               </View>
            </View>

            {/* Sign Out */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
               <Ionicons name="log-out-outline" size={20} color="#FF6A6A" />
               <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
         </View>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: '#121212',
   },
   header: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      marginBottom: 10,
   },
   headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#FFF',
      letterSpacing: 0.5,
   },
   content: {
      paddingHorizontal: 20,
      flex: 1,
   },
   card: {
      backgroundColor: '#1E1E1E',
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: '#2C2C2C',
      marginBottom: 20,
   },
   cardLabel: {
      color: '#888',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
   },
   accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
   },
   avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#252525',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#333',
   },
   accountInfo: {
      marginLeft: 14,
      flex: 1,
   },
   accountName: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
   },
   accountEmail: {
      color: '#888',
      fontSize: 13,
      marginTop: 2,
   },
   infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
   },
   infoLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
   },
   infoText: {
      color: '#FFF',
      fontSize: 15,
      fontWeight: '500',
   },
   infoValue: {
      color: '#888',
      fontSize: 15,
      fontWeight: '500',
   },
   signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1E1E1E',
      borderRadius: 16,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: '#2C2C2C',
      gap: 10,
      marginTop: 4,
   },
   signOutText: {
      color: '#FF6A6A',
      fontSize: 16,
      fontWeight: '600',
   },
});
