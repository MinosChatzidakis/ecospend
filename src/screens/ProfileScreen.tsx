import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, ImageBackground, Switch } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchProfileAndLeaderboard = async () => {
        if (!user) return;
        try {
          // Fetch current user
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          if (docSnap.exists() && isActive) {
            setProfile(docSnap.data());
          }

          // Fetch Leaderboard (Top 10 by EcoPoints)
          const q = query(collection(db, 'users'), orderBy('ecoPoints', 'desc'), limit(10));
          const querySnapshot = await getDocs(q);
          const topUsers: any[] = [];
          querySnapshot.forEach((d) => {
            topUsers.push({ id: d.id, ...d.data() });
          });

          if (isActive) setLeaderboard(topUsers);
        } catch (error) {
          console.error(error);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      fetchProfileAndLeaderboard();

      return () => { isActive = false; };
    }, [user])
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  const toggleHostMode = async (value: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isHostMode: value
      });
      setProfile((prev: any) => ({ ...prev, isHostMode: value }));
    } catch (error) {
      console.error("Error toggling host mode", error);
      Alert.alert("Error", "Failed to update Host Mode status.");
    }
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Reset all your scans and points for testing?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
          if (!user) return;
          try {
            const snap = await getDocs(collection(db, 'users', user.uid, 'receipts'));
            for (const receiptDoc of snap.docs) {
              await deleteDoc(receiptDoc.ref);
            }
            await updateDoc(doc(db, 'users', user.uid), {
              totalSpentThisMonth: 0,
              ecoPoints: 0
            });
            Alert.alert('Success', 'History wiped! Your points and dashboard are reset.');
            setProfile((prev: any) => ({ ...prev, ecoPoints: 0, totalSpentThisMonth: 0 }));
          } catch (e) {
             Alert.alert('Error', 'Failed to clear history.');
          }
      }}
    ]);
  };

  const getRank = (points: number) => {
    if (!points) return 'Seedling 🌱';
    if (points > 500) return 'Forest Master 🌲';
    if (points > 100) return 'Tree 🌳';
    return 'Seedling 🌱';
  };

  const handleRedeem = () => {
    if (profile?.ecoPoints >= 100) {
      Alert.alert('Reward Unlocked!', 'Here is your 10% discount code for EcoMarket: ECOHACK10');
    } else {
      Alert.alert('Not Enough Points', 'You need at least 100 EcoPoints to redeem this reward.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#38A169" /></View>;
  }

  return (
    <ImageBackground source={require('../../assets/mainback.jpg')} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}><Text style={styles.avatar}>👤</Text></View>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.rankBadge}>{getRank(profile?.ecoPoints || 0)}</Text>
      </View>

      {/* Host Mode Toggle */}
      <View style={styles.hostModeCard}>
        <Text style={styles.hostModeTitle}>Επαγγελματικό Έξοδο (Host Mode)</Text>
        <Switch 
          value={profile?.isHostMode || false} 
          onValueChange={toggleHostMode}
          trackColor={{ false: "#CBD5E0", true: "#38A169" }}
          thumbColor={"#FFFFFF"}
        />
      </View>

      {/* Rewards Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Eco-Rewards</Text>
        <Text style={styles.pointsText}>{profile?.ecoPoints || 0} pts</Text>
        <Text style={styles.subtitle}>Redeem points for discounts at sustainable brands!</Text>
        
        <TouchableOpacity 
          style={[styles.redeemButton, (profile?.ecoPoints || 0) < 100 && styles.redeemDisabled]} 
          onPress={handleRedeem}
        >
          <Text style={styles.redeemText}>Redeem 10% Discount (100 pts)</Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌍 Global Leaderboard</Text>
        {leaderboard.map((lbUser, index) => (
          <View key={lbUser.id} style={[styles.lbRow, lbUser.id === user?.uid && styles.lbHighlight]}>
            <Text style={styles.lbRank}>#{index + 1}</Text>
            <Text style={styles.lbEmail} numberOfLines={1}>
              {lbUser.email?.split('@')[0] || 'Anonymous'}
            </Text>
            <Text style={styles.lbPoints}>{lbUser.ecoPoints || 0} pts</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
        <Text style={styles.clearText}>Clear Test History</Text>
      </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  container: { flexGrow: 1, backgroundColor: 'rgba(247, 249, 252, 0.85)', alignItems: 'center', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatar: { fontSize: 40 },
  email: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
  rankBadge: { backgroundColor: '#C6F6D5', color: '#276749', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: 'bold', marginTop: 8, overflow: 'hidden' },
  
  card: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 15, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#2D3748', marginBottom: 10 },
  pointsText: { fontSize: 36, fontWeight: 'bold', color: '#38A169' },
  subtitle: { fontSize: 13, color: '#A0AEC0', textAlign: 'center', marginBottom: 15 },
  
  redeemButton: { backgroundColor: '#ECC94B', width: '100%', padding: 15, borderRadius: 10, alignItems: 'center' },
  redeemDisabled: { backgroundColor: '#E2E8F0' },
  redeemText: { color: '#744210', fontWeight: 'bold', fontSize: 14 },
  
  lbRow: { flexDirection: 'row', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'center' },
  lbHighlight: { backgroundColor: '#E6FFFA', borderRadius: 8 },
  lbRank: { width: 30, fontSize: 16, fontWeight: 'bold', color: '#A0AEC0' },
  lbEmail: { flex: 1, fontSize: 16, color: '#2D3748' },
  lbPoints: { fontSize: 16, fontWeight: 'bold', color: '#38A169' },
  
  logoutButton: { backgroundColor: '#E53E3E', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 10 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  clearButton: { marginTop: 15, padding: 10, width: '100%', alignItems: 'center' },
  clearText: { color: '#A0AEC0', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline' },
  
  hostModeCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2D3748', width: '100%', borderRadius: 15, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  hostModeTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
});
