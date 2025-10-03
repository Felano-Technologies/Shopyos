// app/business/orders.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Modal,
  RefreshControl,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import BusinessBottomNav from '@/components/BusinessBottomNav';

const { width } = Dimensions.get('window');

interface Order {
  id: string;
  customerName: string;
  itemsCount: number;
  totalAmount: number;
  date: string;
  status: 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';
  orderNumber: string;
  phone?: string;
  address?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

const OrdersScreen = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Processing' | 'Delivered' | 'Cancelled'>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const orders: Order[] = [
    {
      id: 'o1',
      orderNumber: 'ORD-001',
      customerName: 'John Doe',
      phone: '+233 24 123 4567',
      address: 'Kumasi, Ashanti Region',
      itemsCount: 3,
      totalAmount: 475.99,
      date: '2024-06-17T12:30:00',
      status: 'Pending',
      items: [
        { name: 'Nike Air Force 1', quantity: 1, price: 175.0 },
        { name: 'Wireless Headset', quantity: 2, price: 150.495 },
      ],
    },
    {
      id: 'o2',
      orderNumber: 'ORD-002',
      customerName: 'Jane Smith',
      phone: '+233 20 987 6543',
      address: 'Accra, Greater Accra',
      itemsCount: 1,
      totalAmount: 250.0,
      date: '2024-06-16T08:45:00',
      status: 'Delivered',
      items: [{ name: 'Abstract Art Print', quantity: 1, price: 250.0 }],
    },
    {
      id: 'o3',
      orderNumber: 'ORD-003',
      customerName: 'Mike Johnson',
      phone: '+233 54 456 7890',
      address: 'Takoradi, Western Region',
      itemsCount: 2,
      totalAmount: 295.0,
      date: '2024-06-18T15:00:00',
      status: 'Processing',
      items: [
        { name: 'Leather Jacket', quantity: 1, price: 120.0 },
        { name: 'Nike Air Force 1', quantity: 1, price: 175.0 },
      ],
    },
    {
      id: 'o4',
      orderNumber: 'ORD-004',
      customerName: 'Sarah Williams',
      phone: '+233 26 234 5678',
      address: 'Kumasi, Ashanti Region',
      itemsCount: 1,
      totalAmount: 89.99,
      date: '2024-06-15T10:20:00',
      status: 'Cancelled',
      items: [{ name: 'Wireless Headset', quantity: 1, price: 89.99 }],
    },
  ];

  const filteredOrders = filter === 'All' ? orders : orders.filter(order => order.status === filter);

  // Calculate stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const totalRevenue = orders
    .filter(o => o.status === 'Delivered')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'Pending':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'Processing':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'Delivered':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Cancelled':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        return { bg: '#E5E7EB', text: '#374151' };
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'Pending':
        return 'time-outline';
      case 'Processing':
        return 'hourglass-outline';
      case 'Delivered':
        return 'checkmark-circle-outline';
      case 'Cancelled':
        return 'close-circle-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const statusColors = getStatusColor(item.status);
    
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedOrder(item);
          setModalVisible(true);
        }}
        style={styles.orderCardWrapper}
      >
        <BlurView
          intensity={100}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[
            styles.orderCard,
            { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
          ]}
        >
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={[styles.orderNumber, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                {item.orderNumber}
              </Text>
              <Text style={[styles.customerName, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {item.customerName}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Ionicons name={getStatusIcon(item.status) as any} size={14} color={statusColors.text} />
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.orderDetailItem}>
              <Ionicons name="cart-outline" size={16} color={isDarkMode ? '#AAA' : '#666'} />
              <Text style={[styles.detailText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {item.itemsCount} item{item.itemsCount > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.orderDetailItem}>
              <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#AAA' : '#666'} />
              <Text style={[styles.detailText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {format(new Date(item.date), 'MMM dd, yyyy')}
              </Text>
            </View>
          </View>

          <View style={styles.orderFooter}>
            <Text style={[styles.totalAmount, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
              ₵{item.totalAmount.toFixed(2)}
            </Text>
            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="chevron-forward" size={16} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0F0F1A', '#1A1A2E'] : ['#FDFBFB', '#EBEDEE']}
      style={{ flex: 1 }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} translucent backgroundColor="transparent" />

      <Animated.ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [-100, 0, 100],
                    outputRange: [-50, 0, 30],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            Orders
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#AAA' : '#666' }]}>
            Manage your customer orders
          </Text>
        </Animated.View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'receipt-outline', color: '#2563EB', bg: '#DBEAFE', label: 'Total', value: totalOrders },
            { icon: 'time-outline', color: '#D97706', bg: '#FEF3C7', label: 'Pending', value: pendingOrders },
            { icon: 'checkmark-circle-outline', color: '#059669', bg: '#D1FAE5', label: 'Delivered', value: deliveredOrders },
            { icon: 'cash-outline', color: '#7C3AED', bg: '#EDE9FE', label: 'Revenue', value: `₵${totalRevenue.toFixed(0)}` },
          ].map((stat, idx) => (
            <BlurView
              key={idx}
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.statCard,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: isDarkMode ? stat.color + '40' : stat.bg }]}>
                <Ionicons name={stat.icon as any} size={20} color={stat.color} />
              </View>
              <Text style={[styles.statNumber, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: isDarkMode ? '#AAA' : '#666' }]}>
                {stat.label}
              </Text>
            </BlurView>
          ))}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['All', 'Pending', 'Processing', 'Delivered', 'Cancelled'] as const).map((f) => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}>
                <BlurView
                  intensity={40}
                  tint={isDarkMode ? 'dark' : 'light'}
                  style={[
                    styles.filterBtn,
                    {
                      backgroundColor: filter === f
                        ? 'rgba(79, 70, 229, 0.2)'
                        : isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === f ? '#4F46E5' : (isDarkMode ? '#AAA' : '#666') },
                    ]}
                  >
                    {f}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Orders List */}
        <View style={styles.ordersSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
            {filter} Orders ({filteredOrders.length})
          </Text>

          {filteredOrders.length > 0 ? (
            <FlatList
              data={filteredOrders}
              keyExtractor={item => item.id}
              renderItem={renderOrder}
              scrollEnabled={false}
              contentContainerStyle={styles.ordersList}
            />
          ) : (
            <BlurView
              intensity={100}
              tint={isDarkMode ? 'dark' : 'light'}
              style={[
                styles.emptyState,
                { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.6)' : 'rgba(255,255,255,0.6)' }
              ]}
            >
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text style={[styles.emptyStateText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                No {filter.toLowerCase()} orders
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: isDarkMode ? '#AAA' : '#666' }]}>
                Orders will appear here once customers place them
              </Text>
            </BlurView>
          )}
        </View>
      </Animated.ScrollView>

      {/* Order Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={80}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.modalBlur}
          >
            <View style={[
              styles.modalContainer,
              { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)' }
            ]}>
              {selectedOrder && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={[styles.modalTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                        Order Details
                      </Text>
                      <Text style={[styles.modalOrderNumber, { color: isDarkMode ? '#AAA' : '#666' }]}>
                        {selectedOrder.orderNumber}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={isDarkMode ? '#EDEDED' : '#222'} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.modalSection, { borderBottomColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                    <Text style={[styles.modalSectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                      Customer Information
                    </Text>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="person-outline" size={18} color={isDarkMode ? '#AAA' : '#666'} />
                      <Text style={[styles.modalText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                        {selectedOrder.customerName}
                      </Text>
                    </View>
                    {selectedOrder.phone && (
                      <View style={styles.modalInfoRow}>
                        <Ionicons name="call-outline" size={18} color={isDarkMode ? '#AAA' : '#666'} />
                        <Text style={[styles.modalText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                          {selectedOrder.phone}
                        </Text>
                      </View>
                    )}
                    {selectedOrder.address && (
                      <View style={styles.modalInfoRow}>
                        <Ionicons name="location-outline" size={18} color={isDarkMode ? '#AAA' : '#666'} />
                        <Text style={[styles.modalText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                          {selectedOrder.address}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.modalSection, { borderBottomColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                    <Text style={[styles.modalSectionTitle, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                      Order Items
                    </Text>
                    {selectedOrder.items?.map((item, idx) => (
                      <View key={idx} style={styles.orderItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.itemName, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                            {item.name}
                          </Text>
                          <Text style={[styles.itemQuantity, { color: isDarkMode ? '#AAA' : '#666' }]}>
                            Qty: {item.quantity}
                          </Text>
                        </View>
                        <Text style={[styles.itemPrice, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                          ₵{item.price.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.modalSection}>
                    <View style={styles.modalInfoRow}>
                      <Text style={[styles.modalText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                        Status:
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status).bg }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.status).text }]}>
                          {selectedOrder.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={[styles.modalText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                        Order Date:
                      </Text>
                      <Text style={[styles.modalText, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                        {format(new Date(selectedOrder.date), 'PPPpp')}
                      </Text>
                    </View>
                    <View style={[styles.totalRow, { borderTopColor: isDarkMode ? '#333' : '#E5E7EB' }]}>
                      <Text style={[styles.totalLabel, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                        Total Amount
                      </Text>
                      <Text style={[styles.totalValue, { color: isDarkMode ? '#EDEDED' : '#222' }]}>
                        ₵{selectedOrder.totalAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.actionButton} onPress={() => setModalVisible(false)}>
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      style={styles.actionButtonGradient}
                    >
                      <Text style={styles.actionButtonText}>Update Status</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>

      <BusinessBottomNav />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ordersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  ordersList: {
    paddingBottom: 20,
  },
  orderCardWrapper: {
    marginBottom: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderDetails: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  orderDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 13,
    marginLeft: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
    marginRight: 4,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBlur: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 2,
  },
  modalOrderNumber: {
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  modalSection: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  actionButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrdersScreen;