import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

const QUOTES = [
  "Let's push harder together.",
  "Endure harder today.",
  "Discipline equals freedom.",
  "Your only limit is you.",
  "Sweat is just fat crying.",
  "Pain is temporary. Quitting lasts forever.",
  "Rome wasn't built in a day, but they worked on it every single day.",
  "Don't stop when you're tired. Stop when you're done."
];

export default function LoadingScreen() {
  const { colors, accentColor } = useTheme();
  const [quote, setQuote] = useState('');

  useEffect(() => {
    // Pick a random quote on mount
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setQuote(randomQuote);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image 
          source={require('@/assets/images/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.quoteText, { color: colors.text }]}>{quote}</Text>
      </View>
      <ActivityIndicator size="large" color={accentColor} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 40,
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 32,
    opacity: 0.9,
  },
  loader: {
    marginBottom: 60,
  }
});
