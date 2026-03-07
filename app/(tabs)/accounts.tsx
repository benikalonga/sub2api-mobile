import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Search, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { getAccount, getAccountTodayStats, getDashboardTrend, listAccounts, setAccountSchedulable, testAccount } from '@/src/services/admin';

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);

  const toDate = (value: Date) => value.toISOString().slice(0, 10);

  return {
    start_date: toDate(start),
    end_date: toDate(end),
  };
}

export default function AccountsScreen() {
  const [searchText, setSearchText] = useState('');
  const keyword = useDebouncedValue(searchText.trim(), 300);
  const queryClient = useQueryClient();
  const range = getDateRange();

  const accountsQuery = useQuery({
    queryKey: ['accounts', keyword],
    queryFn: () => listAccounts(keyword),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ accountId, schedulable }: { accountId: number; schedulable: boolean }) =>
      setAccountSchedulable(accountId, schedulable),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const items = accountsQuery.data?.items ?? [];
  const errorMessage = accountsQuery.error instanceof Error ? accountsQuery.error.message : '';
  const listHeader = useMemo(
    () => (
      <View className="pb-4">
        <View className="flex-row items-center rounded-[24px] bg-[#fbf8f2] px-4 py-3">
          <Search color="#7d7468" size={18} />
          <TextInput
            defaultValue=""
            onChangeText={setSearchText}
            placeholder="搜索 key 名称"
            placeholderTextColor="#9b9081"
            className="ml-3 flex-1 text-base text-[#16181a]"
          />
        </View>
      </View>
    ),
    []
  );
  const renderItem = useCallback(
    ({ item: account }: { item: (typeof items)[number] }) => (
      <Pressable
        onPress={() => {
          void queryClient.prefetchQuery({ queryKey: ['account', account.id], queryFn: () => getAccount(account.id) });
          void queryClient.prefetchQuery({ queryKey: ['account-today-stats', account.id], queryFn: () => getAccountTodayStats(account.id) });
          void queryClient.prefetchQuery({
            queryKey: ['account-trend', account.id, range.start_date, range.end_date],
            queryFn: () => getDashboardTrend({ ...range, granularity: 'day', account_id: account.id }),
          });
          router.push(`/accounts/${account.id}`);
        }}
      >
        <ListCard
          title={account.name}
          meta={`${account.platform} · ${account.type} · 优先级 ${account.priority ?? 0}`}
          badge={account.status || 'unknown'}
          icon={KeyRound}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              {account.schedulable ? <ShieldCheck color="#7d7468" size={14} /> : <ShieldOff color="#7d7468" size={14} />}
              <Text className="text-sm text-[#7d7468]">{account.schedulable ? '可调度' : '暂停调度'}</Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                className="rounded-full bg-[#1b1d1f] px-4 py-2"
                onPress={(event) => {
                  event.stopPropagation();
                  testAccount(account.id).catch(() => undefined);
                }}
              >
                <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#f6f1e8]">测试</Text>
              </Pressable>
              <Pressable
                className="rounded-full bg-[#e7dfcf] px-4 py-2"
                onPress={(event) => {
                  event.stopPropagation();
                  toggleMutation.mutate({
                    accountId: account.id,
                    schedulable: !account.schedulable,
                  });
                }}
              >
                <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#4e463e]">切换</Text>
              </Pressable>
            </View>
          </View>
        </ListCard>
      </Pressable>
    ),
    [queryClient, range.end_date, range.start_date, toggleMutation]
  );
  const emptyState = useMemo(
    () => <ListCard title="暂无 Key" meta={errorMessage || '连上后这里会展示 key 列表。'} icon={KeyRound} />,
    [errorMessage]
  );

  return (
    <ScreenShell
      title="API 密钥"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">查看密钥状态与调度能力。</Text>}
      variant="minimal"
      scroll={false}
    >
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}`}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ItemSeparatorComponent={() => <View className="h-4" />}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
    </ScreenShell>
  );
}
