import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, ImageBackground } from 'react-native';
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function BudgetScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState(0);
  const [spent, setSpent] = useState(0);
  const [newBudget, setNewBudget] = useState('');
  const [receipts, setReceipts] = useState<any[]>([]);
  
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [categorySpent, setCategorySpent] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryBudget, setNewCategoryBudget] = useState('');

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setBudget(userSnap.data().monthlyBudget || 500);
        setSpent(userSnap.data().totalSpentThisMonth || 0);
        setCategoryBudgets(userSnap.data().categoryBudgets || {});
      }

      // Fetch recent receipts for the activity feed
      const q = query(
        collection(db, 'users', user.uid, 'receipts'),
        orderBy('date', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const fetchedReceipts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReceipts(fetchedReceipts.slice(0, 5)); // Keep only 5 for activity feed
      
      // Calculate category spending from the fetched receipts (representing this month ideally)
      let catSpent: Record<string, number> = {};
      for (const receiptDoc of querySnapshot.docs) {
        const itemsRef = collection(receiptDoc.ref, 'scanned_items');
        const itemsSnap = await getDocs(itemsRef);
        itemsSnap.forEach(itemDoc => {
          const data = itemDoc.data();
          const cat = data.category || 'Other';
          const price = data.price || 0;
          catSpent[cat] = (catSpent[cat] || 0) + price;
        });
      }
      setCategorySpent(catSpent);

    } catch (error) {
      console.error("Error fetching budget data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBudget = async () => {
    if (!user || !newBudget) return;
    const parsedBudget = parseFloat(newBudget);
    if (isNaN(parsedBudget)) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { monthlyBudget: parsedBudget });
      setBudget(parsedBudget);
      setNewBudget('');
    } catch (error) {
      console.error("Error updating budget:", error);
    }
  };

  const handleUpdateCategoryBudget = async () => {
    if (!user || !selectedCategory || !newCategoryBudget) return;
    const parsedBudget = parseFloat(newCategoryBudget);
    if (isNaN(parsedBudget)) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedCatBudgets = { ...categoryBudgets, [selectedCategory]: parsedBudget };
      await updateDoc(userRef, { categoryBudgets: updatedCatBudgets });
      setCategoryBudgets(updatedCatBudgets);
      setNewCategoryBudget('');
      setSelectedCategory(null);
    } catch (error) {
      console.error("Error updating category budget:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38A169" />
      </View>
    );
  }

  const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const progressColor = progress > 0.9 ? '#E53E3E' : progress > 0.7 ? '#DD6B20' : '#38A169';

  return (
    <ImageBackground source={require('../../assets/mainback.jpg')} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Budget Limit</Text>
          <Text style={styles.budgetAmount}>${budget.toFixed(2)}</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="New Limit (e.g. 600)"
              keyboardType="numeric"
              value={newBudget}
              onChangeText={setNewBudget}
            />
            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdateBudget}>
              <Text style={styles.updateBtnText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Spending Progress</Text>
          <Text style={styles.spentText}>€{spent.toFixed(2)} spent</Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
          </View>
          
          {progress > 0.9 && (
            <Text style={styles.alertText}>⚠️ You are nearing your monthly limit!</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Budgets</Text>
          {(() => {
            const defaultCats = ['Τρόφιμα', 'Ένδυση', 'Μεταφορές', 'Διασκέδαση', 'Λογαριασμοί', 'Άλλο'];
            const allCats = Array.from(new Set([...defaultCats, ...Object.keys(categorySpent), ...Object.keys(categoryBudgets)]));
            
            return allCats.map((cat) => {
            const catSpentAmount = categorySpent[cat] || 0;
            const catBudgetAmount = categoryBudgets[cat] || 0; // 0 means no limit set yet
            
            let catProgress = 0;
            let catProgressColor = '#38A169';
            if (catBudgetAmount > 0) {
              catProgress = Math.min(catSpentAmount / catBudgetAmount, 1);
              catProgressColor = catProgress > 0.9 ? '#E53E3E' : catProgress > 0.7 ? '#DD6B20' : '#38A169';
            }

            return (
              <View key={cat} style={styles.catItem}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>{cat}</Text>
                  <Text style={styles.catAmount}>
                    €{catSpentAmount.toFixed(2)} {catBudgetAmount > 0 ? `/ €${catBudgetAmount.toFixed(2)}` : ''}
                  </Text>
                </View>

                {catBudgetAmount > 0 ? (
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${catProgress * 100}%`, backgroundColor: catProgressColor }]} />
                  </View>
                ) : (
                  <Text style={styles.noBudgetLabel}>No limit set.</Text>
                )}

                {selectedCategory === cat ? (
                  <View style={styles.catInputRow}>
                    <TextInput
                      style={styles.catInput}
                      placeholder={`Budget for ${cat}`}
                      keyboardType="numeric"
                      value={newCategoryBudget}
                      onChangeText={setNewCategoryBudget}
                    />
                    <TouchableOpacity style={styles.catUpdateBtn} onPress={handleUpdateCategoryBudget}>
                      <Text style={styles.updateBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.catCancelBtn} onPress={() => setSelectedCategory(null)}>
                      <Text style={styles.updateBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setSelectedCategory(cat)}>
                    <Text style={styles.setLimitText}>{catBudgetAmount > 0 ? 'Edit Limit' : 'Set Limit'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })})()}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity & Smart Swaps</Text>
          {receipts.length === 0 ? (
            <Text style={styles.subtitle}>No receipts scanned yet.</Text>
          ) : (
            receipts.map((receipt) => (
              <View key={receipt.id} style={styles.receiptItem}>
                <View style={styles.receiptHeader}>
                  <Text style={styles.storeName}>{receipt.storeName}</Text>
                  <Text style={styles.receiptAmount}>€{receipt.totalAmount?.toFixed(2)}</Text>
                </View>
                <Text style={styles.ecoScore}>Eco-Score: {receipt.ecoScore}</Text>
                
                {/* Mock Smart Swap for the Hackathon Demo */}
                <View style={styles.swapBox}>
                  <Text style={styles.swapTitle}>🌱 Smart Swap Suggestion:</Text>
                  <Text style={styles.swapText}>We noticed plastic items in this scan. Swap plastic straws for paper to boost your Eco-Score to an A!</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  container: {
    flexGrow: 1,
    backgroundColor: 'rgba(247, 249, 252, 0.85)',
    padding: 20,
    alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 10,
  },
  budgetAmount: { fontSize: 32, fontWeight: 'bold', color: '#2D3748', marginBottom: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  updateBtn: {
    backgroundColor: '#38A169',
    height: 45,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  updateBtnText: { color: '#fff', fontWeight: 'bold' },
  spentText: { fontSize: 16, color: '#4A5568', marginBottom: 10 },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 6 },
  alertText: { color: '#E53E3E', fontWeight: 'bold', marginTop: 10, fontSize: 14 },
  subtitle: { color: '#718096', fontStyle: 'italic' },
  receiptItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    paddingVertical: 15,
  },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  storeName: { fontSize: 16, fontWeight: '600', color: '#2D3748' },
  receiptAmount: { fontSize: 16, fontWeight: 'bold', color: '#E53E3E' },
  ecoScore: { fontSize: 14, color: '#38A169', fontWeight: '600', marginBottom: 10 },
  swapBox: {
    backgroundColor: '#F0FFF4',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#38A169',
  },
  swapTitle: { fontSize: 13, fontWeight: 'bold', color: '#276749', marginBottom: 3 },
  swapText: { fontSize: 13, color: '#2F855A' },
  
  catItem: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 15 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { fontSize: 16, fontWeight: '600', color: '#2D3748' },
  catAmount: { fontSize: 16, fontWeight: 'bold', color: '#4A5568' },
  noBudgetLabel: { fontSize: 12, color: '#A0AEC0', fontStyle: 'italic', marginTop: 5 },
  setLimitText: { color: '#3182CE', fontSize: 13, fontWeight: '600', marginTop: 8 },
  
  catInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  catInput: { flex: 1, height: 35, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 10, marginRight: 8, fontSize: 13 },
  catUpdateBtn: { backgroundColor: '#38A169', height: 35, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
  catCancelBtn: { backgroundColor: '#A0AEC0', height: 35, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6 }
});
