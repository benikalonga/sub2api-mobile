import { useMutation } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient } from '@/src/lib/query-client';
import { createUser } from '@/src/services/admin';
import type { CreateUserRequest } from '@/src/types/admin';

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

type JsonValue = string | number | boolean | null | undefined;

function parseJsonObject(raw: string, fieldLabel: string): Record<string, JsonValue> {
  if (!raw.trim()) return {};
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

  return parsed as Record<string, JsonValue>;
}

function toNumber(raw: string) {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
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

  return 'Failed to create the user. Please try again later.';
}

export default function CreateUserScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [balance, setBalance] = useState('');
  const [concurrency, setConcurrency] = useState('');
  const [extraJson, setExtraJson] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(email.trim() && password.trim()), [email, password]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const extra = parseJsonObject(extraJson, 'extra');
      const payload: CreateUserRequest = {
        ...extra,
        email: email.trim(),
        password: password.trim(),
        username: username.trim() || undefined,
        notes: notes.trim() || undefined,
        role,
        status,
        balance: toNumber(balance),
        concurrency: toNumber(concurrency),
      };

      return createUser(payload);
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      router.replace('/(tabs)/users');
    },
    onError: (error) => {
      setFormError(getErrorMessage(error));
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Add user (/admin/users)' }} />
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

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. user@example.com"
              placeholderTextColor="#9a9082"
              autoCapitalize="none"
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter a password"
              placeholderTextColor="#9a9082"
              secureTextEntry
              autoCapitalize="none"
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Username (optional)</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. demo-user"
              placeholderTextColor="#9a9082"
              autoCapitalize="none"
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Test user"
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Role and status</Text>

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>Role</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {(['user', 'admin'] as const).map((item) => {
                const active = role === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setRole(item)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      paddingVertical: 11,
                      alignItems: 'center',
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['active', 'disabled'] as const).map((item) => {
                const active = status === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setStatus(item)}
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      paddingVertical: 11,
                      alignItems: 'center',
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Advanced parameters (optional)</Text>

            <Text style={{ marginTop: 12, marginBottom: 6, fontSize: 12, color: colors.subtext }}>Balance</Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
              placeholder="e.g. 100"
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>Concurrency</Text>
            <TextInput
              value={concurrency}
              onChangeText={setConcurrency}
              keyboardType="number-pad"
              placeholder="e.g. 5"
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

            <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>extra (optional, JSON object)</Text>
            <TextInput
              value={extraJson}
              onChangeText={setExtraJson}
              multiline
              textAlignVertical="top"
              placeholder='e.g. {"daily_limit":10}'
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
            <Text style={{ color: '#fff', fontWeight: '700' }}>{createMutation.isPending ? 'Submitting...' : 'Create user'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
