import * as SecureStore from 'expo-secure-store';
const { proxy } = require('valtio');

const BASE_URL_KEY = 'sub2api_base_url';
const ADMIN_KEY_KEY = 'sub2api_admin_api_key';
const ACCOUNTS_KEY = 'sub2api_accounts';
const ACTIVE_ACCOUNT_ID_KEY = 'sub2api_active_account_id';

export type AdminAccountProfile = {
  id: string;
  label: string;
  baseUrl: string;
  adminApiKey: string;
  updatedAt: string;
  enabled?: boolean;
};

function createAccountId() {
  return `acct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getAccountLabel(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return url.host || baseUrl;
  } catch {
    return baseUrl;
  }
}

function normalizeConfig(input: { baseUrl: string; adminApiKey: string }) {
  return {
    baseUrl: input.baseUrl.trim().replace(/\/$/, ''),
    adminApiKey: input.adminApiKey.trim(),
  };
}

function sortAccounts(accounts: AdminAccountProfile[]) {
  return [...accounts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function normalizeAccount(account: AdminAccountProfile): AdminAccountProfile {
  return {
    ...account,
    enabled: account.enabled ?? true,
  };
}

function getNextActiveAccount(accounts: AdminAccountProfile[], activeAccountId?: string) {
  const enabledAccounts = accounts.filter((account) => account.enabled !== false);

  if (activeAccountId) {
    const preferred = enabledAccounts.find((account) => account.id === activeAccountId);
    if (preferred) {
      return preferred;
    }
  }

  return enabledAccounts[0];
}

export function getDefaultAdminConfig() {
  return {
    baseUrl: '',
    adminApiKey: '',
  };
}

async function getItem(key: string) {
  if (typeof window !== 'undefined') {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (typeof window !== 'undefined') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }

    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (typeof window !== 'undefined') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }

    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export const adminConfigState = proxy({
  ...getDefaultAdminConfig(),
  accounts: [] as AdminAccountProfile[],
  activeAccountId: '',
  hydrated: false,
  saving: false,
});

export async function hydrateAdminConfig() {
  const defaults = getDefaultAdminConfig();
  const [baseUrl, adminApiKey, rawAccounts, activeAccountId] = await Promise.all([
    getItem(BASE_URL_KEY),
    getItem(ADMIN_KEY_KEY),
    getItem(ACCOUNTS_KEY),
    getItem(ACTIVE_ACCOUNT_ID_KEY),
  ]);

  let accounts: AdminAccountProfile[] = [];

  if (rawAccounts) {
    try {
      const parsed = JSON.parse(rawAccounts) as AdminAccountProfile[];
      accounts = Array.isArray(parsed) ? parsed.map((account) => normalizeAccount(account)) : [];
    } catch {
      accounts = [];
    }
  }

  if (accounts.length === 0 && baseUrl) {
    const legacyConfig = normalizeConfig({
      baseUrl,
      adminApiKey: adminApiKey ?? defaults.adminApiKey,
    });

    accounts = [
      {
        id: createAccountId(),
        label: getAccountLabel(legacyConfig.baseUrl),
        ...legacyConfig,
        updatedAt: new Date().toISOString(),
        enabled: true,
      },
    ];
  }

  const sortedAccounts = sortAccounts(accounts);
  const activeAccount = getNextActiveAccount(sortedAccounts, activeAccountId ?? undefined);
  const nextActiveAccountId = activeAccount?.id || '';

  adminConfigState.accounts = sortedAccounts;
  adminConfigState.activeAccountId = nextActiveAccountId;
  adminConfigState.baseUrl = activeAccount?.baseUrl ?? defaults.baseUrl;
  adminConfigState.adminApiKey = activeAccount?.adminApiKey ?? defaults.adminApiKey;

  adminConfigState.hydrated = true;

  await Promise.all([
    setItem(ACCOUNTS_KEY, JSON.stringify(sortedAccounts)),
    nextActiveAccountId ? setItem(ACTIVE_ACCOUNT_ID_KEY, nextActiveAccountId) : deleteItem(ACTIVE_ACCOUNT_ID_KEY),
    setItem(BASE_URL_KEY, activeAccount?.baseUrl ?? defaults.baseUrl),
    setItem(ADMIN_KEY_KEY, activeAccount?.adminApiKey ?? defaults.adminApiKey),
  ]);
}

export async function saveAdminConfig(input: { baseUrl: string; adminApiKey: string }) {
  adminConfigState.saving = true;

  const normalized = normalizeConfig(input);
  const nextUpdatedAt = new Date().toISOString();
  const existingAccount = adminConfigState.accounts.find(
    (account: AdminAccountProfile) => account.baseUrl === normalized.baseUrl && account.adminApiKey === normalized.adminApiKey
  );
  const nextAccount: AdminAccountProfile = existingAccount
    ? {
        ...existingAccount,
      label: getAccountLabel(normalized.baseUrl),
      updatedAt: nextUpdatedAt,
    }
    : {
        id: createAccountId(),
        label: getAccountLabel(normalized.baseUrl),
        ...normalized,
        updatedAt: nextUpdatedAt,
        enabled: true,
      };
  const nextAccounts = sortAccounts([
    nextAccount,
    ...adminConfigState.accounts.filter((account: AdminAccountProfile) => account.id !== nextAccount.id),
  ]);

  await Promise.all([
    setItem(BASE_URL_KEY, normalized.baseUrl),
    setItem(ADMIN_KEY_KEY, normalized.adminApiKey),
    setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts)),
    setItem(ACTIVE_ACCOUNT_ID_KEY, nextAccount.id),
  ]);

  adminConfigState.accounts = nextAccounts;
  adminConfigState.activeAccountId = nextAccount.id;
  adminConfigState.baseUrl = normalized.baseUrl;
  adminConfigState.adminApiKey = normalized.adminApiKey;
  adminConfigState.saving = false;
}

export async function switchAdminAccount(accountId: string) {
  const account = adminConfigState.accounts.find((item: AdminAccountProfile) => item.id === accountId);

  if (!account) {
    return;
  }

  if (account.enabled === false) {
    return;
  }

  const nextAccount = {
    ...account,
    updatedAt: new Date().toISOString(),
  };
  const nextAccounts = sortAccounts([
    nextAccount,
    ...adminConfigState.accounts.filter((item: AdminAccountProfile) => item.id !== accountId),
  ]);

  await Promise.all([
    setItem(BASE_URL_KEY, nextAccount.baseUrl),
    setItem(ADMIN_KEY_KEY, nextAccount.adminApiKey),
    setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts)),
    setItem(ACTIVE_ACCOUNT_ID_KEY, nextAccount.id),
  ]);

  adminConfigState.accounts = nextAccounts;
  adminConfigState.activeAccountId = nextAccount.id;
  adminConfigState.baseUrl = nextAccount.baseUrl;
  adminConfigState.adminApiKey = nextAccount.adminApiKey;
}

export async function removeAdminAccount(accountId: string) {
  const nextAccounts = adminConfigState.accounts.filter((item: AdminAccountProfile) => item.id !== accountId);
  const nextActiveAccount = getNextActiveAccount(nextAccounts, adminConfigState.activeAccountId === accountId ? '' : adminConfigState.activeAccountId);

  await Promise.all([
    setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts)),
    nextActiveAccount ? setItem(ACTIVE_ACCOUNT_ID_KEY, nextActiveAccount.id) : deleteItem(ACTIVE_ACCOUNT_ID_KEY),
    setItem(BASE_URL_KEY, nextActiveAccount?.baseUrl ?? ''),
    setItem(ADMIN_KEY_KEY, nextActiveAccount?.adminApiKey ?? ''),
  ]);

  adminConfigState.accounts = nextAccounts;
  adminConfigState.activeAccountId = nextActiveAccount?.id ?? '';
  adminConfigState.baseUrl = nextActiveAccount?.baseUrl ?? '';
  adminConfigState.adminApiKey = nextActiveAccount?.adminApiKey ?? '';
}

export async function logoutAdminAccount() {
  await Promise.all([setItem(BASE_URL_KEY, ''), setItem(ADMIN_KEY_KEY, ''), deleteItem(ACTIVE_ACCOUNT_ID_KEY)]);

  adminConfigState.activeAccountId = '';
  adminConfigState.baseUrl = '';
  adminConfigState.adminApiKey = '';
}

export async function setAdminAccountEnabled(accountId: string, enabled: boolean) {
  const nextAccounts = sortAccounts(
    adminConfigState.accounts.map((account: AdminAccountProfile) =>
      account.id === accountId ? { ...account, enabled, updatedAt: new Date().toISOString() } : account
    )
  );
  const nextActiveAccount = getNextActiveAccount(nextAccounts, enabled ? accountId : adminConfigState.activeAccountId);

  await Promise.all([
    setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts)),
    nextActiveAccount ? setItem(ACTIVE_ACCOUNT_ID_KEY, nextActiveAccount.id) : deleteItem(ACTIVE_ACCOUNT_ID_KEY),
    setItem(BASE_URL_KEY, nextActiveAccount?.baseUrl ?? ''),
    setItem(ADMIN_KEY_KEY, nextActiveAccount?.adminApiKey ?? ''),
  ]);

  adminConfigState.accounts = nextAccounts;
  adminConfigState.activeAccountId = nextActiveAccount?.id ?? '';
  adminConfigState.baseUrl = nextActiveAccount?.baseUrl ?? '';
  adminConfigState.adminApiKey = nextActiveAccount?.adminApiKey ?? '';
}
