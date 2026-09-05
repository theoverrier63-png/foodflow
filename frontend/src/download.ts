import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getToken } from "./api";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

// Download or share a CSV file. On web: triggers browser download.
// On native: opens native share sheet with the CSV text.
export async function downloadCsv(filename: string, content: string) {
  if (Platform.OS === "web") {
    try {
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      throw new Error("Téléchargement impossible");
    }
    return;
  }
  await Share.share({ title: filename, message: content });
}

// Download an authenticated file (PDF, etc.) from the API.
// Web  → forces a browser download of the blob.
// Native → saves to app cache and opens the share sheet.
export async function downloadAuthedFile(
  path: string,
  filename: string,
  mimeType = "application/pdf",
) {
  const token = await getToken();
  const url = `${BASE}/api${path}`;

  if (Platform.OS === "web") {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Téléchargement impossible");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return;
  }

  // Native — write to cache then share
  // @ts-ignore expo-file-system exports both legacy (top-level) and new APIs
  const cacheDir: string = (FileSystem as any).cacheDirectory ?? "";
  const dest = cacheDir + filename;
  const download = await (FileSystem as any).downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!download?.uri) throw new Error("Téléchargement impossible");

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(download.uri, {
      mimeType,
      dialogTitle: filename,
      UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
    });
  } else {
    await Share.share({ title: filename, message: download.uri });
  }
}
