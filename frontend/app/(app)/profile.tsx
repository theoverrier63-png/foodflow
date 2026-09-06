import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useToast } from "@/src/toast";
import { useCart } from "@/src/cart-context";
import { makeStyles, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const { clear } = useCart();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function logout() {
    clear();
    await signOut();
    toast.show("Déconnecté", "info");
  }

  async function deleteAccount() {
    try {
      setDeleting(true);
      await api.deleteMe();
      clear();
      await signOut();
      toast.show("Compte supprimé", "info");
    } catch (e: any) {
      toast.show(e?.message || "Suppression impossible", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const initials = (user?.company_name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Mon compte</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View style={styles.profileCard} testID="profile-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.company}>{user?.company_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations entreprise</Text>
          <InfoRow icon="hash" label="SIRET" value={user?.siret ?? "-"} />
          <InfoRow icon="phone" label="Téléphone" value={user?.phone ?? "-"} />
          <InfoRow icon="map-pin" label="Adresse de livraison" value={user?.delivery_address ?? "-"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <View style={styles.aboutBox}>
            <View style={styles.leafBadge}>
              <Feather name="shopping-bag" size={20} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aboutTitle}>Leray-Pointel</Text>
              <Text style={styles.aboutTxt}>
                Fournisseur professionnel de fruits & légumes frais.
                Paiement hors application par facturation.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          testID="logout-button"
          onPress={logout}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutTxt}>Se déconnecter</Text>
        </Pressable>

        {user?.role !== "admin" ? (
          <Pressable
            testID="delete-account-button"
            onPress={() => setConfirmDelete(true)}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
          >
            <Feather name="trash-2" size={16} color={colors.muted} />
            <Text style={styles.deleteBtnTxt}>Supprimer mon compte</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setConfirmDelete(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => !deleting && setConfirmDelete(false)}
        >
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dangerIcon}>
              <Feather name="alert-triangle" size={22} color={colors.error} />
            </View>
            <Text style={styles.dialogTitle}>Supprimer votre compte ?</Text>
            <Text style={styles.dialogSub}>
              Cette action est définitive. Votre historique restera visible côté
              Leray-Pointel, mais votre profil sera effacé.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => !deleting && setConfirmDelete(false)}
                disabled={deleting}
                style={[styles.dialogBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={[styles.dialogBtnTxt, { color: colors.onSurface }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                testID="confirm-delete-account"
                disabled={deleting}
                onPress={deleteAccount}
                style={[styles.dialogBtn, { backgroundColor: colors.error }]}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.onError} />
                ) : (
                  <Text style={[styles.dialogBtnTxt, { color: colors.onError }]}>
                    Supprimer
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon as any} size={16} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoVal}>{value}</Text>
      </View>
    </View>
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
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.brandSecondary,
    borderRadius: 16,
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  company: { fontSize: 17, fontWeight: "800", color: colors.onBrandSecondary },
  email: { fontSize: 13, color: colors.onBrandSecondary, marginTop: 2, opacity: 0.8 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, marginLeft: 4 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.3 },
  infoVal: { fontSize: 14, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  aboutBox: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leafBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  aboutTxt: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    marginTop: 8,
  },
  logoutTxt: { color: colors.error, fontWeight: "700", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteBtnTxt: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 8,
  },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(220,38,38,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dialogTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  dialogSub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 12, width: "100%" },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dialogBtnTxt: { fontSize: 14, fontWeight: "700" },
}));
