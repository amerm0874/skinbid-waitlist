import { useEffect } from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

/** A Pressable that springs down slightly on press — the same tactile feel as
 * iOS system controls, instead of just an opacity swap. */
export function Tap({
  children,
  onPress,
  style,
  haptic = true,
  disabled,
  ...rest
}: PressableProps & { style?: ViewStyle | ViewStyle[]; haptic?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.96, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        onPress={(event) => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.(event);
        }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Staggered entrance for list rows — each item settles in slightly after the
 * previous one instead of the whole list popping in at once. */
export function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
}

/** Shake a form field / error line when validation fails — a small nudge
 * instead of text just silently appearing. Call `shake()` after setting the
 * error state. */
export function useShake() {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    x.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 90 }),
      withTiming(-6, { duration: 90 }),
      withTiming(0, { duration: 60 }),
    );
  };
  return { style, shake };
}

/** A toggle switch with a sliding knob and a color-crossfade track — the
 * standard system-switch feel, built once here so every on/off control in
 * the app (offers, zone status, settings) looks and moves the same way.
 *
 * Presentational only — no Pressable of its own. Wrap it in `Tap` (see
 * ToggleRow in app/new.tsx for the pattern) so there's exactly one tap
 * target; giving the switch its own handler too would double-fire. */
export function Switch({ value }: { value: boolean }) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [Colors.backgroundSelected, Colors.accent]),
  }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 18 }] }));

  return (
    <Animated.View style={[{ width: 44, height: 26, borderRadius: 13, padding: 2 }, trackStyle]}>
      <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.background }, knobStyle]} />
    </Animated.View>
  );
}

/** A small animated checkmark for confirmation moments (proof submitted,
 * event created, settings saved) — the "peak" of the flow deserves more than
 * a static line of text. */
export function SuccessCheck({ size = 64 }: { size?: number }) {
  const scale = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0.5);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(withTiming(1.15, { duration: 260, easing: Easing.out(Easing.back(2)) }), withTiming(1, { duration: 120 }));
    ringScale.value = withTiming(1.6, { duration: 500, easing: Easing.out(Easing.cubic) });
    ringOpacity.value = withTiming(0, { duration: 500 });
  }, []);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }));

  return (
    <Animated.View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: Colors.accent },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: Colors.accent,
            alignItems: "center",
            justifyContent: "center",
          },
          circleStyle,
        ]}
      >
        <Animated.Text style={{ fontSize: size * 0.45, fontWeight: "800", color: Colors.accentInk }}>✓</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}
