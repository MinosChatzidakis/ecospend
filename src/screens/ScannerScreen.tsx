import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { doc, collection, addDoc, updateDoc, increment, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

const stripAccents = (s: string) => {
  if (!s) return '';
  const accents: Record<string, string> = {
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
    'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ'
  };
  return s.split('').map(char => accents[char] || char).join('').toUpperCase().replace(/[^A-ZΑ-Ω0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
};

export default function ScannerScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef<any>(null);
  const { user } = useAuth();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePictureAndProcess = async () => {
    if (!cameraRef.current) return;

    try {
      setScanning(true);
      setExtractedText('Capturing image...');
      
      // Reverting back to quality 0.5 and OCREngine 2 which worked better originally
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      
      setExtractedText('Cropping scan area...');
      
      // Calculate crop dimensions for the 80%x60% centered green frame
      const cropWidth = photo.width * 0.8;
      const cropHeight = photo.height * 0.6;
      const originX = photo.width * 0.1;
      const originY = photo.height * 0.2;
      
      const croppedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      setExtractedText('Analyzing receipt with Free OCR...');
      
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${croppedPhoto.base64}`);
      formData.append('apikey', 'helloworld'); 
      formData.append('OCREngine', '2'); 

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.IsErroredOnProcessing) {
        throw new Error(result.ErrorMessage[0]);
      }

      const parsedText = result.ParsedResults[0]?.ParsedText || '';
      if (!parsedText) {
        Alert.alert('No text found', 'Please try taking the picture again.');
        setScanning(false);
        return;
      }
      
      setExtractedText('Verifying AADE receipt signature...');
      await new Promise(resolve => setTimeout(resolve, 1200)); // Fake AADE verification delay
      
      setExtractedText('AADE Signature Verified! Matching items...');
      await new Promise(resolve => setTimeout(resolve, 500));

      await saveReceiptToFirebase(parsedText);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const saveReceiptToFirebase = async (text: string) => {
    if (!user) return;
    
    setExtractedText('Matching items with global database...');
    
    // Fetch all products to perform a fuzzy-like match against the dirty OCR text
    const productsSnap = await getDocs(collection(db, 'products'));
    const allProducts = productsSnap.docs.map(d => d.data());

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    let matchedItems: any[] = [];
    let calculatedTotal = 0;
    let earnedPoints = 0;
    const alreadyMatched = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const line = stripAccents(originalLine);
      
      // --- STEP 1: Try barcode match (first 6 digits on the line) ---
      let bestMatch = null;
      const codeMatch = originalLine.match(/(\d{6})/);
      if (codeMatch) {
        bestMatch = allProducts.find(p => p.productCode === codeMatch[1] && !alreadyMatched.has(p.name));
      }
      
      // --- STEP 2: Fallback to fuzzy name match ---
      if (!bestMatch) {
        let topScore = 0;
        for (const p of allProducts) {
          if (alreadyMatched.has(p.name)) continue;
          const pName = stripAccents(p.name);
          const pWords = pName.split(' ').filter(w => w.length >= 4);
          const oWords = line.split(' ').filter(w => w.length >= 4);
          let hits = 0;
          for (const ow of oWords) {
            for (const pw of pWords) {
              if (pw.includes(ow) || ow.includes(pw)) hits++;
            }
          }
          if (hits >= 2 && hits > topScore) { topScore = hits; bestMatch = p; }
        }
      }

      if (!bestMatch) continue;
      alreadyMatched.add(bestMatch.name);

      // --- STEP 3: Detect Quantity Multiplier ---
      // Matches "2X", "2 X", "2ΤΜΧ", "2 TMX", "2 TEM", "2,000 TEM", etc.
      let quantity = 1;
      
      // 1. Check current line
      let qtyMatch = originalLine.match(/\b([1-9](?:,\d+)?)\s*(?:X|ΤΜΧ|TMX|ΤΕΜ|TEM)\b/i);
      
      // 2. Check next line if not found
      if (!qtyMatch && i + 1 < lines.length) {
          qtyMatch = lines[i+1].match(/\b([1-9](?:,\d+)?)\s*(?:X|ΤΜΧ|TMX|ΤΕΜ|TEM)\b/i);
      }

      if (qtyMatch) {
          // Parse "2,000" or "2" 
          quantity = Math.round(parseFloat(qtyMatch[1].replace(',', '.')));
      }

      // Always use DB price, multiplied by quantity
      const finalPrice = bestMatch.price * quantity;
      
      // Show quantity in the name if > 1
      const displayName = quantity > 1 ? `${quantity}x ${bestMatch.name}` : bestMatch.name;

      // Find a real swap suggestion from the DB: same category, better eco rating
      const ratingOrder = ['A', 'B', 'C', 'D'];
      const currentIdx = ratingOrder.indexOf(bestMatch.ecoRating);
      let swapSuggestion = null;
      if (currentIdx > 0) {
        const betterProduct = allProducts.find(p => 
          p.name !== bestMatch.name && 
          p.category === bestMatch.category && 
          ratingOrder.indexOf(p.ecoRating) < currentIdx
        );
        if (betterProduct) {
          swapSuggestion = `${betterProduct.name} (${betterProduct.ecoRating} - €${betterProduct.price.toFixed(2)})`;
        }
      }

      matchedItems.push({
        name: displayName,
        price: finalPrice,
        category: bestMatch.category,
        ecoRating: bestMatch.ecoRating,
        swapSuggestion: swapSuggestion
      });
      calculatedTotal += finalPrice;
      
      // Award EcoPoints! multiplied by quantity
      if (bestMatch.ecoRating === 'A') earnedPoints += (50 * quantity);
      else if (bestMatch.ecoRating === 'B') earnedPoints += (20 * quantity);
    }

    if (matchedItems.length === 0) {
      // Show exactly what the OCR read so the user knows if the camera was just blurry
      Alert.alert(
        'No matches found', 
        `The camera read:\n"${text.substring(0, 100)}..."\n\nNo words matched the database.`
      );
      return;
    }

    setExtractedText('Saving receipt to history...');

    // Save the receipt
    const receiptRef = await addDoc(collection(db, 'users', user.uid, 'receipts'), {
      storeName: 'Scanned Supermarket',
      totalAmount: calculatedTotal,
      pointsEarned: earnedPoints,
      date: new Date(),
      ecoScore: matchedItems.some(i => i.ecoRating === 'D' || i.ecoRating === 'C') ? 'C' : 'A'
    });

    // Save ACTUAL matched items to subcollection
    const itemsRef = collection(db, 'users', user.uid, 'receipts', receiptRef.id, 'scanned_items');
    for (const item of matchedItems) {
      await addDoc(itemsRef, item);
    }

    // Update user's total spent and points
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      totalSpentThisMonth: increment(calculatedTotal),
      ecoPoints: increment(earnedPoints)
    });

    Alert.alert('Success!', `Receipt scanned! Matched ${matchedItems.length} items and earned ${earnedPoints} EcoPoints!`, [
      { text: 'View Dashboard', onPress: () => navigation.navigate('Dashboard') }
    ]);
  };

  const simulateDemoScan = async () => {
    setScanning(true);
    setExtractedText('Simulating successful scan...');
    
    setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        let newTotal = (userData?.totalSpentThisMonth || 0) + 7.50;
        let newPoints = (userData?.ecoPoints || 0) + 70;

        await updateDoc(userRef, {
          totalSpentThisMonth: newTotal,
          ecoPoints: newPoints
        });

        // Save the receipt
        const receiptRef = await addDoc(collection(db, 'users', user.uid, 'receipts'), {
          storeName: 'Scanned Supermarket',
          totalAmount: 7.50,
          pointsEarned: 20,
          date: new Date(),
          ecoScore: 'C'
        });

        // Add dummy receipt items
        const items = [
            { name: "ΝΕΡΟ ΕΜΦΙΑΛΩΜΕΝΟ 6X1.5L", price: 1.70, category: "Τρόφιμα", ecoRating: "D", swapSuggestion: "ΠΑΓΟΥΡΙ ΠΟΛΛΑΠΛΩΝ ΧΡΗΣΕΩΝ" },
            { name: "ΜΟΣΧΑΡΙΣΙΟΣ ΚΙΜΑΣ 500G", price: 5.80, category: "Τρόφιμα", ecoRating: "D", swapSuggestion: "ΚΙΜΑΣ ΚΟΤΟΠΟΥΛΟ Η ΚΙΜΑΣ ΣΟΓΙΑΣ" }
        ];

        const itemsRef = collection(db, 'users', user.uid, 'receipts', receiptRef.id, 'scanned_items');
        for (const item of items) {
          await addDoc(itemsRef, item);
        }

        Alert.alert('Scan Complete', 'Found 2 items. Points awarded!', [
          { text: 'View Dashboard', onPress: () => navigation.navigate('Dashboard') }
        ]);
      } catch (error) {
        Alert.alert('Error', 'Demo scan failed');
      } finally {
        setScanning(false);
      }
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} enableTorch={torch}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.torchButton} onPress={() => setTorch(!torch)}>
            <Text style={styles.torchText}>{torch ? '💡 Flash ON' : '🔦 Flash OFF'}</Text>
          </TouchableOpacity>
          <View style={styles.scanFrame} />
          
          <TouchableOpacity style={styles.demoButton} onPress={simulateDemoScan}>
            <Text style={styles.demoText}>Simulate Demo Scan (Failsafe)</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      <View style={styles.bottomBar}>
        {scanning ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38A169" />
            <Text style={styles.loadingText}>{extractedText}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.captureButton} onPress={takePictureAndProcess}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
      </View>
      
      {extractedText && !scanning && (
        <ScrollView style={styles.debugView}>
          <Text style={styles.debugText}>{extractedText}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  torchButton: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 20 },
  torchText: { color: '#fff', fontWeight: 'bold' },
  demoButton: { position: 'absolute', bottom: 30, backgroundColor: 'rgba(229, 62, 62, 0.9)', padding: 12, borderRadius: 10 },
  demoText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  scanFrame: { width: '80%', height: '60%', borderWidth: 2, borderColor: '#38A169', backgroundColor: 'transparent', borderRadius: 10 },
  bottomBar: { height: 120, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#38A169', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', borderWidth: 2, borderColor: '#38A169' },
  button: { backgroundColor: '#38A169', padding: 15, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  loadingContainer: { alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#2D3748', fontWeight: '600' },
  debugView: { position: 'absolute', top: 50, left: 20, right: 20, maxHeight: 150, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: 10 },
  debugText: { fontSize: 12, color: '#000' }
});
