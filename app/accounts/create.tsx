import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAccount } from '@/src/services/admin';
import type { AccountType, CreateAccountRequest } from '@/src/types/admin';

const colors = {
  page: '#f4efe4',
  card: '#fbf8f2',
  text: '#16181a',
  subtext: '#6f665c',
  border: '#e7dfcf',
  primary: '#1d5f55',
  dark: '#1b1d1f',
  errorBg: '#f7e1d6',
  errorText: '#a4512b',
  muted: '#f7f1e6',
};

const PLATFORM_OPTIONS = ['anthropic', 'openai', 'gemini', 'sora', 'antigravity'];
const ACCOUNT_TYPE_OPTIONS: AccountType[] = ['apikey', 'oauth', 'setup-token', 'upstream'];
type JsonScalar = string | number | boolean | null | undefined;
type JsonRecord = Record<string, JsonScalar>;

function toNumber(raw: string) {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function toGroupIds(raw: string) {
  const values = raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length > 0 ? values : undefined;
}

function parseObjectInput(raw: string, fieldLabel: string): JsonRecord | undefined {
  if (!raw.trim()) return undefined;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  for (const [, value] of entries) {
    const valueType = typeof value;
    if (
      value !== null
      && value !== undefined
      && valueType !== 'string'
      && valueType !== 'number'
      && valueType !== 'boolean'
    ) {
      throw new Error(`${fieldLabel} only supports string / number / boolean / null.`);
    }
  }

  return parsed as JsonRecord;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    switch (error.message) {
      case 'BASE_URL_REQUIRED':
        return 'Set the server URL on the Servers page first.';
      case 'ADMIN_API_KEY_REQUIRED':
        return 'Set the Admin Token on the Servers page first.';
      case 'INVALID_SERVER_RESPONSE':
        return 'The service returned an unexpected format. Check that the backend API is up and review the gateway logs.';
      case 'REQUEST_FAILED':
        return 'Request failed. Check the server URL, token and network connection.';
      default:
        return error.message;
    }
  }

  return 'Failed to create the account. Please try again later.';
}

export default function CreateAdminAccountScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('anthropic');
  const [type, setType] = useState<AccountType>('apikey');
  const [notes, setNotes] = useState('');
  const [credentialsJson, setCredentialsJson] = useState('{\n  "base_url": "",\n  "api_key": ""\n}');
  const [extraJson, setExtraJson] = useState('');
  const [proxyId, setProxyId] = useState('');
  const [concurrency, setConcurrency] = useState('');
  const [priority, setPriority] = useState('');
  const [rateMultiplier, setRateMultiplier] = useState('');
  const [groupIds, setGroupIds] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(name.trim() && credentialsJson.trim()), [credentialsJson, name]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const credentials = parseObjectInput(credentialsJson, 'credentials');
      if (!credentials) {
        throw new Error('credentials cannot be empty.');
      }

      const extra = parseObjectInput(extraJson, 'extra');

      const payload: CreateAccountRequest = {
        name: name.trim(),
        platform,
        type,
        credentials,
        notes: notes.trim() || undefined,
        proxy_id: toNumber(proxyId),
        concurrency: toNumber(concurrency),
        priority: toNumber(priority),
        rate_multiplier: toNumber(rateMultiplier),
        group_ids: toGroupIds(groupIds),
        extra,
      };

      return createAccount(payload);
    },
    onSuccess: () => {
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      router.replace('/(tabs)/accounts');
    },
    onError: (error) => {
      setFormError(getErrorMessage(error));
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Add account (/admin/accounts)' }} />
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.page }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Basic info</Text>

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>Account name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. openai-main"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Platform</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {PLATFORM_OPTIONS.map((item) => {
                const active = platform === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setPlatform(item)}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.muted,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '700' }}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {ACCOUNT_TYPE_OPTIONS.map((item) => {
                const active = type === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setType(item)}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.muted,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '700' }}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Main route account"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Request body fields</Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: colors.subtext }}>
              This page calls /admin/accounts directly. credentials is required, extra is optional.
            </Text>

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>credentials (JSON object)</Text>
            <TextInput
              value={credentialsJson}
              onChangeText={setCredentialsJson}
              multiline
              textAlignVertical="top"
              placeholder='e.g. {"base_url":"https://api.example.com","api_key":"sk-..."}'
              placeholderTextColor="#9a9082"
              style={{
                minHeight: 120,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>extra (optional, JSON object)</Text>
            <TextInput
              value={extraJson}
              onChangeText={setExtraJson}
              multiline
              textAlignVertical="top"
              placeholder='e.g. {"window_cost_limit":50}'
              placeholderTextColor="#9a9082"
              style={{
                minHeight: 96,
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Optional parameters</Text>

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>proxy_id</Text>
            <TextInput
              value={proxyId}
              onChangeText={setProxyId}
              keyboardType="number-pad"
              placeholder="e.g. 3"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>concurrency</Text>
            <TextInput
              value={concurrency}
              onChangeText={setConcurrency}
              keyboardType="number-pad"
              placeholder="e.g. 10"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>priority</Text>
            <TextInput
              value={priority}
              onChangeText={setPriority}
              keyboardType="number-pad"
              placeholder="e.g. 0"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>rate_multiplier</Text>
            <TextInput
              value={rateMultiplier}
              onChangeText={setRateMultiplier}
              keyboardType="decimal-pad"
              placeholder="e.g. 1"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
                marginBottom: 10,
              }}
            />

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>group_ids (comma-separated)</Text>
            <TextInput
              value={groupIds}
              onChangeText={setGroupIds}
              placeholder="e.g. 1,2,5"
              placeholderTextColor="#9a9082"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: colors.text,
              }}
            />
          </View>

          {formError ? (
            <View style={{ backgroundColor: colors.errorBg, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: colors.errorText }}>{formError}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setFormError(null);
              createMutation.mutate();
            }}
            disabled={!canSubmit || createMutation.isPending}
            style={{
              backgroundColor: !canSubmit || createMutation.isPending ? '#8a8072' : colors.dark,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{createMutation.isPending ? 'Submitting...' : 'Create account'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
