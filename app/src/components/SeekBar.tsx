import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

interface SeekBarProps {
  ratio: number;
  duration: number;
  onSeek: (seconds: number) => void;
  height?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SeekBar({ ratio, duration, onSeek, height = 6 }: SeekBarProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const widthRef = useRef(0);
  const previewRef = useRef<number | null>(null);

  const update = (x: number) => {
    if (widthRef.current <= 0) return;
    // The UI is RTL: the track starts at the right edge.
    const next = 1 - clamp(x, 0, widthRef.current) / widthRef.current;
    previewRef.current = next;
    setPreview(next);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => update(event.nativeEvent.locationX),
        onPanResponderMove: (event) => update(event.nativeEvent.locationX),
        onPanResponderRelease: () => {
          if (previewRef.current !== null && duration > 0) {
            onSeek(previewRef.current * duration);
          }
          previewRef.current = null;
          setPreview(null);
        },
        onPanResponderTerminate: () => {
          previewRef.current = null;
          setPreview(null);
        },
      }),
    [duration, onSeek]
  );

  const shown = clamp(preview ?? ratio, 0, 1);
  const pct = `${shown * 100}%` as const;
  const thumbSize = height + 8;

  return (
    <View
      style={[styles.hitArea, { height: height + 16 }]}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
      }}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="موضع التشغيل"
    >
      {/* Row children are laid out from the start edge, which is the right in RTL. */}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View style={[styles.fill, { width: pct, height, borderRadius: height / 2 }]} />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              marginStart: -thumbSize / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    backgroundColor: theme.colors.progressTrack,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    backgroundColor: theme.colors.gold,
  },
  thumb: {
    backgroundColor: theme.colors.gold,
    borderWidth: 2,
    borderColor: '#FAF9F6',
  },
});
