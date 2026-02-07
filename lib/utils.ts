/**
 * Utils Barrel Export
 *
 * Re-exports all utility functions from focused sub-modules.
 * This ensures backward compatibility - all existing imports from '@/lib/utils'
 * continue to work without modification.
 *
 * Sub-modules:
 * - timezone.ts: Israel timezone constants, conversion, day boundaries, date comparison
 * - slots.ts: Time slot normalization, slot keys, slot comparison
 * - date-formatting.ts: Date/time formatting, time slot generation, date utilities
 * - hebrew.ts: Hebrew number formatting, day names, opening hours display
 * - barber-slugs.ts: Slug generation, validation, URL building
 * - cn.ts: CSS class name combiner
 * - formatting.ts: Price formatting, ID generation
 */

export * from './utils/timezone'
export * from './utils/slots'
export * from './utils/date-formatting'
export * from './utils/hebrew'
export * from './utils/barber-slugs'
export * from './utils/cn'
export * from './utils/formatting'
