import React from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, Button } from '../../components/ui';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<'login' | 'signup'>('login');

  const handleAuth = async () => {
    if (!email.includes('@') || password.length < 6) {
      Alert.alert('Erreur', 'Email invalide ou mot de passe trop court (6 caractères min)');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Inscription réussie !', 'Vérifie ton email pour confirmer ton compte.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/(main)');
      }
    } catch (error) {
      Alert.alert('Erreur', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.includes('@')) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      Alert.alert('Lien envoyé !', 'Vérifie ta boîte mail pour te connecter.');
    } catch (error) {
      Alert.alert('Erreur', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text variant="hero" style={styles.title}>Elio</Text>
        <Text variant="body" color={Colors.textLight} style={styles.subtitle}>
          Ton assistant vocal intelligent
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="ton@email.com"
            placeholderTextColor={Colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={Colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            title={loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
            onPress={handleAuth}
            disabled={!email.includes('@') || password.length < 6 || loading}
          />
          <Button
            title="Lien magique ✨"
            onPress={handleMagicLink}
            variant="outline"
            disabled={!email.includes('@') || loading}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text variant="caption" style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title={mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          onPress={() => setMode(m => m === 'login' ? 'signup' : 'login')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  title: { textAlign: 'center', color: Colors.primary },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  form: { gap: 12 },
  input: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: Colors.border, color: Colors.text },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 16 },
});
