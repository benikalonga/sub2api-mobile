import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Search, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { getAccount, getAccountTodayStats, getDashboardTrend, listAccounts, setAccountSchedulable, testAccount } from '@/src/services/admin';
import type { AdminAccount } from '@/src/types/admin';

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

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getAccountError(account: AdminAccount) {
  return Boolean(account.status === 'error' || account.error_message);
}

export default function AccountsScreen() {
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<'all' | 'schedulable' | 'paused' | 'error'>('all');
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
  const filteredItems = useMemo(() => {
    return items.filter((account) => {
      if (filter === 'schedulable') return account.schedulable !== false && !getAccountError(account);
      if (filter === 'paused') return account.schedulable === false && !getAccountError(account);
      if (filter === 'error') return getAccountError(account);
      return true;
    });
  }, [filter, items]);
  const errorMessage = accountsQuery.error instanceof Error ? accountsQuery.error.message : '';

  const summary = useMemo(() => {
    const total = items.length;
    const errors = items.filter(getAccountError).length;
    const paused = items.filter((item) => item.schedulable === false && !getAccountError(item)).length;
    const active = items.filter((item) => item.schedulable !== false && !getAccountError(item)).length;
    return { total, active, paused, errors };
  }, [items]);

  const listHeader = useMemo(
    () => (
      <View className="pb-4">
        <View className="rounded-[24px] bg-[#fbf8f2] p-3">
          <View className="flex-row items-center rounded-[18px] bg-[#f1ece2] px-4 py-3">
            <Search color="#7d7468" size={18} />
            <TextInput
              defaultValue=""
              onChangeText={setSearchText}
              placeholder="搜索账号名称 / 平台"
              placeholderTextColor="#9b9081"
              className="ml-3 flex-1 text-base text-[#16181a]"
            />
          </View>

          <View className="mt-3 flex-row gap-2">
            {([
              ['all', `全部 ${summary.total}`],
              ['schedulable', `可调度 ${summary.active}`],
              ['paused', `暂停 ${summary.paused}`],
              ['error', `异常 ${summary.errors}`],
            ] as const).map(([key, label]) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  className={active ? 'rounded-full bg-[#1d5f55] px-3 py-2' : 'rounded-full bg-[#e7dfcf] px-3 py-2'}
                >
                  <Text className={active ? 'text-xs font-semibold text-white' : 'text-xs font-semibold text-[#4e463e]'}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    ),
    [filter, summary.active, summary.errors, summary.paused, summary.total]
  );

  const renderItem = useCallback(
    ({ item: account }: { item: (typeof filteredItems)[number] }) => {
      const isError = getAccountError(account);
      const statusText = isError ? '异常' : account.schedulable ? '可调度' : '暂停调度';
      const groupsText = account.groups?.map((group) => group.name).filter(Boolean).slice(0, 3).join(' · ');

      return (
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
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  {account.schedulable && !isError ? <ShieldCheck color="#7d7468" size={14} /> : <ShieldOff color="#7d7468" size={14} />}
                  <Text className="text-sm text-[#7d7468]">{statusText}</Text>
                </View>
                <Text className="text-xs text-[#7d7468]">最近使用 {formatTime(account.last_used_at || account.updated_at)}</Text>
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1 rounded-[14px] bg-[#f1ece2] px-3 py-3">
                  <Text className="text-[11px] text-[#7d7468]">并发</Text>
                  <Text className="mt-1 text-sm font-bold text-[#16181a]">{account.current_concurrency ?? 0} / {account.concurrency ?? 0}</Text>
                </View>
                <View className="flex-1 rounded-[14px] bg-[#f1ece2] px-3 py-3">
                  <Text className="text-[11px] text-[#7d7468]">倍率</Text>
                  <Text className="mt-1 text-sm font-bold text-[#16181a]">{(account.rate_multiplier ?? 1).toFixed(2)}x</Text>
                </View>
              </View>

              {groupsText ? <Text className="text-xs text-[#7d7468]">分组 {groupsText}</Text> : null}
              {account.error_message ? <Text className="text-xs text-[#a4512b]">异常信息：{account.error_message}</Text> : null}

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
                  <Text className="text-xs font-semibold uppercase tracking-[1.2px] text-[#4e463e]">{account.schedulable ? '暂停' : '恢复'}</Text>
                </Pressable>
              </View>
            </View>
          </ListCard>
        </Pressable>
      );
    },
    [filteredItems, queryClient, range.end_date, range.start_date, toggleMutation]
  );

  const emptyState = useMemo(
    () => <ListCard title="暂无账号" meta={errorMessage || '连上后这里会展示账号列表。'} icon={KeyRound} />,
    [errorMessage]
  );

  return (
    <ScreenShell
      title="账号管理"
      subtitle="看单账号状态、并发、最近使用和异常信息。"
      titleAside={(
        <View className="flex-row items-center gap-2">
          <Text className="text-[11px] text-[#a2988a]">更接近网页后台的账号视图。</Text>
          <Pressable
            onPress={() => router.push('/accounts/create')}
            className="h-8 w-8 items-center justify-center rounded-[10px] bg-[#1d5f55]"
          >
            <Text className="text-xl leading-5 text-white">+</Text>
          </Pressable>
        </View>
      )}
      variant="minimal"
      scroll={false}
    >
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}`}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={accountsQuery.isRefetching} onRefresh={() => void accountsQuery.refetch()} tintColor="#1d5f55" />}
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
