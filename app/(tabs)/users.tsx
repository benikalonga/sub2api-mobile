import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Copy, Search, UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { useScreenInteractive } from '@/src/hooks/use-screen-interactive';
import { getUser, getUserUsage, listUserApiKeys, listUsers } from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';
import type { AdminApiKey, AdminUser, UserUsageSummary } from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

type UserSupplement = {
  usage?: UserUsageSummary;
  apiKeys: AdminApiKey[];
};

function getUserTitle(user: AdminUser) {
  return user.username?.trim() || user.email;
}

function getUserSortValue(user: AdminUser) {
  const raw = user.updated_at || user.created_at || '';
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(value) ? 0 : value;
}

function formatQuotaValue(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function UsersScreen() {
  useScreenInteractive('users_interactive');
  const config = useSnapshot(adminConfigState);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const keyword = useDebouncedValue(searchText.trim(), 300);
  const queryClient = useQueryClient();
  const hasAccount = Boolean(config.baseUrl.trim());

  const usersQuery = useQuery({
    queryKey: ['users', keyword],
    queryFn: () => listUsers(keyword),
    enabled: hasAccount,
  });

  const items = usersQuery.data?.items ?? [];
  const userDetailQueries = useQueries({
    queries: items.map((user) => ({
      queryKey: ['user-list-supplement', user.id],
      queryFn: async () => {
        const [usage, apiKeysData] = await Promise.all([getUserUsage(user.id), listUserApiKeys(user.id)]);

        return {
          usage,
          apiKeys: apiKeysData.items ?? [],
        } satisfies UserSupplement;
      },
      enabled: hasAccount,
      staleTime: 60_000,
    })),
  });

  const errorMessage = usersQuery.error instanceof Error ? usersQuery.error.message : '';
  const supplementsByUserId = useMemo(
    () =>
      items.reduce<Record<number, UserSupplement | undefined>>((result, user, index) => {
        result[user.id] = userDetailQueries[index]?.data;
        return result;
      }, {}),
    [items, userDetailQueries]
  );
  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const delta = getUserSortValue(right) - getUserSortValue(left);
        return sortOrder === 'desc' ? delta : -delta;
      }),
    [items, sortOrder]
  );

  async function copyKey(keyId: number, value: string) {
    await Clipboard.setStringAsync(value);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId((current) => (current === keyId ? null : current)), 1600);
  }

  const renderItem = useCallback(
    ({ item: user }: { item: (typeof sortedItems)[number] }) => {
      const keyItems = (supplementsByUserId[user.id]?.apiKeys ?? []).slice(0, 3);

      return (
        <Pressable
          className="px-1"
          onPress={() => {
            void queryClient.prefetchQuery({ queryKey: ['user', user.id], queryFn: () => getUser(user.id) });
            void queryClient.prefetchQuery({ queryKey: ['user-usage', user.id], queryFn: () => getUserUsage(user.id) });
            void queryClient.prefetchQuery({ queryKey: ['user-api-keys', user.id], queryFn: () => listUserApiKeys(user.id) });
            router.push(`/users/${user.id}`);
          }}
        >
          <ListCard title={getUserTitle(user)} meta={user.email} badge={user.status || 'active'} icon={UserRound}>
            <View className="gap-2">
              <View className="rounded-[14px] bg-[#f7f2e9] px-3 py-2.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-[#6f665c]">余额</Text>
                  <Text className="text-sm font-semibold text-[#16181a]">${Number(user.balance ?? 0).toFixed(2)}</Text>
                </View>
              </View>

              <View className="rounded-[14px] bg-[#f7f2e9] px-3 py-2">
                <View className="mb-1.5 flex-row items-center justify-between">
                  <Text className="text-[11px] text-[#6f665c]">Keys</Text>
                  <Text className="text-[10px] text-[#8a8072]">{keyItems.length} 个</Text>
                </View>

                <View className="gap-0">
                {keyItems.map((apiKey, index) => (
                  <View
                    key={apiKey.id}
                    style={{ paddingVertical: 4 }}
                  >
                    {(() => {
                      const quota = Number(apiKey.quota ?? 0);
                      const used = Number(apiKey.quota_used ?? 0);
                      const isUnlimited = quota <= 0;
                      const progressWidth = isUnlimited ? '16%' : (`${Math.max(Math.min((used / quota) * 100, 100), 6)}%` as `${number}%`);

                        return (
                          <>
                            <View className="flex-row items-center gap-2">
                              <Text numberOfLines={1} className="flex-1 text-[11px] font-semibold text-[#16181a]">
                                {apiKey.name}
                              </Text>
                              <Text numberOfLines={1} className="text-[10px] text-[#6f665c]">
                                {isUnlimited ? `${formatQuotaValue(used)} / 无限` : `${formatQuotaValue(used)} / ${formatQuotaValue(quota)}`}
                              </Text>
                              <Pressable
                                className="rounded-full bg-[#e7dfcf] p-1.5"
                                onPress={(event) => {
                                  event.stopPropagation();
                                  void copyKey(apiKey.id, apiKey.key);
                                }}
                              >
                                <Copy color="#4e463e" size={11} />
                              </Pressable>
                            </View>

                            <View className="h-1.5 overflow-hidden rounded-full bg-[#ddd2c0]" style={{ marginTop: 3 }}>
                              <View
                                className={
                                  isUnlimited
                                    ? 'h-full rounded-full bg-[#7d7468]'
                                    : used / Math.max(quota, 1) >= 0.85
                                      ? 'h-full rounded-full bg-[#c25d35]'
                                      : used / Math.max(quota, 1) >= 0.6
                                        ? 'h-full rounded-full bg-[#d38b36]'
                                        : 'h-full rounded-full bg-[#1d5f55]'
                                }
                                style={{ width: progressWidth }}
                              />
                            </View>

                            {copiedKeyId === apiKey.id ? <Text className="text-[10px] text-[#1d5f55]" style={{ paddingTop: 3 }}>已复制</Text> : null}
                          </>
                        );
                    })()}
                  </View>
                ))}

                {keyItems.length === 0 ? (
                  <View className="py-[10px]">
                    <Text className="text-[11px] text-[#6f665c]">当前用户还没有可展示的 token 额度信息。</Text>
                  </View>
                ) : null}
                </View>
              </View>
            </View>
          </ListCard>
        </Pressable>
      );
    },
    [copiedKeyId, queryClient, sortedItems, supplementsByUserId]
  );

  const emptyState = useMemo(
    () => (
      <ListCard
        title={hasAccount ? '暂无匹配用户' : '未连接服务器'}
        meta={hasAccount ? errorMessage || '调整搜索词后再试。' : '请先前往服务器标签连接 Sub2API。'}
        icon={UserRound}
      />
    ),
    [errorMessage, hasAccount]
  );

  return (
    <ScreenShell
      title="用户管理"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">搜索结果 {sortedItems.length}</Text>}
      variant="minimal"
      scroll={false}
      bottomInsetClassName="pb-12"
    >
      <View className="flex-1">
        <View className="rounded-[16px] bg-[#fbf8f2] px-2.5 py-2.5">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-[14px] bg-[#f1ece2] px-3 py-2.5">
              <Search color="#7d7468" size={18} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="搜索邮箱或用户名"
                placeholderTextColor="#9b9081"
                className="ml-3 flex-1 text-base text-[#16181a]"
              />
            </View>
            <Pressable
              className={sortOrder === 'desc' ? 'rounded-[14px] bg-[#1d5f55] px-3 py-2.5' : 'rounded-[14px] bg-[#e7dfcf] px-3 py-2.5'}
              onPress={() => setSortOrder('desc')}
            >
              <Text className={sortOrder === 'desc' ? 'text-[11px] font-semibold text-white' : 'text-[11px] font-semibold text-[#4e463e]'}>
                最新
              </Text>
            </Pressable>
            <Pressable
              className={sortOrder === 'asc' ? 'rounded-[14px] bg-[#1d5f55] px-3 py-2.5' : 'rounded-[14px] bg-[#e7dfcf] px-3 py-2.5'}
              onPress={() => setSortOrder('asc')}
            >
              <Text className={sortOrder === 'asc' ? 'text-[11px] font-semibold text-white' : 'text-[11px] font-semibold text-[#4e463e]'}>
                最早
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-2.5 flex-1">
          <FlatList
            data={sortedItems}
            renderItem={renderItem}
            keyExtractor={(item) => `${item.id}`}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={() => <View className="h-2" />}
            ListEmptyComponent={emptyState}
            ListFooterComponent={() => <View className="h-4" />}
            ItemSeparatorComponent={() => <View className="h-3" />}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
          />
        </View>
      </View>
    </ScreenShell>
  );
}
