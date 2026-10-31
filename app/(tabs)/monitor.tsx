import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChartCard } from '@/src/components/bar-chart-card';
import { formatTokenValue } from '@/src/lib/formatters';
import { DonutChartCard } from '@/src/components/donut-chart-card';
import { LineTrendChart } from '@/src/components/line-trend-chart';
import { getAdminSettings, getDashboardModels, getDashboardStats, getDashboardTrend, listAccounts } from '@/src/services/admin';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

type RangeKey = '24h' | '7d' | '30d';

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

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

const RANGE_TITLE_MAP: Record<RangeKey, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
};

function hasAccountError(account: { status?: string; error_message?: string | null }) {
  return Boolean(account.status === 'error' || account.error_message);
}

function hasAccountRateLimited(account: {
  rate_limit_reset_at?: string | null;
  extra?: Record<string, unknown>;
}) {
  if (account.rate_limit_reset_at) {
    const resetTime = new Date(account.rate_limit_reset_at).getTime();
    if (!Number.isNaN(resetTime) && resetTime > Date.now()) {
      return true;
    }
  }

  const modelLimits = account.extra?.model_rate_limits;
  if (!modelLimits || typeof modelLimits !== 'object' || Array.isArray(modelLimits)) {
    return false;
  }

  const now = Date.now();
  return Object.values(modelLimits as Record<string, unknown>).some((info) => {
    if (!info || typeof info !== 'object' || Array.isArray(info)) return false;

    const resetAt = (info as { rate_limit_reset_at?: unknown }).rate_limit_reset_at;
    if (typeof resetAt !== 'string' || !resetAt.trim()) return false;

    const resetTime = new Date(resetAt).getTime();
    return !Number.isNaN(resetTime) && resetTime > now;
  });
}

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

function formatNumber(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `$${value.toFixed(2)}`;
}

function formatCompactNumber(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTokenDisplay(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return formatTokenValue(value);
}

function getPointLabel(value: string, rangeKey: RangeKey) {
  if (rangeKey === '24h') {
    return value.slice(11, 13);
  }

  return value.slice(5, 10);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    switch (error.message) {
      case 'BASE_URL_REQUIRED':
        return 'Set the server URL on the Servers page first.';
      case 'ADMIN_API_KEY_REQUIRED':
        return 'Set the Admin Token on the Servers page first.';
      case 'INVALID_SERVER_RESPONSE':
        return 'The service returned data in an unexpected format. Check that it is a working Sub2API admin API.';
      default:
        return error.message;
    }
  }

  return 'Unable to load overview data. Check the server URL, token and network.';
}

function Section({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{title}</Text>
          {subtitle ? <Text style={{ marginTop: 6, fontSize: 12, color: colors.subtext }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ marginTop: 14 }}>{children}</View>
    </View>
  );
}

function StatCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14 }}>
      <Text style={{ fontSize: 12, color: '#8a8072' }}>{title}</Text>
      <Text style={{ marginTop: 8, fontSize: 24, fontWeight: '700', color: colors.text }}>{value}</Text>
      {detail ? <Text style={{ marginTop: 6, fontSize: 12, color: colors.subtext }}>{detail}</Text> : null}
    </View>
  );
}

export default function MonitorScreen() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = hasAuthenticatedAdminSession(config);
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);

  const statsQuery = useQuery({
    queryKey: ['monitor-stats'],
    queryFn: getDashboardStats,
    enabled: hasAccount,
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
    enabled: hasAccount,
    staleTime: 120_000,
  });
  const accountsQuery = useQuery({
    queryKey: ['monitor-accounts'],
    queryFn: () => listAccounts(''),
    enabled: hasAccount,
    staleTime: 60_000,
  });
  const trendQuery = useQuery({
    queryKey: ['monitor-trend', rangeKey, range.start_date, range.end_date, range.granularity],
    queryFn: () => getDashboardTrend(range),
    enabled: hasAccount,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
  const modelsQuery = useQuery({
    queryKey: ['monitor-models', rangeKey, range.start_date, range.end_date],
    queryFn: () => getDashboardModels(range),
    enabled: hasAccount,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  function refetchAll() {
    statsQuery.refetch();
    settingsQuery.refetch();
    accountsQuery.refetch();
    trendQuery.refetch();
    modelsQuery.refetch();
  }

  const stats = statsQuery.data;
  const siteName = settingsQuery.data?.site_name?.trim() || 'Admin Console';
  const accounts = accountsQuery.data?.items ?? [];
  const trend = trendQuery.data?.trend ?? [];
  const topModels = (modelsQuery.data?.models ?? []).slice(0, 5);
  const errorMessage = getErrorMessage(statsQuery.error ?? settingsQuery.error ?? accountsQuery.error ?? trendQuery.error ?? modelsQuery.error);
  const currentPageErrorAccounts = accounts.filter(hasAccountError).length;
  const currentPageLimitedAccounts = accounts.filter((item) => hasAccountRateLimited(item)).length;
  const currentPageBusyAccounts = accounts.filter((item) => {
    if (hasAccountError(item) || hasAccountRateLimited(item)) return false;
    return (item.current_concurrency ?? 0) > 0;
  }).length;
  const totalAccounts = stats?.total_accounts ?? accountsQuery.data?.total ?? accounts.length;
  const aggregatedErrorAccounts = stats?.error_accounts ?? 0;
  const errorAccounts = Math.max(aggregatedErrorAccounts, currentPageErrorAccounts);
  const healthyAccounts = stats?.normal_accounts ?? Math.max(totalAccounts - errorAccounts, 0);
  const latestTrendPoints = trend.slice(-6).reverse();
  const selectedTokenTotal = trend.reduce((sum, item) => sum + item.total_tokens, 0);
  const selectedCostTotal = trend.reduce((sum, item) => sum + item.cost, 0);
  const selectedOutputTotal = trend.reduce((sum, item) => sum + item.output_tokens, 0);
  const rangeTitle = RANGE_TITLE_MAP[rangeKey];
  const isLoading = statsQuery.isLoading || settingsQuery.isLoading || accountsQuery.isLoading;
  const hasError = Boolean(statsQuery.error || settingsQuery.error || accountsQuery.error || trendQuery.error || modelsQuery.error);

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
  const totalInputTokens = useMemo(() => trend.reduce((sum, item) => sum + item.input_tokens, 0), [trend]);
  const totalOutputTokens = useMemo(() => trend.reduce((sum, item) => sum + item.output_tokens, 0), [trend]);
  const totalCacheReadTokens = useMemo(() => trend.reduce((sum, item) => sum + item.cache_read_tokens, 0), [trend]);
  const isRefreshing = statsQuery.isRefetching || settingsQuery.isRefetching || accountsQuery.isRefetching || trendQuery.isRefetching || modelsQuery.isRefetching;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refetchAll()} tintColor="#1d5f55" />}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>Overview</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: '#8a8072' }}>Current status of {siteName}.</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RANGE_OPTIONS.map((option) => {
                const active = option.key === rangeKey;
                return (
                  <Pressable
                    key={option.key}
                    style={{ backgroundColor: active ? colors.primary : colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                    onPress={() => setRangeKey(option.key)}
                  >
                    <Text style={{ color: active ? '#fff' : '#4e463e', fontSize: 12, fontWeight: '700' }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ marginTop: 8, fontSize: 12, color: colors.subtext }}>{range.start_date} to {range.end_date}</Text>
          </View>
        </View>

        {!hasAccount ? (
          <Section title="No server connected" subtitle="Set up a connection first">
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.subtext }}>Go to the Servers page, enter the server URL and Admin Token, then come back to see the overview.</Text>
            <Pressable style={{ marginTop: 14, alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }} onPress={() => router.push('/settings')}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Set up server</Text>
            </Pressable>
          </Section>
        ) : isLoading ? (
          <Section title="Loading overview" subtitle="Please wait">
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.subtext }}>Connected. Fetching overview, model and account status data.</Text>
          </Section>
        ) : hasError ? (
          <Section title="Failed to load" subtitle="Check the connection settings">
            <View style={{ borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ color: colors.danger, fontSize: 14, lineHeight: 20 }}>{errorMessage}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <Pressable style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }} onPress={refetchAll}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Retry</Text>
              </Pressable>
              <Pressable style={{ flex: 1, backgroundColor: colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }} onPress={() => router.push('/settings')}>
                <Text style={{ color: '#4e463e', fontSize: 13, fontWeight: '700' }}>Check server</Text>
              </Pressable>
            </View>
          </Section>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <StatCard
                title={`${rangeTitle} Token`}
                value={formatTokenDisplay(rangeKey === '24h' ? selectedTokenTotal || stats?.today_tokens : selectedTokenTotal)}
                detail={`Output ${formatTokenDisplay(rangeKey === '24h' ? selectedOutputTotal || stats?.today_output_tokens : selectedOutputTotal)}`}
              />
              <StatCard
                title={`${rangeTitle} cost`}
                value={formatMoney(rangeKey === '24h' ? selectedCostTotal || stats?.today_cost : selectedCostTotal)}
                detail={`TPM ${formatNumber(stats?.tpm)}`}
              />
            </View>
            <Section
              title="Accounts overview"
              subtitle="Total, healthy, error and rate-limited at a glance"
              right={(
                <Pressable
                  style={{ alignSelf: 'flex-start', backgroundColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}
                  onPress={() => router.push('/accounts/overview')}
                >
                  <Text style={{ color: '#4e463e', fontSize: 12, fontWeight: '700' }}>Account list</Text>
                </Pressable>
              )}
            >
              <Pressable onPress={() => router.push('/accounts/overview')}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: colors.mutedCard, borderRadius: 14, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#8a8072' }}>Total</Text>
                    <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.text }}>{formatNumber(totalAccounts)}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.mutedCard, borderRadius: 14, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#8a8072' }}>Healthy</Text>
                    <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.text }}>{formatNumber(healthyAccounts)}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: colors.danger }}>Error</Text>
                    <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.danger }}>{formatNumber(errorAccounts)}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: colors.mutedCard, borderRadius: 14, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#8a8072' }}>Rate-limited</Text>
                    <Text style={{ marginTop: 6, fontSize: 18, fontWeight: '700', color: colors.text }}>{formatNumber(currentPageLimitedAccounts)}</Text>
                  </View>
                </View>
                <Text style={{ marginTop: 10, fontSize: 12, color: colors.subtext }}>Total / healthy / error use backend aggregates when available; rate-limited and busy are based on the current page of accounts. Tap to open the account list.</Text>
              </Pressable>
            </Section>

            {throughputPoints.length > 1 ? (
              <LineTrendChart title="Token throughput" subtitle="Token trend for the selected time range" points={throughputPoints} color="#a34d2d" formatValue={formatTokenDisplay} />
            ) : null}

            {requestPoints.length > 1 ? (
              <LineTrendChart title="Request trend" subtitle="Request trend for the selected time range" points={requestPoints} color="#1d5f55" formatValue={formatCompactNumber} />
            ) : null}

            {costPoints.length > 1 ? (
              <LineTrendChart title="Cost trend" subtitle="Cost trend for the selected time range" points={costPoints} color="#7651c8" formatValue={formatMoney} />
            ) : null}

            <BarChartCard
              title="Token breakdown"
              subtitle="Share of input, output and cache-read tokens"
              items={[
                { label: 'Input tokens', value: totalInputTokens, color: '#1d5f55', hint: 'Tokens consumed before the request reaches the model.' },
                { label: 'Output tokens', value: totalOutputTokens, color: '#d38b36', hint: 'Tokens consumed by the model response.' },
                { label: 'Cache-read tokens', value: totalCacheReadTokens, color: '#7d7468', hint: 'Tokens reused from cache hits.' },
              ]}
              formatValue={formatTokenDisplay}
            />

            <DonutChartCard
              title="Account health"
              subtitle="Healthy, busy, rate-limited and error distribution"
              centerLabel="Total accounts"
              centerValue={formatNumber(totalAccounts)}
              segments={[
                { label: 'Healthy', value: healthyAccounts, color: '#1d5f55' },
                { label: 'Busy', value: currentPageBusyAccounts, color: '#d38b36' },
                { label: 'Rate-limited', value: currentPageLimitedAccounts, color: '#7d7468' },
                { label: 'Error', value: errorAccounts, color: '#a34d2d' },
              ]}
            />

            <BarChartCard
              title="Top models"
              subtitle="Most active models in the selected time range"
              items={topModels.map((model) => ({
                label: model.model,
                value: model.total_tokens,
                color: '#a34d2d',
                meta: `Requests ${formatNumber(model.requests)} · Cost ${formatMoney(model.cost)}`,
              }))}
              formatValue={formatCompactNumber}
            />

            <Section title="Trend summary" subtitle="Requests, tokens and cost over the latest data points">
              {latestTrendPoints.length === 0 ? (
                <Text style={{ fontSize: 14, color: colors.subtext }}>No trend data for the selected time range.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  <View style={{ gap: 10 }}>
                    {latestTrendPoints.map((point) => (
                      <View key={point.date} style={{ backgroundColor: colors.mutedCard, borderRadius: 14, padding: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{point.date}</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#8a8072' }}>Requests</Text>
                            <Text style={{ marginTop: 4, fontSize: 15, fontWeight: '700', color: colors.text }}>{formatCompactNumber(point.requests)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#8a8072' }}>Token</Text>
                            <Text style={{ marginTop: 4, fontSize: 15, fontWeight: '700', color: colors.text }}>{formatTokenDisplay(point.total_tokens)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, color: '#8a8072' }}>Cost</Text>
                            <Text style={{ marginTop: 4, fontSize: 15, fontWeight: '700', color: colors.text }}>{formatMoney(point.cost)}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Section>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
