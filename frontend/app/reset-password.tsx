import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import PasswordInput from "@/src/components/PasswordInput";

export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (params.token || "").toString();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!token) {
      toast.show("Lien invalide", "error");
      return;
    }
    if (password.length < 6) {
      toast.show("6 caractères minimum", "error");
      return;
    }
    if (password !== confirm) {
      toast.show("Les mots de passe ne correspondent pas", "error");
      return;
    }
    try {
      setBusy(true);
      await api.resetPassword(token, password);
      setDone(true);
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
        <Text style={styles.headerTitle}>Nouveau mot de passe</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <View style={styles.successCard} testID="reset-done">
            <View style={styles.successIcon}>
              <Feather name="check" size={22} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.successTitle}>Mot de passe mis à jour</Text>
            <Text style={styles.successTxt}>
              Vous pouvez à présent vous connecter avec votre nouveau mot de passe.
            </Text>
            <Pressable
              testID="reset-go-login"
              onPress={() => router.replace("/(auth)/login")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaTxt}>Se connecter</Text>
            </Pressable>
          </View>
        ) : !token ? (
          <View style={styles.errorCard}>
            <Feather name="alert-triangle" size={22} color={colors.error} />
            <Text style={styles.errorTitle}>Lien invalide</Text>
            <Text style={styles.errorTxt}>
              Le lien de réinitialisation semble incomplet. Refaites une demande depuis
              l&apos;écran de connexion.
            </Text>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaTxt}>Retour à la connexion</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Choisissez un nouveau mot de passe pour votre compte Leray-Pointel.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <PasswordInput
                testID="reset-password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="6 caractères minimum"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <PasswordInput
                testID="reset-confirm-input"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Retapez le mot de passe"
              />
            </View>

            <Pressable
              testID="reset-submit-btn"
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
                <Text style={styles.ctaTxt}>Enregistrer</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
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
  errorCard: {
    alignItems: "center",
    gap: 10,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorTitle: { fontSize: 17, fontWeight: "800", color: colors.error },
  errorTxt: {
    fontSize: 14,
    color: colors.onSurface,
    textAlign: "center",
    lineHeight: 20,
  },
}));
