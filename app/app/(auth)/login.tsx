import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Screen, Text, Button } from '../../components/ui';
import { Colors } from '../../constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = React.useState('');

  const handleMagicLink = () => {
    // TODO: EL-003 — Supabase magic link auth
    console.log('Magic link pour:', email);
  };

  const handleAppleSignIn = () => {
    // TODO: EL-003 — Apple Sign In
    console.log('Apple Sign In');
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
          <Button
            title="Recevoir le lien magique ✨"
            onPress={handleMagicLink}
            disabled={!email.includes('@')}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text variant="caption" style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title=" Continuer avec Apple"
          onPress={handleAppleSignIn}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
    color: Colors.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
  },
});
