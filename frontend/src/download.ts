import { Platform, Share } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
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
// Native → uses the modern expo-file-system File API to save to app cache,
// then opens the native share sheet.
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

  // Native — download into the app cache with the modern API
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  const downloaded = await File.downloadFileAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const localUri = downloaded?.uri ?? target.uri;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, {
      mimeType,
      dialogTitle: filename,
      UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined,
    });
  } else {
    await Share.share({ title: filename, message: localUri });
  }
}

// Send an authenticated file to the platform print system.
// Web  → opens the PDF in a new tab and triggers the browser print dialog.
// Native → downloads the PDF into cache, then hands it to Expo Print.
export async function printAuthedPdf(path: string, filename: string) {
  const token = await getToken();
  const url = `${BASE}/api${path}`;

  if (Platform.OS === "web") {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Impression impossible");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    // Open in a hidden iframe and call print(); fall back to a new tab.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = objectUrl;
    document.body.appendChild(iframe);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      setTimeout(() => document.body.removeChild(iframe), 500);
    };
    iframe.onload = () => {
      try {
        const w = iframe.contentWindow;
        if (!w) throw new Error("iframe not ready");
        w.focus();
        w.print();
        // Give the print dialog a chance before cleanup
        setTimeout(cleanup, 60_000);
      } catch {
        // Fallback: open PDF in new tab so the user can Ctrl+P
        window.open(objectUrl, "_blank");
        cleanup();
      }
    };
    return;
  }

  // Native — download then hand to expo-print
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  const downloaded = await File.downloadFileAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const localUri = downloaded?.uri ?? target.uri;
  await Print.printAsync({ uri: localUri });
}
