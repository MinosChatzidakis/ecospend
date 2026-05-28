import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView, ImageBackground, TouchableOpacity, Modal, Switch, Linking, Alert } from 'react-native';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, increment } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const screenWidth = Dimensions.get("window").width;

export default function DashboardScreen({ navigation }: any) {
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
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  const toggleReceipt = (id: string) => {
    setExpandedReceipts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRedeem = async () => {
    if (!user || (userData?.ecoPoints || 0) < 500) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ecoPoints: increment(-500)
      });
      setUserData((prev: any) => ({...prev, ecoPoints: prev.ecoPoints - 500}));
      Alert.alert("🎉 Reward Redeemed!", "You have successfully redeemed 500 points for a €5 discount coupon!");
      setPointsModalVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not redeem points.");
    }
  };

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

          const pointsByMonth: Record<string, number> = {};
          const spendingByMonth: Record<string, number> = {};
          
          for (const r of loadedHistory) {
            if (r.date && r.date.toDate) {
              const d = r.date.toDate();
              const month = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
              pointsByMonth[month] = (pointsByMonth[month] || 0) + (r.pointsEarned || 0);
              spendingByMonth[month] = (spendingByMonth[month] || 0) + (r.totalAmount || 0);
            }
          }

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
            // Use freshly fetched data, not stale state
            const snap = userSnap?.exists() ? userSnap.data() : null;
            setPointsHistoryChart({ labels: ['This Month'], datasets: [{ data: [snap?.ecoPoints || 0] }] });
            setSpendingHistoryChart({ labels: ['This Month'], datasets: [{ data: [snap?.totalSpentThisMonth || 0] }] });
          }

          const colors = ['#F56565', '#48BB78', '#4299E1', '#ECC94B', '#9F7AEA'];
          let colorIdx = 0;
          
          const formattedData = Object.keys(categoryTotals).map(key => ({
            name: `${key} (€${categoryTotals[key].toFixed(2)})`,
            total: Number(categoryTotals[key].toFixed(2)),
            color: colors[colorIdx++ % colors.length],
            legendFontColor: '#718096',
            legendFontSize: 13
          }));

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

  // Calculate dynamic projected budget
  const currentDay = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const spent = userData?.totalSpentThisMonth || 0;
  const monthlyBudget = userData?.monthlyBudget || 500;
  const projectedTotal = (spent / currentDay) * daysInMonth;
  const overBudget = projectedTotal - monthlyBudget;
  
  let predictiveMessage = '✅ Δεν έχεις καταχωρήσει έξοδα ακόμα. Μείνε εντός budget!';
  if (spent > 0) {
    if (overBudget > 0) {
      predictiveMessage = `⚠️ Με τον ρυθμό που ψωνίζεις, μέχρι το τέλος του μήνα θα έχεις βγει εκτός budget κατά €${overBudget.toFixed(0)}`;
    } else {
      predictiveMessage = '✅ Με τον ρυθμό που ψωνίζεις, αναμένεται να παραμείνεις εντός budget!';
    }
  }

  return (
    <ImageBackground source={require('../../assets/mainback.jpg')} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {userData?.isHostMode ? (
          <View style={{ width: '100%' }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Λειτουργικά Κόστη Καταλύματος</Text>
              <Text style={styles.budgetAmount}>$120.50</Text>
              <Text style={styles.subtitle}>Supermarket supplies for Airbnb (Cleaning, Snacks)</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Deductible Expenses Breakdown</Text>
              <PieChart
                data={[
                  { name: 'Cleaning', total: 45, color: '#F56565', legendFontColor: '#718096', legendFontSize: 13 },
                  { name: 'Welcome Snacks', total: 55.50, color: '#48BB78', legendFontColor: '#718096', legendFontSize: 13 },
                  { name: 'Toiletries', total: 20, color: '#4299E1', legendFontColor: '#718096', legendFontSize: 13 },
                ]}
                width={screenWidth - 80}
                height={200}
                chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                accessor={"total"}
                backgroundColor={"transparent"}
                paddingLeft={"10"}
                absolute
              />
            </View>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
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
                { (userData?.ecoPoints || 0) >= 500 ? (
                  <Text style={{fontSize: 11, color: '#D69E2E', marginTop: 5, textAlign: 'center', fontWeight: 'bold'}}>
                    🎁 Reward Available!
                  </Text>
                ) : (
                  <Text style={{fontSize: 10, color: '#A0AEC0', marginTop: 5, textAlign: 'center'}}>
                    {500 - (userData?.ecoPoints || 0)} pts to next reward!
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.impactCard}>
              <View style={styles.impactHeaderRow}>
                <Text style={styles.impactIcon}>🚗⚡</Text>
                <Text style={styles.impactTitle}>Eco-Impact Translated</Text>
              </View>
              <Text style={styles.impactText}>
                {(userData?.ecoPoints || 0) > 0 
                  ? '"Κάνοντας οικολογικές επιλογές αυτόν τον μήνα, γλίτωσες εκπομπές CO2 που ισοδυναμούν με ένα ταξίδι με ηλεκτρικό όχημα από την Αθήνα μέχρι την Πάτρα!"'
                  : 'Αυτή τη στιγμή οι αγορές σου δεν προσφέρουν αρκετά Eco-Points. Προσπάθησε να επιλέγεις προϊόντα με σήμανση A ή B! 🌱'}
              </Text>
            </View>

            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Budget')}>
              <Text style={styles.cardTitle}>Monthly Budget ℹ️</Text>
              <Text style={styles.budgetAmount}>
                €{spent.toFixed(2)} / €{monthlyBudget.toFixed(2)}
              </Text>
              <Text style={styles.subtitle}>Tap to set category budgets</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending by Category</Text>
              <PieChart
                data={chartData}
                width={screenWidth - 80}
                height={160}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor={"total"}
                backgroundColor={"transparent"}
                paddingLeft={(screenWidth / 4 - 40).toString()}
                absolute
                hasLegend={false}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 15 }}>
                {chartData.map((item: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginVertical: 4 }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color, marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#4A5568', fontWeight: '500' }}>{item.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending Over Time</Text>
              <Text style={styles.subtitle}>Total expenses per month</Text>
              <BarChart
                data={spendingHistoryChart}
                width={screenWidth - 80}
                height={220}
                yAxisLabel="€"
                yAxisSuffix=""
                fromZero
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(56, 161, 105, ${opacity})`,
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

            const receiptId = receipt.id || String(index);
            const isExpanded = !!expandedReceipts[receiptId];

            return (
              <View key={receiptId} style={styles.historyItem}>
                <TouchableOpacity onPress={() => toggleReceipt(receiptId)} style={styles.historyHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.storeName}>{receipt.storeName}</Text>
                    <TouchableOpacity 
                      style={[styles.aadeBadge, !receipt.aadeUrl && { borderColor: '#FC8181', backgroundColor: '#FFF5F5' }]}
                      onPress={() => {
                        if (receipt.aadeUrl) {
                          Linking.openURL(receipt.aadeUrl);
                        } else {
                          Alert.alert("Fake Receipt", "No AADE QR code was found during scan.");
                        }
                      }}
                    >
                      <Text style={[styles.aadeText, !receipt.aadeUrl && { color: '#E53E3E' }]}>
                        {receipt.aadeUrl ? '✓ AADE Validated' : '❌ Fake (No QR)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.historyTotal}>€{receipt.totalAmount?.toFixed(2)}</Text>
                </TouchableOpacity>
                <Text style={styles.dateText}>
                  {receipt.date?.toDate ? receipt.date.toDate().toLocaleDateString() : 'Just now'}
                </Text>
                <TouchableOpacity onPress={() => toggleReceipt(receiptId)}>
                  <Text style={{textAlign: 'center', color: '#A0AEC0', fontSize: 11, marginTop: 2}}>{isExpanded ? '▲ Hide items' : '▼ Show items'}</Text>
                </TouchableOpacity>
                
                {isExpanded && (
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
                              <Text style={styles.itemPrice}>€{item.price?.toFixed(2)}</Text>
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
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Προβλεπτική Ανάλυση Εξόδων</Text>
        <Text style={styles.subtitle}>Future Spending Trajectory</Text>
        {spent > 0 ? (
          <LineChart
            data={{
              labels: [`Day 1`, `Day ${currentDay}`, `Day ${daysInMonth}`],
              datasets: [
                { data: [0, spent, projectedTotal], color: (o = 1) => `rgba(229, 62, 62, ${o})` },
                { data: [0, monthlyBudget * (currentDay / daysInMonth), monthlyBudget], color: (o = 1) => `rgba(56, 161, 105, ${o})`, withDots: false }
              ],
              legend: ['Projected', 'Budget']
            }}
            width={screenWidth - 70}
            height={200}
            yAxisLabel="€"
            yAxisSuffix=""
            fromZero
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              propsForDots: { r: "4" },
              propsForLabels: { fontSize: 10 }
            }}
            bezier
            style={{ marginVertical: 15, borderRadius: 10 }}
          />
        ) : (
          <Text style={[styles.subtitle, {marginVertical: 20, textAlign: 'center'}]}>Σκάναρε μια απόδειξη για να δεις την πρόβλεψη!</Text>
        )}
        <View style={styles.predictAlertBox}>
          <Text style={styles.predictAlertText}>
            {predictiveMessage}
          </Text>
        </View>
      </View>
      
      </View>
      )}
      </ScrollView>

      {/* Points History Modal */}
      <Modal visible={pointsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eco-Points Analytics</Text>
            <Text style={styles.modalSubtitle}>Πώς κερδίζεις πόντους:</Text>
            
            <View style={{width: '100%', marginVertical: 10}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0'}}>
                <Text style={{fontWeight: 'bold', color: '#276749'}}>Eco-Rating A</Text>
                <Text style={{color: '#38A169', fontWeight: 'bold'}}>+50 pts / item</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0'}}>
                <Text style={{fontWeight: 'bold', color: '#276749'}}>Eco-Rating B</Text>
                <Text style={{color: '#48BB78', fontWeight: 'bold'}}>+20 pts / item</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0'}}>
                <Text style={{fontWeight: 'bold', color: '#718096'}}>Eco-Rating C / D</Text>
                <Text style={{color: '#A0AEC0'}}>0 pts</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8}}>
                <Text style={{fontWeight: 'bold', color: '#276749'}}>Τρέχοντες πόντοι</Text>
                <Text style={{color: '#38A169', fontWeight: 'bold', fontSize: 18}}>{userData?.ecoPoints || 0}</Text>
              </View>
            </View>

            <Text style={[styles.modalSubtitle, {marginTop: 10}]}>Πόντοι ανά μήνα</Text>
            <BarChart
              data={pointsHistoryChart}
              width={screenWidth - 80}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              chartConfig={{
                backgroundColor: "#F0FFF4",
                backgroundGradientFrom: "#F0FFF4",
                backgroundGradientTo: "#C6F6D5",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(56, 161, 105, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(39, 103, 73, ${opacity})`,
              }}
              style={{ marginVertical: 10, borderRadius: 12 }}
            />
            
            { (userData?.ecoPoints || 0) >= 500 && (
              <TouchableOpacity style={[styles.closeModalBtn, {backgroundColor: '#D69E2E', marginBottom: 10, width: '100%'}]} onPress={handleRedeem}>
                <Text style={styles.closeModalText}>🎁 Redeem 500 pts for €5</Text>
              </TouchableOpacity>
            )}
            
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
  closeModalText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  impactCard: { backgroundColor: '#F0FFF4', width: '100%', borderRadius: 15, padding: 20, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: '#38A169', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  impactHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  impactIcon: { fontSize: 24, marginRight: 10 },
  impactTitle: { fontSize: 16, fontWeight: 'bold', color: '#276749' },
  impactText: { fontSize: 14, color: '#2F855A', fontStyle: 'italic', lineHeight: 22 },

  predictAlertBox: { backgroundColor: '#FFFAF0', padding: 15, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#DD6B20', marginTop: 5 },
  predictAlertText: { fontSize: 13, fontWeight: 'bold', color: '#C05621', lineHeight: 20 }
});
