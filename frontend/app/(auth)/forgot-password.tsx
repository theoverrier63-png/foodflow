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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.show("Email invalide", "error");
      return;
    }
    try {
      setBusy(true);
      await api.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Link href="/(auth)/login" asChild>
          <Pressable testID="back-to-login-button" hitSlop={16} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.onSurface} />
          </Pressable>
        </Link>
        <Text style={styles.headerTitle}>Mot de passe oublié</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {sent ? (
          <View style={styles.successCard} testID="forgot-sent">
            <View style={styles.successIcon}>
              <Feather name="mail" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.successTitle}>Email envoyé</Text>
            <Text style={styles.successTxt}>
              Si un compte est associé à cet email, vous allez recevoir un lien pour
              choisir un nouveau mot de passe. Le lien est valable 2 heures.
            </Text>
            <Pressable
              testID="back-login-btn"
              onPress={() => router.replace("/(auth)/login")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaTxt}>Retour à la connexion</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Renseignez l&apos;email de votre compte. Vous recevrez un email avec un
              lien pour choisir un nouveau mot de passe.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <Pressable
              testID="forgot-submit-btn"
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
                <Text style={styles.ctaTxt}>Envoyer la demande</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
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
  successCard: {
    alignItems: "center",
    gap: 10,
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.brandSecondary,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: { fontSize: 18, fontWeight: "800", color: colors.onBrandSecondary },
  successTxt: {
    fontSize: 14,
    color: colors.onBrandSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
}));
