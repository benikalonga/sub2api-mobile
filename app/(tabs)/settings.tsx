import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { isLocalProxyBaseUrl } from '@/src/lib/admin-fetch';
import { queryClient } from '@/src/lib/query-client';
import {
  adminConfigState,
  logoutAdminAccount,
  removeAdminAccount,
  saveAdminConfig,
  setAdminAccountEnabled,
  switchAdminAccount,
  type AdminAccountProfile,
} from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const schema = z
  .object({
    baseUrl: z.string().min(1, '请输入 Host'),
    adminApiKey: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!isLocalProxyBaseUrl(values.baseUrl.trim()) && !values.adminApiKey.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['adminApiKey'],
        message: '请输入 Admin Token',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export default function SettingsScreen() {
  const config = useSnapshot(adminConfigState);
  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      baseUrl: config.baseUrl,
      adminApiKey: config.adminApiKey,
    },
  });

  async function handleSwitch(account: AdminAccountProfile) {
    await switchAdminAccount(account.id);
    queryClient.clear();
    reset({ baseUrl: account.baseUrl, adminApiKey: account.adminApiKey });
  }

  async function handleDelete(account: AdminAccountProfile) {
    await removeAdminAccount(account.id);
    queryClient.clear();
    reset({ baseUrl: adminConfigState.baseUrl, adminApiKey: adminConfigState.adminApiKey });
  }

  async function handleLogout() {
    await logoutAdminAccount();
    queryClient.clear();
    reset({ baseUrl: '', adminApiKey: '' });
  }

  async function handleToggleEnabled(account: AdminAccountProfile) {
    await setAdminAccountEnabled(account.id, account.enabled === false);
    queryClient.clear();
    reset({ baseUrl: adminConfigState.baseUrl, adminApiKey: adminConfigState.adminApiKey });
  }

  return (
    <ScreenShell
      title="服务器"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">管理 Sub2API 连接。</Text>}
      variant="minimal"
    >
      <ListCard title="当前连接" meta={config.baseUrl || '未连接'}>
        <View className="gap-3">
          <Text className="text-sm text-[#6f665c]">
            {config.baseUrl || '当前没有激活服务器，可在下方直接新增或切换。'}
          </Text>
          <View className="flex-row gap-3">
            <Pressable className="flex-1 rounded-[18px] bg-[#1d5f55] px-4 py-3" onPress={handleSubmit(async (values) => {
              await saveAdminConfig(values);
              queryClient.clear();
            })}>
              <Text className="text-center text-sm font-semibold text-white">保存并连接</Text>
            </Pressable>
            <Pressable className="flex-1 rounded-[18px] bg-[#e7dfcf] px-4 py-3" onPress={handleLogout}>
              <Text className="text-center text-sm font-semibold text-[#4e463e]">退出当前</Text>
            </Pressable>
          </View>
        </View>
      </ListCard>

      <ListCard title="连接配置" meta="Host 与 Admin Token 合并配置">
        <View className="gap-3">
          <View>
            <Text className="mb-2 text-[11px] text-[#7d7468]">Host</Text>
            <Controller
              control={control}
              name="baseUrl"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="http://localhost:8787"
                  placeholderTextColor="#9b9081"
                  autoCapitalize="none"
                  className="rounded-[18px] bg-[#f1ece2] px-4 py-4 text-base text-[#16181a]"
                />
              )}
            />
          </View>

          <View>
            <Text className="mb-2 text-[11px] text-[#7d7468]">Admin Token</Text>
            <Controller
              control={control}
              name="adminApiKey"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="admin-xxxxxxxx"
                  placeholderTextColor="#9b9081"
                  autoCapitalize="none"
                  className="rounded-[18px] bg-[#f1ece2] px-4 py-4 text-base text-[#16181a]"
                />
              )}
            />
          </View>

          <Text className="text-[11px] text-[#8a8072]">使用本地代理时可留空 token；直连上游时必须填写。</Text>

          {(formState.errors.baseUrl || formState.errors.adminApiKey) ? (
            <View className="rounded-[16px] bg-[#fbf1eb] px-4 py-3">
              <Text className="text-sm text-[#c25d35]">{formState.errors.baseUrl?.message || formState.errors.adminApiKey?.message}</Text>
            </View>
          ) : null}
        </View>
      </ListCard>

      <ListCard title="已保存服务器" meta={`共 ${config.accounts.length} 个`}>
        <View className="gap-3">
          {config.accounts.map((account: AdminAccountProfile) => {
            const active = account.id === config.activeAccountId;
            const enabled = account.enabled !== false;

            return (
              <View key={account.id} className="rounded-[18px] bg-[#f1ece2] px-4 py-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-[#16181a]">{account.label}</Text>
                    <Text className="mt-1 text-xs text-[#7d7468]">{account.baseUrl}</Text>
                  </View>
                  {active ? (
                    <View className="rounded-full bg-[#1d5f55] px-3 py-1">
                      <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-white">当前</Text>
                    </View>
                  ) : !enabled ? (
                    <View className="rounded-full bg-[#cfc5b7] px-3 py-1">
                      <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#6f665c]">已禁用</Text>
                    </View>
                  ) : null}
                </View>

                <View className="mt-3 flex-row gap-3">
                  <Pressable
                    className={active ? 'flex-1 rounded-[16px] bg-[#d7eee4] px-3 py-2.5' : !enabled ? 'flex-1 rounded-[16px] bg-[#d8d1c4] px-3 py-2.5' : 'flex-1 rounded-[16px] bg-[#1d5f55] px-3 py-2.5'}
                    onPress={() => handleSwitch(account)}
                    disabled={!enabled}
                  >
                    <Text className={active ? 'text-center text-xs font-semibold text-[#1d5f55]' : !enabled ? 'text-center text-xs font-semibold text-[#7d7468]' : 'text-center text-xs font-semibold text-white'}>
                      {active ? '使用中' : '启用连接'}
                    </Text>
                  </Pressable>
                  <Pressable className="rounded-[16px] bg-[#e7dfcf] px-4 py-2.5" onPress={() => handleToggleEnabled(account)}>
                    <Text className="text-center text-xs font-semibold text-[#4e463e]">{enabled ? '禁用' : '启用'}</Text>
                  </Pressable>
                  <Pressable className="rounded-[16px] bg-[#e7dfcf] px-4 py-2.5" onPress={() => handleDelete(account)}>
                    <Text className="text-center text-xs font-semibold text-[#7a3d31]">删除</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {config.accounts.length === 0 ? <Text className="text-sm text-[#7d7468]">还没有保存的服务器。</Text> : null}
        </View>
      </ListCard>
    </ScreenShell>
  );
}
