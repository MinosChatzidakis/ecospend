import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView, ImageBackground, TouchableOpacity, Modal } from 'react-native';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const screenWidth = Dimensions.get("window").width;

export default function DashboardScreen() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsModalVisible, setPointsModalVisible] = useState(false);
  const [pointsHistoryChart, setPointsHistoryChart] = useState<any>({
    labels: ['Start'],
    datasets: [{ data: [0] }]
  });
  const [spendingHistoryChart, setSpendingHistoryChart] = useState<any>({
    labels: ['Start'],
    datasets: [{ data: [0] }]
  });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchDashboardData = async () => {
        if (!user) return;
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && isActive) {
            setUserData(userSnap.data());
          }

          const receiptsRef = collection(db, 'users', user.uid, 'receipts');
          const q = query(receiptsRef, orderBy('date', 'desc'));
          const receiptsSnap = await getDocs(q);
          
          let categoryTotals: Record<string, number> = {};
          let loadedHistory: any[] = [];
          
          for (const receiptDoc of receiptsSnap.docs) {
            const receiptData = receiptDoc.data();
            const itemsRef = collection(receiptDoc.ref, 'scanned_items');
            const itemsSnap = await getDocs(itemsRef);
            
            let itemsList: any[] = [];
            itemsSnap.forEach(itemDoc => {
              const data = itemDoc.data();
              itemsList.push({ id: itemDoc.id, ...data });
              const cat = data.category || 'Other';
              const price = data.price || 0;
              categoryTotals[cat] = (categoryTotals[cat] || 0) + price;
            });

            loadedHistory.push({
              id: receiptDoc.id,
              ...receiptData,
              items: itemsList
            });
          }

          // Build Points & Spending History Arrays (grouping by Month)
          const pointsByMonth: Record<string, number> = {};
          const spendingByMonth: Record<string, number> = {};
          
          for (const r of loadedHistory) {
            if (r.date && r.date.toDate) {
              const d = r.date.toDate();
              const month = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`; // e.g., 5/26
              pointsByMonth[month] = (pointsByMonth[month] || 0) + (r.pointsEarned || 0);
              spendingByMonth[month] = (spendingByMonth[month] || 0) + (r.totalAmount || 0);
            }
          }

          // Sort months properly or just use as-is if ordered by desc in query
          // Let's reverse them so chronological order is left-to-right on the chart
          const sortedMonths = Object.keys(pointsByMonth).reverse();
          
          if (sortedMonths.length > 0) {
            setPointsHistoryChart({
              labels: sortedMonths,
              datasets: [{ data: sortedMonths.map(m => pointsByMonth[m]) }]
            });
            setSpendingHistoryChart({
              labels: sortedMonths,
              datasets: [{ data: sortedMonths.map(m => spendingByMonth[m]) }]
            });
          } else {
            setPointsHistoryChart({ labels: ['This Month'], datasets: [{ data: [userData?.ecoPoints || 0] }] });
            setSpendingHistoryChart({ labels: ['This Month'], datasets: [{ data: [userData?.totalSpentThisMonth || 0] }] });
          }

          // Format data for react-native-chart-kit
          const colors = ['#F56565', '#48BB78', '#4299E1', '#ECC94B', '#9F7AEA'];
          let colorIdx = 0;
          
          const formattedData = Object.keys(categoryTotals).map(key => ({
            name: key,
            total: categoryTotals[key],
            color: colors[colorIdx++ % colors.length],
            legendFontColor: '#718096',
            legendFontSize: 13
          }));

          // Implement the True Zero State requested by user
          if (formattedData.length === 0) {
            formattedData.push({ 
              name: 'No Data Yet', 
              total: 1, 
              color: '#E2E8F0', 
              legendFontColor: '#A0AEC0', 
              legendFontSize: 13 
            });
          }

          if (isActive) {
            setChartData(formattedData);
            setHistory(loadedHistory);
          }
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      fetchDashboardData();

      return () => {
        isActive = false;
      };
    }, [user])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38A169" />
      </View>
    );
  }

  return (
    <ImageBackground source={require('../../assets/mainback.jpg')} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardTitle}>Eco-Score</Text>
          <Text style={[styles.scoreText, !userData?.totalSpentThisMonth && { color: '#A0AEC0' }]}>
            {userData?.totalSpentThisMonth > 0 ? (userData?.ecoScoreAvg || 'B') : '-'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.card, styles.halfCard]} onPress={() => setPointsModalVisible(true)}>
          <Text style={styles.cardTitle}>Eco-Points ℹ️</Text>
          <Text style={styles.scoreText}>{userData?.ecoPoints || 0}</Text>
          <Text style={{fontSize: 10, color: '#A0AEC0', marginTop: 5}}>Tap for history</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Budget')}>
        <Text style={styles.cardTitle}>Monthly Budget ℹ️</Text>
        <Text style={styles.budgetAmount}>
          ${userData?.totalSpentThisMonth?.toFixed(2) || '0.00'} / ${userData?.monthlyBudget?.toFixed(2) || '500.00'}
        </Text>
        <Text style={styles.subtitle}>Tap to set category budgets</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Category</Text>
        <PieChart
          data={chartData}
          width={screenWidth - 80}
          height={200}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor={"total"}
          backgroundColor={"transparent"}
          paddingLeft={"10"}
          absolute
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending Over Time</Text>
        <BarChart
          data={spendingHistoryChart}
          width={screenWidth - 80}
          height={220}
          yAxisLabel="$"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(229, 62, 62, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Purchase History</Text>
        {history.length === 0 ? (
          <Text style={styles.subtitle}>No scans yet. Scan a receipt to see your items here!</Text>
        ) : (
          history.map((receipt, index) => {
            // Group items by category to separate them visually as requested
            const categories = Array.from(new Set(receipt.items?.map((i: any) => i.category)));

            return (
              <View key={receipt.id || index} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.storeName}>{receipt.storeName}</Text>
                    <View style={styles.aadeBadge}>
                      <Text style={styles.aadeText}>✓ AADE Validated</Text>
                    </View>
                  </View>
                  <Text style={styles.historyTotal}>${receipt.totalAmount?.toFixed(2)}</Text>
                </View>
                <Text style={styles.dateText}>
                  {receipt.date?.toDate ? receipt.date.toDate().toLocaleDateString() : 'Just now'}
                </Text>
                
                <View style={styles.itemsContainer}>
                  {categories.map((category: any) => (
                    <View key={category} style={styles.categorySection}>
                      <Text style={styles.categoryHeader}>{category}</Text>
                      
                      {receipt.items?.filter((i: any) => i.category === category).map((item: any, i: number) => (
                        <View key={item.id || i} style={styles.lineItemContainer}>
                          <View style={styles.lineItem}>
                            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                            <View style={styles.itemRight}>
                              <Text style={[styles.itemEco, item.ecoRating === 'A' || item.ecoRating === 'B' ? styles.green : styles.red]}>
                                {item.ecoRating}
                              </Text>
                              <Text style={styles.itemPrice}>${item.price?.toFixed(2)}</Text>
                            </View>
                          </View>
                          {item.swapSuggestion && (
                            <Text style={styles.swapText}>🌱 Smart Swap: {item.swapSuggestion}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </View>
      </ScrollView>

      {/* Points History Modal */}
      <Modal visible={pointsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eco-Points History</Text>
            <Text style={styles.modalSubtitle}>See how your sustainable choices have paid off over time!</Text>
            
            <LineChart
              data={pointsHistoryChart}
              width={screenWidth - 60}
              height={220}
              yAxisLabel=""
              yAxisSuffix="pt"
              chartConfig={{
                backgroundColor: "#F0FFF4",
                backgroundGradientFrom: "#F0FFF4",
                backgroundGradientTo: "#C6F6D5",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(56, 161, 105, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(39, 103, 73, ${opacity})`,
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: "#276749"
                }
              }}
              bezier
              style={{ marginVertical: 20, borderRadius: 16 }}
            />
            
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setPointsModalVisible(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  container: { flexGrow: 1, backgroundColor: 'rgba(247, 249, 252, 0.85)', padding: 20, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  halfCard: { width: '48%' },
  card: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 15, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#2D3748', marginBottom: 10 },
  scoreText: { fontSize: 48, fontWeight: 'bold', color: '#38A169' },
  budgetAmount: { fontSize: 24, fontWeight: 'bold', color: '#E53E3E' },
  subtitle: { fontSize: 14, color: '#A0AEC0', marginTop: 5 },
  
  historyItem: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 15 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748' },
  aadeBadge: { backgroundColor: '#EBF8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: '#90CDF4' },
  aadeText: { color: '#2B6CB0', fontSize: 10, fontWeight: 'bold' },
  historyTotal: { fontSize: 16, fontWeight: 'bold', color: '#E53E3E' },
  dateText: { fontSize: 12, color: '#A0AEC0', marginBottom: 10 },
  
  itemsContainer: { backgroundColor: '#F7F9FC', borderRadius: 8, padding: 10 },
  categorySection: { marginBottom: 12 },
  categoryHeader: { fontSize: 12, fontWeight: 'bold', color: '#718096', textTransform: 'uppercase', marginBottom: 5, letterSpacing: 1 },
  
  lineItemContainer: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 5 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 13, color: '#4A5568', flex: 1, paddingRight: 10 },
  swapText: { fontSize: 12, color: '#38A169', fontStyle: 'italic', marginTop: 4 },
  itemRight: { flexDirection: 'row', alignItems: 'center', width: 70, justifyContent: 'space-between' },
  itemEco: { fontSize: 12, fontWeight: 'bold', width: 20, textAlign: 'center' },
  green: { color: '#38A169' },
  red: { color: '#E53E3E' },
  itemPrice: { fontSize: 13, color: '#2D3748', fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#276749', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#4A5568', textAlign: 'center', marginBottom: 10 },
  closeModalBtn: { backgroundColor: '#38A169', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginTop: 10 },
  closeModalText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
