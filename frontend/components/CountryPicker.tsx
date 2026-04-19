import React, { useState, useMemo } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 1. Define the data structure
interface Country {
  cca2(cca2: any): unknown;
  callingCode: any;
  name: string;
  code: string;
  dial_code: string;
  flag: string;
}

// 2. A mini list of common countries (You can expand this list later)
const COUNTRIES: Country[] = [
  { name: 'Ghana', code: 'GH', dial_code: '+233', flag: '🇬🇭' },
  { name: 'Nigeria', code: 'NG', dial_code: '+234', flag: '🇳🇬' },
  { name: 'United States', code: 'US', dial_code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dial_code: '+44', flag: '🇬🇧' },
  { name: 'Canada', code: 'CA', dial_code: '+1', flag: '🇨🇦' },
  { name: 'South Africa', code: 'ZA', dial_code: '+27', flag: '🇿🇦' },
  { name: 'China', code: 'CN', dial_code: '+86', flag: '🇨🇳' },
  { name: 'India', code: 'IN', dial_code: '+91', flag: '🇮🇳' },
  { name: 'Togo', code: 'TG', dial_code: '+228', flag: '🇹🇬' },
  { name: 'Ivory Coast', code: 'CI', dial_code: '+225', flag: '🇨🇮' },
];

interface CountryPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
  selectedCountryCode?: string;
}

export default function CountryPicker({ visible, onClose, onSelect, selectedCountryCode }: CountryPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(country => 
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dial_code.includes(searchQuery)
    );
  }, [searchQuery]);

  const renderItem = ({ item }: { item: Country }) => (
    <TouchableOpacity 
      style={[
        styles.itemContainer, 
        selectedCountryCode === item.code && styles.selectedItem
      ]}
      onPress={() => {
        onSelect(item);
        onClose();
        setSearchQuery(''); // Reset search on close
      }}
    >
      <Text style={styles.flag}>{item.flag}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.countryName}>{item.name}</Text>
        <Text style={styles.dialCode}>{item.dial_code}</Text>
      </View>
      {selectedCountryCode === item.code && (
        <Ionicons name="checkmark-circle" size={24} color="#65A30D" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet" // Looks great on iOS
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country or code..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* List */}
        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 5,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  listContent: {
    paddingBottom: 40,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  selectedItem: {
    backgroundColor: '#F0FDF4', // Very light green background for selected
  },
  flag: {
    fontSize: 28,
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  dialCode: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});