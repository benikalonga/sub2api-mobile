import type { PropsWithChildren, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';

type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  titleAside?: ReactNode;
  right?: ReactNode;
  variant?: 'card' | 'minimal';
  scroll?: boolean;
  bottomInsetClassName?: string;
  horizontalInsetClassName?: string;
  contentGapClassName?: string;
}>;

function ScreenHeader({
  title,
  subtitle,
  titleAside,
  right,
  variant,
}: Pick<ScreenShellProps, 'title' | 'subtitle' | 'titleAside' | 'right' | 'variant'>) {
  if (variant === 'minimal') {
    return (
      <View className="mt-4 flex-row items-start justify-between gap-4 px-1 py-1">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-[20px] font-bold tracking-tight text-[#16181a]">{title}</Text>
            {titleAside}
          </View>
          {subtitle ? (
            <Text numberOfLines={1} className="mt-1 text-[11px] leading-4 text-[#a2988a]">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View className="items-end justify-start">{right}</View> : null}
      </View>
    );
  }

  return (
    <View className="mt-4 rounded-[24px] border border-[#e6dece] bg-[#fbf8f2] px-4 py-4">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="text-[24px] font-bold tracking-tight text-[#16181a]">{title}</Text>
          <Text numberOfLines={1} className="mt-1 text-xs leading-4 text-[#9a9082]">
            {subtitle}
          </Text>
        </View>
        {right}
      </View>
    </View>
  );
}

export function ScreenShell({
  title,
  subtitle,
  titleAside,
  right,
  children,
  variant = 'card',
  scroll = true,
  bottomInsetClassName = 'pb-24',
  horizontalInsetClassName = 'px-5',
  contentGapClassName = 'mt-4 gap-4',
}: ScreenShellProps) {
  if (!scroll) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4efe4]">
        <View className={`flex-1 ${horizontalInsetClassName} ${bottomInsetClassName}`}>
          <ScreenHeader title={title} subtitle={subtitle} titleAside={titleAside} right={right} variant={variant} />
          <View className={`flex-1 ${contentGapClassName}`}>{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4efe4]">
      <ScrollView className="flex-1" contentContainerClassName={`${horizontalInsetClassName} ${bottomInsetClassName}`}>
        <ScreenHeader title={title} subtitle={subtitle} titleAside={titleAside} right={right} variant={variant} />
        <View className={contentGapClassName}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
