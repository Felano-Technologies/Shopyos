import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminUsers } from '@/services/admin';

type UserResult = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
};

type Props = {
  label?: string;
  value: string;
  onSelect: (userId: string, user: UserResult) => void;
  error?: string;
};

const ROLE_COLORS: Record<string, string> = {
  buyer: '#0C1559',
  seller: '#0E5E1A',
  driver: '#7C3AED',
  admin: '#B91C1C',
  parcel_partner: '#92400E',
};

export default function UserSearchPicker({ label = 'User', value, onSelect, error }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await getAdminUsers({ search: text, limit: 8 });
        setResults(data.users || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelect = (user: UserResult) => {
    setSelectedUser(user);
    onSelect(user.user_id, user);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedUser(null);
    onSelect('', null as any);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {selectedUser ? (
        <View style={[styles.selectedCard, error ? styles.cardError : null]}>
          <View style={styles.selectedInfo}>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[selectedUser.role] || '#64748B' }]}>
              <Text style={styles.roleText}>{selectedUser.role}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName} numberOfLines={1}>{selectedUser.full_name}</Text>
              <Text style={styles.selectedEmail} numberOfLines={1}>{selectedUser.email}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputWrap, error ? styles.inputError : null]}>
          <Ionicons name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search by name or email…"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            value={query}
            onChangeText={search}
          />
          {loading && <ActivityIndicator size="small" color="#0C1559" style={{ marginRight: 10 }} />}
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {open && results.length > 0 && !selectedUser && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(u) => u.user_id}
            keyboardShouldPersistTaps="always"
            scrollEnabled={results.length > 4}
            style={{ maxHeight: 220 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] || '#64748B' }]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{item.full_name}</Text>
                  <Text style={styles.resultEmail} numberOfLines={1}>{item.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No users found for "{query}"</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: {
    color: '#1D2B73',
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    marginBottom: 6,
    marginTop: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#1D2B73',
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
  },
  inputError: { borderColor: '#DC2626' },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0C1559',
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cardError: { borderColor: '#DC2626', backgroundColor: '#FFF5F5' },
  selectedInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedName: {
    color: '#0C1559',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  selectedEmail: {
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  clearBtn: { padding: 2 },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    marginTop: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0B2060',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  resultName: {
    color: '#1D2B73',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
  resultEmail: {
    color: '#64748B',
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  separator: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 12 },
  noResults: {
    borderWidth: 1,
    borderColor: '#D9E2F2',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 14,
    marginTop: 4,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#94A3B8',
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Montserrat-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
