import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, KeyRound } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useScreenInteractive } from '@/src/hooks/use-screen-interactive';
import { isLocalProxyBaseUrl } from '@/src/lib/admin-fetch';
import { queryClient } from '@/src/lib/query-client';
import { adminConfigState, removeAdminAccount, saveAdminConfig, setAdminAccountEnabled, switchAdminAccount, type AdminAccountProfile } from '@/src/store/admin-config';

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

export default function LoginScreen() {
  useScreenInteractive('login_interactive');
  const config = useSnapshot(adminConfigState);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseUrl: config.baseUrl,
      adminApiKey: config.adminApiKey,
    },
  });

  return (
    <ScreenShell
      title="登录"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">添加、切换或恢复 Sub2API 账号。</Text>}
      variant="minimal"
    >
      {config.accounts.length > 0 ? (
        <ListCard title="已保存账号" meta="可直接切换到其他 Sub2API 账号">
          <View className="gap-3">
            {config.accounts.map((account: AdminAccountProfile) => {
              const active = account.id === config.activeAccountId;
              const enabled = account.enabled !== false;

              return (
                <View key={account.id} className="rounded-[18px] bg-[#f1ece2] px-4 py-3">
                  <Text className="text-sm font-semibold text-[#16181a]">{account.label}</Text>
                  <Text className="mt-1 text-xs text-[#7d7468]">{account.baseUrl}</Text>
                  <View className="mt-3 flex-row gap-3">
                    <Pressable
                      className={active ? 'flex-1 rounded-[16px] bg-[#d7eee4] px-3 py-2.5' : !enabled ? 'flex-1 rounded-[16px] bg-[#d8d1c4] px-3 py-2.5' : 'flex-1 rounded-[16px] bg-[#1d5f55] px-3 py-2.5'}
                      onPress={async () => {
                        await switchAdminAccount(account.id);
                        queryClient.clear();
                        router.replace('/monitor');
                      }}
                      disabled={!enabled}
                    >
                      <Text className={active ? 'text-center text-xs font-semibold text-[#1d5f55]' : !enabled ? 'text-center text-xs font-semibold text-[#7d7468]' : 'text-center text-xs font-semibold text-white'}>
                        {active ? '使用中' : '切换账号'}
                      </Text>
                    </Pressable>
                    <Pressable
                      className="rounded-[16px] bg-[#e7dfcf] px-4 py-2.5"
                      onPress={async () => {
                        await setAdminAccountEnabled(account.id, account.enabled === false);
                      }}
                    >
                      <Text className="text-center text-xs font-semibold text-[#4e463e]">{enabled ? '禁用' : '启用'}</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-[16px] bg-[#e7dfcf] px-4 py-2.5"
                      onPress={async () => {
                        await removeAdminAccount(account.id);
                      }}
                    >
                      <Text className="text-center text-xs font-semibold text-[#7a3d31]">删除</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ListCard>
      ) : null}

      <ListCard title="Host" meta="当前站点或管理代理地址" icon={Globe}>
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
      </ListCard>

      <ListCard title="Admin Token" meta="直连上游时必填；使用本地代理可留空" icon={KeyRound}>
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
      </ListCard>

      {(formState.errors.baseUrl || formState.errors.adminApiKey) ? (
        <View className="rounded-[20px] bg-[#fbf1eb] px-4 py-3">
          <Text className="text-sm text-[#c25d35]">{formState.errors.baseUrl?.message || formState.errors.adminApiKey?.message}</Text>
        </View>
      ) : null}

      <Pressable
        className="rounded-[20px] bg-[#1d5f55] px-4 py-4"
        onPress={handleSubmit(async (values) => {
          await saveAdminConfig(values);
          queryClient.clear();
          router.replace('/monitor');
        })}
      >
        <Text className="text-center text-sm font-semibold tracking-[1.2px] text-white">
          {config.saving ? '登录中...' : '进入管理台'}
        </Text>
      </Pressable>
    </ScreenShell>
  );
}
