import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Link, router } from "expo-router";
import { Screen, Button, TextField } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { useShake } from "@/components/animated";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/oauth";
import { Spacing } from "@/constants/theme";

// Ported from the web app's app/login/LoginForm.tsx: email/password primary,
// Google as a second option. Same PASSWORD_MIN as lib/auth-client.ts.
const PASSWORD_MIN = 6;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { style: shakeStyle, shake } = useShake();

  async function onSubmit() {
    setError(null);
    if (!email.trim() || password.length < PASSWORD_MIN) {
      setError(`Enter your email and a password of at least ${PASSWORD_MIN} characters.`);
      shake();
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      shake();
      return;
    }
    router.replace("/");
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in didn't go through.");
      shake();
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: Spacing.one }}>
        <ThemedText type="display">Welcome back</ThemedText>
        <ThemedText type="small" color="textSecondary">
          List a race, or bid on one. Floor's $100.
        </ThemedText>
      </Animated.View>

      <Animated.View style={[{ gap: Spacing.three }, shakeStyle]}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
        />
        {error ? (
          <ThemedText type="small" color="danger">
            {error}
          </ThemedText>
        ) : null}
        <Button title="Log in" onPress={onSubmit} loading={loading} />
        <Button title="Continue with Google" variant="outline" onPress={onGoogle} loading={googleLoading} />
      </Animated.View>

      <Link href="/(auth)/signup" style={{ alignSelf: "center" }}>
        <ThemedText type="link">New here? Create an account</ThemedText>
      </Link>
    </Screen>
  );
}
