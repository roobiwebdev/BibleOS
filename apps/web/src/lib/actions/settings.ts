"use server";
/**
 * SOURCE OF TRUTH KEYWORDS: settings actions, getPublicSettings, getAuthConfig, getLegalContent, getSiteModes, getAdminSettings, updateAppSettings, getApiKeys, saveApiKeys, testStorageConnection
 * WHAT:  Server-action adapters over the settings router (no logic here).
 * WHERE: client components that read or edit settings.
 */
import type { RouterInputs } from "@starter/api";

import { api } from "@/server/trpc";

export async function getPublicSettings() {
  return (await api()).settings.public();
}

export async function getAuthConfig() {
  return (await api()).settings.authConfig();
}

export async function getLegalContent(slug: "privacy" | "terms") {
  return (await api()).settings.legal({ slug });
}

export async function getSiteModes() {
  return (await api()).settings.siteModes();
}

export async function getAdminSettings() {
  return (await api()).settings.adminGet();
}

export async function updateAppSettings(input: RouterInputs["settings"]["update"]) {
  return (await api()).settings.update(input);
}

export async function getApiKeys() {
  return (await api()).settings.apiKeys();
}

export async function saveApiKeys(input: RouterInputs["settings"]["saveApiKeys"]) {
  return (await api()).settings.saveApiKeys(input);
}

export async function testStorageConnection() {
  return (await api()).settings.testStorage();
}
