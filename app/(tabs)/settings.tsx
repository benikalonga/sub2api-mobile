import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { z } from 'zod';

import { getAdminSettings, getDashboardStats } from '@/src/services/admin';
import { queryClient } from '@/src/lib/query-client';
import { adminConfigState, removeAdminAccount, saveAdminConfig, switchAdminAccount, type AdminAccountProfile } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const schema = z
  .object({
    baseUrl: z.string().min(1, 'Enter the server URL'),
    adminApiKey: z.string(),
  })
  .refine((values) => values.adminApiKey.trim().length > 0, {
    path: ['adminApiKey'],
    message: 'Enter the Admin Key',
  });

type FormValues = z.infer<typeof schema>;
type ConnectionState = 'idle' | 'checking' | 'success' | 'error';

const colors = {
  page: '#f4efe4',
  card: '#fbf8f2',
  mutedCard: '#f1ece2',
  primary: '#1d5f55',
  text: '#16181a',
  subtext: '#6f665c',
  border: '#e7dfcf',
  dangerBg: '#fbf1eb',
  danger: '#c25d35',
  successBg: '#e6f4ee',
  success: '#1d5f55',
};

function getConnectionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    switch (error.message) {
      case 'BASE_URL_REQUIRED':
        return 'Enter the server URL first.';
      case 'ADMIN_API_KEY_REQUIRED':
        return 'Enter the Admin Key first.';
      case 'INVALID_SERVER_RESPONSE':
        return 'This URL returned unexpected data. Check that it is a working admin API.';
      default:
        return error.message;
    }
  }

  return 'Connection failed. Check the server URL, Admin Key and network connection.';
}

function ServerCard({
  account,
  active,
  onSelect,
  onDelete,
}: {
  account: AdminAccountProfile;
  active: boolean;
  onSelect: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={{
        backgroundColor: active ? '#e6f4ee' : colors.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: active ? colors.success : colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{account.label}</Text>
          <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20, color: colors.subtext }}>{account.baseUrl}</Text>
          <Text style={{ marginTop: 8, fontSize: 11, color: '#8a8072' }}>Updated {new Date(account.updatedAt).toLocaleString()}</Text>
        </View>
        {active ? (
          <View style={{ backgroundColor: colors.success, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>In use</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable onPress={onSelect} style={{ flex: 1, backgroundColor: active ? '#d7eee4' : colors.primary, borderRadius: 14, paddingVertical: 11, alignItems: 'center' }}>
          <Text style={{ color: active ? colors.success : '#fff', fontSize: 13, fontWeight: '700' }}>{active ? 'Selected' : 'Switch to this server'}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={{ backgroundColor: colors.border, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#7a3d31', fontSize: 13, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const config = useSnapshot(adminConfigState);
  const [showForm, setShowForm] = useState(config.accounts.length === 0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseUrl: '',
      adminApiKey: '',
    },
  });

  async function verifyAndEnter(successMessage: string) {
    setConnectionState('checking');
    setConnectionMessage('Checking whether the service is available...');

    try {
      queryClient.clear();
      await queryClient.fetchQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings });
      await queryClient.prefetchQuery({ queryKey: ['monitor-stats'], queryFn: getDashboardStats });
      setConnectionState('success');
      setConnectionMessage(successMessage);
      router.replace('/monitor');
    } catch (error) {
      setConnectionState('error');
      setConnectionMessage(getConnectionErrorMessage(error));
    }
  }

  async function handleAdd(values: FormValues) {
    await saveAdminConfig(values);
    reset({ baseUrl: '', adminApiKey: '' });
    setShowForm(false);
    await verifyAndEnter('Server added and selected.');
  }

  async function handleSelect(account: AdminAccountProfile) {
    await switchAdminAccount(account.id);
    await verifyAndEnter(`Switched to ${account.label}.`);
  }

  async function handleDelete(account: AdminAccountProfile) {
    await removeAdminAccount(account.id);
    queryClient.clear();
  }

  async function handleRefresh() {
    if (!config.baseUrl.trim()) {
      return;
    }

    setIsRefreshing(true);
    setConnectionState('idle');
    setConnectionMessage('');

    try {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings }),
        queryClient.prefetchQuery({ queryKey: ['monitor-stats'], queryFn: getDashboardStats }),
      ]);
    } catch (error) {
      setConnectionState('error');
      setConnectionMessage(getConnectionErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor="#1d5f55" />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>Servers</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: '#8a8072' }}>Choose the server to manage, or add a new one.</Text>
          </View>
          <Pressable
            onPress={() => {
              setShowForm((value) => !value);
              setConnectionState('idle');
              setConnectionMessage('');
            }}
            style={{ backgroundColor: colors.primary, borderRadius: 999, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 24, lineHeight: 24 }}>+</Text>
          </Pressable>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add server</Text>

            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>Server URL</Text>
              <Controller
                control={control}
                name="baseUrl"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="e.g. https://api.example.com"
                    placeholderTextColor="#9b9081"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ backgroundColor: colors.mutedCard, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text }}
                  />
                )}
              />
            </View>

            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>Admin Key</Text>
              <Controller
                control={control}
                name="adminApiKey"
                render={({ field: { onChange, value } }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="admin-xxxxxxxx"
                      placeholderTextColor="#9b9081"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showAdminKey}
                      style={{
                        flex: 1,
                        backgroundColor: colors.mutedCard,
                        borderRadius: 16,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 16,
                        color: colors.text,
                      }}
                    />
                    <Pressable
                      onPress={() => setShowAdminKey((value) => !value)}
                      style={{ backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#4e463e' }}>{showAdminKey ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  </View>
                )}
              />
            </View>

            {formState.errors.baseUrl || formState.errors.adminApiKey ? (
              <View style={{ borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: colors.danger, fontSize: 14 }}>{formState.errors.baseUrl?.message || formState.errors.adminApiKey?.message}</Text>
              </View>
            ) : null}

            {connectionMessage ? (
              <View style={{ borderRadius: 14, backgroundColor: connectionState === 'success' ? colors.successBg : colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: connectionState === 'success' ? colors.success : colors.danger, fontSize: 14 }}>{connectionMessage}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleSubmit(handleAdd)}
                disabled={connectionState === 'checking'}
                style={{ flex: 1, backgroundColor: connectionState === 'checking' ? '#7ca89f' : colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{connectionState === 'checking' ? 'Checking...' : 'Save and use'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowForm(false);
                  setConnectionState('idle');
                  setConnectionMessage('');
                  reset({ baseUrl: '', adminApiKey: '' });
                }}
                style={{ flex: 1, backgroundColor: colors.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#4e463e', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          {config.accounts.map((account: AdminAccountProfile) => (
            <ServerCard
              key={account.id}
              account={account}
              active={account.id === config.activeAccountId}
              onSelect={() => handleSelect(account)}
              onDelete={() => handleDelete(account)}
            />
          ))}

          {config.accounts.length === 0 ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 18 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>No servers yet</Text>
              <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 21, color: colors.subtext }}>Tap + in the top right to add a server. Once saved, it is selected and the overview opens.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
