import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

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
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const quoteFadeAnim = useRef(new Animated.Value(0)).current;
  const quoteSlideAnim = useRef(new Animated.Value(20)).current;
  const glowFadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pick a random quote
    const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setQuote(randomQuote);

    // Fade and slide the quote and glow in gently AFTER the OS splash screen hides
    Animated.parallel([
      Animated.timing(quoteFadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200, // Small delay for seamless handoff
        useNativeDriver: true,
      }),
      Animated.timing(quoteSlideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(glowFadeAnim, {
        toValue: 0.15,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 4000, // Matching the new extended artificial delay
        useNativeDriver: false,
      })
    ]).start();

    // Infinite pulsing logo glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: '#121212' }]}>
      {/* Background Gradient fades in over the flat black splash background */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: quoteFadeAnim }]}>
        <LinearGradient
          colors={[colors.background, colors.card || colors.background, colors.background]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.centerWrapper}>
        {/* The logo is absolutely centered and DOES NOT fade in, providing a seamless transition from the OS splash screen */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Animated.View style={[styles.logoGlow, { backgroundColor: accentColor, opacity: glowFadeAnim }]} />
        </Animated.View>
        
        {/* The quote is positioned below the logo */}
        <Animated.View style={[styles.quoteWrapper, {
          opacity: quoteFadeAnim,
          transform: [{ translateY: quoteSlideAnim }]
        }]}>
          <Text style={[styles.quoteText, { color: colors.text }]}>{quote}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: quoteFadeAnim }]}>
        <View style={[styles.progressBarContainer, { backgroundColor: colors.border || '#333' }]}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { 
                backgroundColor: accentColor,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]} 
          />
        </View>
        <Text style={[styles.loadingText, { color: colors.text, opacity: 0.5 }]}>Preparing your session...</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centerWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,   // Matched with app.json imageWidth exactly
    height: 200,
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    zIndex: 1,
  },
  quoteWrapper: {
    position: 'absolute',
    width: '100%',
    top: '50%',
    marginTop: 120, // Places the quote perfectly below the 200px centered logo
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    padding: 30,
    marginBottom: 20,
    zIndex: 2,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 15,
  },
  progressBar: {
    height: '100%',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
