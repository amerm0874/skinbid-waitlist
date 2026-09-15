import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Link, router } from "expo-router";
import { Screen, Button, TextField } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { Tap, useShake } from "@/components/animated";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/oauth";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Role } from "@/lib/config";

const PASSWORD_MIN = 6;

export default function SignupScreen() {
  const [role, setRole] = useState<Role>("athlete");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { style: shakeStyle, shake } = useShake();

  async function onSubmit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < PASSWORD_MIN) {
      setError(`Enter your email and a password of at least ${PASSWORD_MIN} characters.`);
      shake();
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      shake();
      return;
    }
    if (!data.session) {
      setNotice("Check your email to confirm, then log in.");
      return;
    }
    router.replace({ pathname: "/onboarding", params: { role } });
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace({ pathname: "/onboarding", params: { role } });
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
        <ThemedText type="display">Get in the game</ThemedText>
        <ThemedText type="small" color="textSecondary">
          Athlete or brand? Pick one — you can't switch later.
        </ThemedText>
      </Animated.View>

      <View style={{ flexDirection: "row", gap: Spacing.two }}>
        {(["athlete", "brand"] as const).map((option) => (
          <Tap
            key={option}
            onPress={() => setRole(option)}
            style={{
              flex: 1,
              height: 50,
              borderRadius: Radius.pill,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: role === option ? Colors.accent : Colors.border,
              backgroundColor: role === option ? Colors.accent : "transparent",
            }}
          >
            <ThemedText type="smallBold" color={role === option ? "accentInk" : "text"}>
              {option === "athlete" ? "I'm an athlete" : "I'm a brand"}
            </ThemedText>
          </Tap>
        ))}
      </View>

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
          autoComplete="password-new"
          placeholder="At least 6 characters"
        />
        {error ? (
          <ThemedText type="small" color="danger">
            {error}
          </ThemedText>
        ) : null}
        {notice ? (
          <ThemedText type="small" color="success">
            {notice}
          </ThemedText>
        ) : null}
        <Button title="Create account" onPress={onSubmit} loading={loading} />
        <Button title="Continue with Google" variant="outline" onPress={onGoogle} loading={googleLoading} />
      </Animated.View>

      <Link href="/(auth)/login" style={{ alignSelf: "center" }}>
        <ThemedText type="link">Already in? Log in</ThemedText>
      </Link>
    </Screen>
  );
}
