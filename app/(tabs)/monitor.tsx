import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Coins, Gauge, RefreshCw, Rows3, Wrench, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { BarChartCard } from '@/src/components/bar-chart-card';
import { DonutChartCard } from '@/src/components/donut-chart-card';
import { LineTrendChart } from '@/src/components/line-trend-chart';
import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useScreenInteractive } from '@/src/hooks/use-screen-interactive';
import { formatTokenValue } from '@/src/lib/formatters';
import { getAdminSettings, getDashboardModels, getDashboardStats, getDashboardTrend, listAccounts } from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

type RangeKey = '24h' | '7d' | '30d';

function getDateRange(rangeKey: RangeKey) {
  const end = new Date();
  const start = new Date();

  if (rangeKey === '24h') {
    start.setHours(end.getHours() - 23, 0, 0, 0);
  } else if (rangeKey === '30d') {
    start.setDate(end.getDate() - 29);
  } else {
    start.setDate(end.getDate() - 6);
  }

  const toDate = (value: Date) => value.toISOString().slice(0, 10);

  return {
    start_date: toDate(start),
    end_date: toDate(end),
    granularity: rangeKey === '24h' ? ('hour' as const) : ('day' as const),
  };
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

function getPointLabel(value: string, rangeKey: RangeKey) {
  if (rangeKey === '24h') {
    return value.slice(11, 13);
  }

  return value.slice(5, 10);
}

export default function MonitorScreen() {
  useScreenInteractive('monitor_interactive');
  const config = useSnapshot(adminConfigState);
  const { width } = useWindowDimensions();
  const contentWidth = Math.max(width - 24, 280);
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);
  const hasAccount = Boolean(config.baseUrl.trim());

  const statsQuery = useQuery({
    queryKey: ['monitor-stats'],
    queryFn: getDashboardStats,
    enabled: hasAccount,
  });

  const trendQuery = useQuery({
    queryKey: ['monitor-trend', rangeKey, range.start_date, range.end_date, range.granularity],
    queryFn: () => getDashboardTrend(range),
    enabled: hasAccount,
  });

  const modelsQuery = useQuery({
    queryKey: ['monitor-models', rangeKey, range.start_date, range.end_date],
    queryFn: () => getDashboardModels(range),
    enabled: hasAccount,
  });

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
    enabled: hasAccount,
  });

  const accountsQuery = useQuery({
    queryKey: ['monitor-accounts'],
    queryFn: () => listAccounts(''),
    enabled: hasAccount,
  });

  const stats = statsQuery.data;
  const trend = trendQuery.data?.trend ?? [];
  const accounts = accountsQuery.data?.items ?? [];
  const siteName = settingsQuery.data?.site_name?.trim() || '管理控制台';
  const throughputPoints = useMemo(
    () => trend.map((item) => ({ label: getPointLabel(item.date, rangeKey), value: item.total_tokens })),
    [rangeKey, trend]
  );
  const requestPoints = useMemo(
    () => trend.map((item) => ({ label: getPointLabel(item.date, rangeKey), value: item.requests })),
    [rangeKey, trend]
  );
  const costPoints = useMemo(
    () => trend.map((item) => ({ label: getPointLabel(item.date, rangeKey), value: item.cost })),
    [rangeKey, trend]
  );
  const topModels = useMemo(() => (modelsQuery.data?.models ?? []).slice(0, 5), [modelsQuery.data?.models]);
  const incidentAccounts = useMemo(
    () => accounts.filter((item) => item.status === 'error' || item.error_message).slice(0, 5),
    [accounts]
  );
  const totalInputTokens = useMemo(() => trend.reduce((sum, item) => sum + item.input_tokens, 0), [trend]);
  const totalOutputTokens = useMemo(() => trend.reduce((sum, item) => sum + item.output_tokens, 0), [trend]);
  const totalCacheReadTokens = useMemo(() => trend.reduce((sum, item) => sum + item.cache_read_tokens, 0), [trend]);
  const busyAccounts = useMemo(
    () => accounts.filter((item) => (item.current_concurrency ?? 0) > 0 && item.status !== 'error' && !item.error_message).length,
    [accounts]
  );
  const pausedAccounts = useMemo(
    () => accounts.filter((item) => item.schedulable === false && item.status !== 'error' && !item.error_message).length,
    [accounts]
  );
  const errorAccounts = useMemo(
    () => accounts.filter((item) => item.status === 'error' || item.error_message).length,
    [accounts]
  );
  const healthyAccounts = Math.max(accounts.length - busyAccounts - pausedAccounts - errorAccounts, 0);
  const summaryCards = [
    {
      label: 'Token',
      value: stats ? formatTokenValue(stats.today_tokens ?? 0) : '--',
      icon: Zap,
      tone: 'dark' as const,
    },
    {
      label: '成本',
      value: stats ? `$${Number(stats.today_cost ?? 0).toFixed(2)}` : '--',
      icon: Coins,
    },
    {
      label: '输出',
      value: stats ? formatTokenValue(stats.today_output_tokens ?? 0) : '--',
      icon: Rows3,
    },
    {
      label: '账号',
      value: String(accounts.length || stats?.total_accounts || 0),
      detail: `${errorAccounts} 异常 / ${pausedAccounts} 暂停`,
      icon: Rows3,
    },
    {
      label: 'TPM',
      value: String(stats?.tpm ?? '--'),
      icon: Gauge,
    },
    {
      label: '健康',
      value: String(healthyAccounts),
      detail: `${busyAccounts} 繁忙`,
      icon: AlertTriangle,
    },
  ];
  const summaryRows = [0, 3].map((index) => summaryCards.slice(index, index + 3));
  const useMasonry = Platform.OS === 'web' || width >= 640;
  const summaryCardWidth = Math.floor((contentWidth - 16) / 3);

  const cards = [
    {
      key: 'throughput',
      node: throughputPoints.length > 1 ? (
        <LineTrendChart
          title="Token 吞吐"
          subtitle="整体负载曲线"
          points={throughputPoints}
          color="#a34d2d"
          formatValue={formatTokenValue}
          compact={useMasonry}
        />
      ) : null,
    },
    {
      key: 'requests',
      node: requestPoints.length > 1 ? (
        <LineTrendChart
          title="请求趋势"
          subtitle="调用波峰变化"
          points={requestPoints}
          color="#1d5f55"
          compact={useMasonry}
        />
      ) : null,
    },
    {
      key: 'cost',
      node: costPoints.length > 1 ? (
        <LineTrendChart
          title="成本趋势"
          subtitle="花费变化"
          points={costPoints}
          color="#7651c8"
          formatValue={(value) => `$${value.toFixed(2)}`}
          compact={useMasonry}
        />
      ) : null,
    },
    {
      key: 'token-structure',
      node: (
        <BarChartCard
          title="Token 结构"
          subtitle="输入、输出、缓存读占比"
          items={[
            {
              label: '输入 Token',
              value: totalInputTokens,
              color: '#1d5f55',
              hint: '输入 Token 指请求进入模型前消耗的 token，通常由提示词、上下文和历史消息组成。',
            },
            {
              label: '输出 Token',
              value: totalOutputTokens,
              color: '#d38b36',
              hint: '输出 Token 指模型返回内容消耗的 token，越长通常代表生成内容越多、成本越高。',
            },
            {
              label: '缓存读取 Token',
              value: totalCacheReadTokens,
              color: '#7d7468',
              hint: '缓存读取 Token 表示命中缓存后复用的 token，数值越高通常意味着缓存策略更有效。',
            },
          ]}
          formatValue={formatTokenValue}
        />
      ),
    },
    {
      key: 'health',
      node: (
        <DonutChartCard
          title="账号健康"
          subtitle="健康、繁忙、暂停、异常"
          centerLabel="总账号"
          centerValue={String(accounts.length || stats?.total_accounts || 0)}
          segments={[
            { label: '健康', value: healthyAccounts, color: '#1d5f55' },
            { label: '繁忙', value: busyAccounts, color: '#d38b36' },
            { label: '暂停', value: pausedAccounts, color: '#7d7468' },
            { label: '异常', value: errorAccounts, color: '#a34d2d' },
          ]}
        />
      ),
    },
    {
      key: 'models',
      node: (
        <BarChartCard
          title="热点模型"
          subtitle="模型负载分布"
          items={topModels.map((item) => ({
            label: item.model,
            value: item.total_tokens,
            color: '#a34d2d',
            meta: `请求 ${item.requests} · 成本 $${Number(item.cost).toFixed(2)}`,
          }))}
          formatValue={formatTokenValue}
        />
      ),
    },
    {
      key: 'incidents',
      node: (
        <ListCard title="排障列表" meta="优先关注状态异常或带错误信息的上游账号" icon={Wrench}>
          <View className="gap-3">
            {incidentAccounts.map((item) => (
              <View key={item.id} className="rounded-[18px] bg-[#f1ece2] px-4 py-3">
                <Text className="text-sm font-semibold text-[#16181a]">{item.name}</Text>
                <Text className="mt-1 text-xs text-[#7d7468]">{item.platform} · {item.status || 'unknown'} · {item.schedulable ? '可调度' : '暂停调度'}</Text>
                <Text className="mt-2 text-xs text-[#a34d2d]">{item.error_message || '状态异常，建议从运维视角继续排查这个上游账号'}</Text>
              </View>
            ))}
            {incidentAccounts.length === 0 ? <Text className="text-sm text-[#7d7468]">当前没有检测到异常账号。</Text> : null}
          </View>
        </ListCard>
      ),
    },
  ].filter((item) => item.node);

  const leftColumn = cards.filter((_, index) => index % 2 === 0);
  const rightColumn = cards.filter((_, index) => index % 2 === 1);

  return (
    <ScreenShell
      title="概览"
      subtitle=""
      titleAside={<Text className="text-[11px] text-[#a2988a]">{siteName} 的关键运行指标。</Text>}
      variant="minimal"
      horizontalInsetClassName="px-3"
      contentGapClassName="mt-3 gap-2"
      right={
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center rounded-full bg-[#ece3d6] p-1">
            {RANGE_OPTIONS.map((item) => {
              const active = item.key === rangeKey;

              return (
                <Pressable
                  key={item.key}
                  className={active ? 'rounded-full bg-[#1d5f55] px-3 py-1.5' : 'rounded-full bg-transparent px-3 py-1.5'}
                  onPress={() => setRangeKey(item.key)}
                >
                  <Text className={active ? 'text-[10px] font-semibold uppercase leading-4 tracking-[1px] text-white' : 'text-[10px] font-semibold uppercase leading-4 tracking-[1px] text-[#7d7468]'}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-[#2d3134]"
            onPress={() => {
              statsQuery.refetch();
              trendQuery.refetch();
              modelsQuery.refetch();
              accountsQuery.refetch();
              settingsQuery.refetch();
            }}
          >
            <RefreshCw color="#f6f1e8" size={16} />
          </Pressable>
        </View>
      }
    >
      <View className="gap-2">
        {summaryRows.map((row, rowIndex) => (
          <View key={`summary-row-${rowIndex}`} className="flex-row gap-2">
            {row.map((item) => {
              const Icon = item.icon;

              return (
                <View
                  key={item.label}
                  className={item.tone === 'dark' ? 'rounded-[18px] bg-[#1d5f55] px-2.5 py-2.5' : 'rounded-[18px] bg-[#fbf8f2] px-2.5 py-2.5'}
                  style={{ width: summaryCardWidth }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className={item.tone === 'dark' ? 'text-[10px] uppercase tracking-[1.1px] text-[#d8efe7]' : 'text-[10px] uppercase tracking-[1.1px] text-[#8a8072]'}>
                      {item.label}
                    </Text>
                    <Icon color={item.tone === 'dark' ? '#d8efe7' : '#7d7468'} size={13} />
                  </View>
                  <Text className={item.tone === 'dark' ? 'mt-2 text-[17px] font-bold text-white' : 'mt-2 text-[17px] font-bold text-[#16181a]'}>
                    {item.value}
                  </Text>
                  {'detail' in item && item.detail ? (
                    <Text numberOfLines={1} className={item.tone === 'dark' ? 'mt-1 text-[10px] text-[#d8efe7]' : 'mt-1 text-[10px] text-[#8a8072]'}>
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {useMasonry ? (
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-3">
            {leftColumn.map((item) => (
              <View key={item.key}>{item.node}</View>
            ))}
          </View>
          <View className="flex-1 gap-3">
            {rightColumn.map((item) => (
              <View key={item.key}>{item.node}</View>
            ))}
          </View>
        </View>
      ) : (
        cards.map((item) => <View key={item.key}>{item.node}</View>)
      )}
    </ScreenShell>
  );
}
