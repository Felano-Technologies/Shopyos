import { StyleSheet } from 'react-native';

// Shared style constants for all admin screens.
// Usage: import { sh, STATUS_PILL, HERO_COLORS } from '@/components/admin/adminSharedStyles';
// Spread into any local StyleSheet: cardSection: { ...sh.card, marginTop: 8 }
// or use directly: style={sh.card}

export const sh = StyleSheet.create({
  // ── Surfaces ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0C1559',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },

  // ── Icon bubble ───────────────────────────────────────────────────────────
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleSm: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── List row ──────────────────────────────────────────────────────────────
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowItemLast: {
    borderBottomWidth: 0,
  },

  // ── Card header ───────────────────────────────────────────────────────────
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardTitle: {
    color: '#0C1559',
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
  cardLink: {
    color: '#2563EB',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
  },

  // ── Typography ────────────────────────────────────────────────────────────
  h1: { color: '#0F172A', fontSize: 22, fontFamily: 'Montserrat-Bold' },
  h2: { color: '#0F172A', fontSize: 18, fontFamily: 'Montserrat-Bold' },
  h3: { color: '#0F172A', fontSize: 15, fontFamily: 'Montserrat-Bold' },
  body: { color: '#374151', fontSize: 14, fontFamily: 'Montserrat-Regular' },
  bodySm: { color: '#374151', fontSize: 13, fontFamily: 'Montserrat-Regular' },
  caption: { color: '#94A3B8', fontSize: 12, fontFamily: 'Montserrat-Regular' },
  label: { color: '#64748B', fontSize: 12, fontFamily: 'Montserrat-SemiBold' },
  labelSm: { color: '#64748B', fontSize: 11, fontFamily: 'Montserrat-SemiBold' },

  // ── Status badge ──────────────────────────────────────────────────────────
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'capitalize',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    opacity: 0.35,
  },
  emptyTitle: {
    color: '#374151',
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
  },
  emptyBody: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
  },

  // ── Page scaffold ─────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  pageBody: {
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 12,
  },

  // ── Filter chip row ───────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0C1559',
    borderColor: '#0C1559',
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#0F172A',
  },

  // ── Hero compact (sub-pages) ──────────────────────────────────────────────
  heroCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  heroBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },

  // ── Form fields ───────────────────────────────────────────────────────────
  fieldLabel: {
    color: '#374151',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: '#0F172A',
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
  },
});

// ── Status pill config ────────────────────────────────────────────────────────
export const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  delivered:   { bg: '#DCFCE7', text: '#16A34A' },
  completed:   { bg: '#DCFCE7', text: '#16A34A' },
  approved:    { bg: '#DCFCE7', text: '#16A34A' },
  verified:    { bg: '#DCFCE7', text: '#16A34A' },
  active:      { bg: '#DBEAFE', text: '#2563EB' },
  processing:  { bg: '#DBEAFE', text: '#2563EB' },
  in_transit:  { bg: '#DBEAFE', text: '#2563EB' },
  pending:     { bg: '#FEF3C7', text: '#D97706' },
  suspended:   { bg: '#FEF3C7', text: '#D97706' },
  cancelled:   { bg: '#FEE2E2', text: '#DC2626' },
  rejected:    { bg: '#FEE2E2', text: '#DC2626' },
  banned:      { bg: '#FEE2E2', text: '#DC2626' },
  failed:      { bg: '#FEE2E2', text: '#DC2626' },
  paid:        { bg: '#DCFCE7', text: '#16A34A' },
  shipped:     { bg: '#DBEAFE', text: '#2563EB' },
  refunded:    { bg: '#F3E8FF', text: '#7C3AED' },
};

// ── Hero gradient (all screens) ───────────────────────────────────────────────
export const HERO_COLORS = ['#01217B', '#0C2E8A', '#0E5E1A'] as const;

// ── Common accent palettes for metric/stat cards ──────────────────────────────
export const ACCENTS = {
  green:  { bg: '#DCFCE7', icon: '#16A34A', bar: '#16A34A' },
  blue:   { bg: '#DBEAFE', icon: '#2563EB', bar: '#2563EB' },
  violet: { bg: '#EDE9FE', icon: '#7C3AED', bar: '#7C3AED' },
  amber:  { bg: '#FEF3C7', icon: '#D97706', bar: '#D97706' },
  slate:  { bg: '#F1F5F9', icon: '#475569', bar: '#475569' },
  cyan:   { bg: '#CFFAFE', icon: '#0891B2', bar: '#0891B2' },
  rose:   { bg: '#FFE4E6', icon: '#E11D48', bar: '#E11D48' },
  navy:   { bg: '#EEF2FF', icon: '#3730A3', bar: '#3730A3' },
};
