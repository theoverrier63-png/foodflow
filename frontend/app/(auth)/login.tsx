import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { useAuth } from "@/src/auth-context";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHdob2xlc2FsZSUyMHZlZ2V0YWJsZXMlMjBjcmF0ZXxlbnwwfHx8fDE3ODg1NDgxNzN8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  async function submit() {
    if (!email.trim() || !password) {
      toast.show("Renseignez email et mot de passe", "error");
      return;
    }
    try {
      setBusy(true);
      await signIn(email.trim(), password);
      router.replace("/(app)");
    } catch (e: any) {
      toast.show(e?.message || "Connexion impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["rgba(17,24,39,0.2)", "rgba(17,24,39,0.85)"]}
            style={styles.heroScrim}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + 24 }]}>
            <View style={styles.brandTag}>
              <Feather name="shopping-bag" size={14} color={colors.onBrand} />
              <Text style={styles.brandTagTxt}>LERAY-POINTEL</Text>
            </View>
            <Text style={styles.heroTitle}>Bienvenue</Text>
            <Text style={styles.heroSub}>
              Votre fournisseur de fruits & légumes frais.
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte entreprise</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email professionnel</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="contact@entreprise.fr"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          <Pressable
            testID="login-submit-button"
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [
              styles.cta,
              (pressed || busy) && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaTxt}>Se connecter</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerTxt}>Pas encore de compte ?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="go-to-register-button">
                <Text style={styles.footerLink}>Créer un compte</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 260, width: "100%", position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroScrim: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const) },
  heroContent: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
  },
  brandTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  brandTagTxt: { color: colors.onBrand, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  heroTitle: { color: colors.onSurfaceInverse, fontSize: 32, fontWeight: "800" },
  heroSub: { color: colors.onSurfaceInverse, fontSize: 15, marginTop: 4, opacity: 0.9 },
  form: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  footerTxt: { color: colors.muted, fontSize: 14 },
  footerLink: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
}));
