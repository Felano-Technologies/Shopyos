import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import BusinessBottomNav from '../../components/BusinessBottomNav';

const OrdersScreen = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const backgroundColor = isDarkMode ? '#121212' : '#F8F8F8';
  const cardBackground = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const primaryText = isDarkMode ? '#EDEDED' : '#222';
  const secondaryText = isDarkMode ? '#AAA' : '#555';

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const orders = [
    {
      id: 'o1',
      customerName: 'John Doe',
      itemsCount: 3,
      totalAmount: 45.99,
      date: '2024-06-17T12:30:00',
      status: 'Pending',
    },
    {
      id: 'o2',
      customerName: 'Jane Smith',
      itemsCount: 1,
      totalAmount: 12.5,
      date: '2024-06-16T08:45:00',
      status: 'Delivered',
    },
    {
      id: 'o3',
      customerName: 'Mike Johnson',
      itemsCount: 2,
      totalAmount: 27.75,
      date: '2024-06-18T15:00:00',
      status: 'Pending',
    },
  ];

  const filteredOrders = filter === 'All' ? orders : orders.filter(order => order.status === filter);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <View style={styles.container}>
        <Text style={[styles.header, { color: primaryText }]}>Orders</Text>

        <View style={styles.filterRow}>
          {['All', 'Pending', 'Delivered'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setSelectedOrder(item);
                setModalVisible(true);
              }}
              style={[styles.orderCard, { backgroundColor: cardBackground }]}
            >
              <View>
                <Text style={[styles.customerName, { color: primaryText }]}>{item.customerName}</Text>
                <Text style={[styles.detailText, { color: secondaryText }]}>
                  {item.itemsCount} item(s) • ₵{item.totalAmount.toFixed(2)}
                </Text>
                <Text style={[styles.detailText, { color: secondaryText }]}>
                  {format(new Date(item.date), 'PPPpp')}
                </Text>
              </View>
              <Text
                style={[styles.statusTag, {
                  backgroundColor: item.status === 'Pending' ? '#FDE68A' : '#BBF7D0',
                  color: item.status === 'Pending' ? '#92400E' : '#166534',
                }]}
              >
                {item.status}
              </Text>
            </TouchableOpacity>
          )}
        />

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContainer, { backgroundColor: cardBackground }]}>
              {selectedOrder && (
                <>
                  <Text style={[styles.modalTitle, { color: primaryText }]}>Order Details</Text>
                  <Text style={[styles.modalText, { color: secondaryText }]}>Customer: {selectedOrder.customerName}</Text>
                  <Text style={[styles.modalText, { color: secondaryText }]}>Items: {selectedOrder.itemsCount}</Text>
                  <Text style={[styles.modalText, { color: secondaryText }]}>Amount: ₵{selectedOrder.totalAmount.toFixed(2)}</Text>
                  <Text style={[styles.modalText, { color: secondaryText }]}>Status: {selectedOrder.status}</Text>
                  <Text style={[styles.modalText, { color: secondaryText }]}>Placed on: {format(new Date(selectedOrder.date), 'PPPpp')}</Text>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>

      <BusinessBottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 13,
    color: '#374151',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
  },
  statusTag: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    padding: 20,
    borderRadius: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    marginBottom: 8,
  },
  closeBtn: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default OrdersScreen;
