import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth-context";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.role === "admin" ? "/(admin)" : "/(app)"} />;
}
