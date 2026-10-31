import { Redirect, router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { getAdminSettings, getDashboardStats } from '@/src/services/admin';
import { queryClient } from '@/src/lib/query-client';
import { adminConfigState, hasAuthenticatedAdminSession, saveAdminConfig } from '@/src/store/admin-config';

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
type ConnectionState = 'idle' | 'checking' | 'error';

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

export default function LoginScreen() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = hasAuthenticatedAdminSession(config);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseUrl: config.baseUrl,
      adminApiKey: config.adminApiKey,
    },
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);

  if (hasAccount) {
    return <Redirect href="/monitor" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>Admin sign-in</Text>
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.subtext }}>
              On first launch, enter the server URL and Admin Key. Once connected you can use the app and manage multiple servers on the Servers page.
            </Text>
          </View>

          <View style={{ backgroundColor: colors.card, borderRadius: 22, padding: 18, gap: 16 }}>
            <View>
              <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>Server URL</Text>
              <Controller
                control={control}
                name="baseUrl"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(text) => {
                      if (connectionState !== 'idle') {
                        setConnectionState('idle');
                        setConnectionMessage('');
                      }
                      onChange(text);
                    }}
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
                      onChangeText={(text) => {
                        if (connectionState !== 'idle') {
                          setConnectionState('idle');
                          setConnectionMessage('');
                        }
                        onChange(text);
                      }}
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
              <View style={{ borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={{ color: colors.danger, fontSize: 14 }}>{connectionMessage}</Text>
              </View>
            ) : null}

            <Pressable
              style={{ backgroundColor: connectionState === 'checking' ? '#7ca89f' : colors.primary, borderRadius: 18, paddingVertical: 15, alignItems: 'center' }}
              disabled={connectionState === 'checking'}
              onPress={handleSubmit(async (values) => {
                setConnectionState('checking');
                setConnectionMessage('Verifying the server connection...');

                try {
                  await saveAdminConfig(values);
                  queryClient.clear();
                  await queryClient.fetchQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings });
                  await queryClient.prefetchQuery({ queryKey: ['monitor-stats'], queryFn: getDashboardStats });
                  router.replace('/monitor');
                } catch (error) {
                  setConnectionState('error');
                  setConnectionMessage(getConnectionErrorMessage(error));
                }
              })}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{connectionState === 'checking' ? 'Connecting...' : 'Enter app'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
