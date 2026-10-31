import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Layers3, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';

import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { listGroups } from '@/src/services/admin';

export default function GroupsScreen() {
  const [searchText, setSearchText] = useState('');
  const keyword = useDebouncedValue(searchText.trim(), 300);

  const groupsQuery = useQuery({
    queryKey: ['groups', keyword],
    queryFn: () => listGroups(keyword),
  });

  const items = groupsQuery.data?.items ?? [];
  const errorMessage = groupsQuery.error instanceof Error ? groupsQuery.error.message : '';
  const listHeader = useMemo(
    () => (
      <View className="pb-4">
        <View className="flex-row items-center rounded-[24px] bg-[#fbf8f2] px-4 py-3">
          <Search color="#7d7468" size={18} />
          <TextInput
            defaultValue=""
            onChangeText={setSearchText}
            placeholder="Search group name"
            placeholderTextColor="#9b9081"
            className="ml-3 flex-1 text-base text-[#16181a]"
          />
        </View>
      </View>
    ),
    []
  );
  const renderItem = useCallback(
    ({ item: group }: { item: (typeof items)[number] }) => (
      <ListCard
        title={group.name}
        meta={`${group.platform} · Rate ${group.rate_multiplier ?? 1} · ${group.subscription_type || 'standard'}`}
        badge={group.status || 'active'}
        icon={FolderKanban}
      >
        <View className="flex-row items-center gap-2">
          <Layers3 color="#7d7468" size={14} />
          <Text className="text-sm text-[#7d7468]">
            Accounts {group.account_count ?? 0} · {group.is_exclusive ? 'Exclusive group' : 'Shared group'}
          </Text>
        </View>
      </ListCard>
    ),
    []
  );
  const emptyState = useMemo(
    () => <ListCard title="No groups" meta={errorMessage || 'Once connected to Sub2API, groups will appear here.'} icon={FolderKanban} />,
    [errorMessage]
  );

  return (
    <ScreenShell
      title="Groups"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">View groups and scheduling ownership.</Text>}
      variant="minimal"
      scroll={false}
    >
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}`}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={groupsQuery.isRefetching} onRefresh={() => void groupsQuery.refetch()} tintColor="#1d5f55" />}
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
