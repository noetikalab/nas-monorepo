import {StyleSheet} from 'react-native';
import {c, radius, spacing} from './tokens';

export const shared = StyleSheet.create({
  // Layout
  root:     {flex: 1, backgroundColor: c.background},
  centered: {flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const},

  // Typography
  title:    {fontSize: 20, fontWeight: '700' as const, color: c.foreground},
  subtitle: {fontSize: 13, color: c.mutedForeground},
  label:    {fontSize: 13, fontWeight: '500' as const, color: c.foreground, marginBottom: spacing.sm},
  hint:     {fontSize: 12, color: c.mutedForeground, textAlign: 'center' as const},

  // Input
  input: {
    alignSelf: 'stretch' as const,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.foreground,
  },

  // Button
  btn: {
    alignSelf: 'stretch' as const,
    backgroundColor: c.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  btnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const},
  btnDisabled: {opacity: 0.7},

  // Card
  card: {
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {borderColor: c.primary, backgroundColor: c.muted},

  // Separator
  separator: {height: 1, backgroundColor: c.border},

  // Empty state
  emptyBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  emptyBtnText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const},

  // Status colors (functional — keep color)
  statusOk:   {backgroundColor: '#DCFCE7', borderColor: c.success},
  statusFail: {backgroundColor: '#FEE2E2', borderColor: c.destructive},
});
