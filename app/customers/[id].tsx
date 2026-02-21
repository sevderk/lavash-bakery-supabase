import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Minus,
    Pencil,
    Phone,
    Plus,
    Tag,
    Trash2,
    Wallet
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    Text as RNText,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Card,
    Divider,
    Modal,
    Portal,
    SegmentedButtons,
    Surface,
    Text,
    TextInput,
    useTheme
} from 'react-native-paper';

import { supabase } from '@/lib/supabase';
import type { Customer, DiscountType } from '@/lib/types';

/** Unified transaction item for the timeline */
interface TransactionItem {
    id: string;
    type: 'order' | 'payment';
    date: string;
    amount: number;
    /** Only for orders */
    quantity?: number;
    /** Only for orders — product breakdown text */
    productSummary?: string;
    /** Only for payments */
    note?: string | null;
    /** Only for payments */
    paymentMethod?: string;
}

/** Order item for editing */
interface EditOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}

export default function CustomerDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Payment modal state
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Nakit');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editDiscountType, setEditDiscountType] = useState<DiscountType>('none');
    const [editDiscountValue, setEditDiscountValue] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);

    // Edit order modal state
    const [editOrderModalVisible, setEditOrderModalVisible] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [editOrderItems, setEditOrderItems] = useState<EditOrderItem[]>([]);
    const [submittingOrderEdit, setSubmittingOrderEdit] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;

        // Fetch customer
        const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (customerData) setCustomer(customerData);

        // Fetch orders with order_items and product names
        const { data: orders } = await supabase
            .from('orders')
            .select('*, order_items(quantity, unit_price, product_id, products(name))')
            .eq('customer_id', id)
            .order('order_date', { ascending: false });

        // Fetch payments
        const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('customer_id', id)
            .order('payment_date', { ascending: false });

        // Merge into unified timeline
        const txns: TransactionItem[] = [];

        if (orders) {
            for (const o of orders) {
                // Build product summary from order_items
                const items: { name: string; qty: number }[] = ((o as any).order_items ?? []).map((oi: any) => ({
                    name: oi.products?.name ?? '?',
                    qty: oi.quantity ?? 0,
                }));
                const productSummary = items.length > 0
                    ? items.map((i) => `${i.qty}x ${i.name}`).join(', ')
                    : `${o.quantity} Adet`;

                txns.push({
                    id: o.id,
                    type: 'order',
                    date: o.order_date,
                    amount: Number(o.total_price),
                    quantity: o.quantity,
                    productSummary,
                });
            }
        }

        if (payments) {
            for (const p of payments) {
                txns.push({
                    id: p.id,
                    type: 'payment',
                    date: p.payment_date,
                    amount: Number(p.amount),
                    note: p.note,
                    paymentMethod: p.payment_method ?? 'Nakit',
                });
            }
        }

        // Sort newest first
        txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(txns);

        setLoading(false);
        setRefreshing(false);
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchData();
        }, [fetchData])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // ── Submit Payment ─────────────────────────────────
    const handlePaymentSubmit = async () => {
        const amount = parseFloat(paymentAmount.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Uyarı', 'Geçerli bir tutar girin.');
            return;
        }

        setSubmittingPayment(true);

        const { error } = await supabase.from('payments').insert({
            customer_id: id,
            amount,
            note: paymentNote.trim() || null,
            payment_method: paymentMethod,
        });

        setSubmittingPayment(false);

        if (error) {
            Alert.alert('Hata', `Tahsilat kaydedilemedi: ${error.message}`);
        } else {
            setPaymentModalVisible(false);
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentMethod('Nakit');
            // Refresh to show updated balance and transaction
            setRefreshing(true);
            fetchData();
        }
    };

    // ── Edit Customer ──────────────────────────────────
    const openEditModal = () => {
        if (!customer) return;
        setEditName(customer.name);
        setEditPhone(customer.phone ?? '');
        setEditDiscountType((customer.discount_type as DiscountType) ?? 'none');
        setEditDiscountValue(
            customer.discount_type !== 'none' && customer.discount_value
                ? String(customer.discount_value)
                : ''
        );
        setEditModalVisible(true);
    };

    const handleEditSubmit = async () => {
        if (!editName.trim()) {
            Alert.alert('Uyarı', 'Müşteri adı boş olamaz.');
            return;
        }

        setSubmittingEdit(true);

        const parsedDiscount = editDiscountType !== 'none'
            ? parseFloat(editDiscountValue.replace(',', '.')) || 0
            : 0;

        const { error } = await supabase
            .from('customers')
            .update({
                name: editName.trim(),
                phone: editPhone.trim() || null,
                discount_type: editDiscountType,
                discount_value: parsedDiscount,
            })
            .eq('id', id);

        setSubmittingEdit(false);

        if (error) {
            Alert.alert('Hata', `Güncelleme başarısız: ${error.message}`);
        } else {
            setEditModalVisible(false);
            // Refresh data to reflect changes
            setRefreshing(true);
            fetchData();
        }
    };

    // ── Delete Customer ────────────────────────────────
    const handleDelete = () => {
        Alert.alert(
            'Silme Onayı',
            'Bu müşteriyi silmek istediğinize emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('customers')
                                .delete()
                                .eq('id', id);

                            if (error) {
                                console.error('Delete Error:', error);
                                // Check for Foreign Key constraint (Postgres error code 23503)
                                if (error.code === '23503') {
                                    Alert.alert(
                                        'Silinemez',
                                        'Bu müşterinin geçmiş siparişleri veya ödemeleri var. Veri bütünlüğü için silemezsiniz.'
                                    );
                                } else {
                                    Alert.alert('Hata', 'Silme işlemi başarısız: ' + error.message);
                                }
                                return;
                            }

                            // Success
                            Alert.alert('Başarılı', 'Müşteri silindi.', [
                                { text: 'Tamam', onPress: () => router.back() },
                            ]);
                        } catch (err) {
                            console.error('Unexpected delete error:', err);
                            Alert.alert('Beklenmeyen Hata', 'Bir sorun oluştu.');
                        }
                    },
                },
            ]
        );
    };

    // ── Edit Order ──────────────────────────────────────
    const openEditOrderModal = async (orderId: string) => {
        // Fetch order_items with products for this order
        const { data: items, error } = await supabase
            .from('order_items')
            .select('quantity, unit_price, product_id, products(name)')
            .eq('order_id', orderId);

        if (error || !items) {
            Alert.alert('Hata', 'Sipariş kalemleri yüklenemedi.');
            return;
        }

        const editItems: EditOrderItem[] = items.map((oi: any) => ({
            productId: oi.product_id,
            productName: oi.products?.name ?? '?',
            quantity: oi.quantity ?? 0,
            unitPrice: Number(oi.unit_price),
        }));

        // Also fetch all products to allow adding new items
        const { data: allProducts } = await supabase
            .from('products')
            .select('*')
            .order('name', { ascending: true });

        if (allProducts) {
            for (const p of allProducts) {
                if (!editItems.find((ei) => ei.productId === p.id)) {
                    editItems.push({
                        productId: p.id,
                        productName: p.name,
                        quantity: 0,
                        unitPrice: Number(p.price),
                    });
                }
            }
        }

        setEditOrderItems(editItems);
        setEditingOrderId(orderId);
        setEditOrderModalVisible(true);
    };

    const updateEditOrderQty = (productId: string, delta: number) => {
        setEditOrderItems((prev) =>
            prev.map((item) =>
                item.productId === productId
                    ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                    : item
            )
        );
    };

    const editOrderTotal = editOrderItems.reduce(
        (sum, i) => sum + i.quantity * i.unitPrice,
        0
    );

    const handleEditOrderSubmit = async () => {
        if (!editingOrderId) return;

        const activeItems = editOrderItems.filter((i) => i.quantity > 0);
        if (activeItems.length === 0) {
            Alert.alert('Uyarı', 'En az bir ürün seçmelisiniz.');
            return;
        }

        setSubmittingOrderEdit(true);

        try {
            // 1. Delete existing order_items
            const { error: delError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', editingOrderId);

            if (delError) {
                Alert.alert('Hata', `Eski kalemler silinemedi: ${delError.message}`);
                setSubmittingOrderEdit(false);
                return;
            }

            // 2. Insert new order_items
            const newItems = activeItems.map((item) => ({
                order_id: editingOrderId,
                product_id: item.productId,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.quantity * item.unitPrice,
            }));

            const { error: insError } = await supabase
                .from('order_items')
                .insert(newItems);

            if (insError) {
                Alert.alert('Hata', `Yeni kalemler eklenemedi: ${insError.message}`);
                setSubmittingOrderEdit(false);
                return;
            }

            // 3. Update orders.total_price (triggers balance correction)
            const totalQty = activeItems.reduce((s, i) => s + i.quantity, 0);
            const { error: updError } = await supabase
                .from('orders')
                .update({
                    quantity: totalQty,
                    unit_price: totalQty > 0 ? editOrderTotal / totalQty : 0,
                    total_price: editOrderTotal,
                })
                .eq('id', editingOrderId);

            if (updError) {
                Alert.alert('Hata', `Sipariş güncellenemedi: ${updError.message}`);
                setSubmittingOrderEdit(false);
                return;
            }

            setSubmittingOrderEdit(false);
            setEditOrderModalVisible(false);
            setEditingOrderId(null);
            setRefreshing(true);
            fetchData();
        } catch (err: any) {
            setSubmittingOrderEdit(false);
            Alert.alert('Beklenmeyen Hata', err.message);
        }
    };

    // ── Header Right Icons ─────────────────────────────
    const renderHeaderRight = () => (
        <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity
                onPress={openEditModal}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                activeOpacity={0.6}
            >
                <Pencil size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={handleDelete}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                activeOpacity={0.6}
            >
                <Trash2 size={20} color="#D32F2F" />
            </TouchableOpacity>
        </View>
    );

    // ── Render transaction item ────────────────────────
    const renderTransaction = ({ item }: { item: TransactionItem }) => {
        const isOrder = item.type === 'order';

        return (
            <Surface
                style={[
                    styles.txnRow,
                    {
                        backgroundColor: theme.colors.surface,
                        borderLeftColor: isOrder ? theme.colors.primary : '#2E7D32',
                    },
                ]}
                elevation={1}
            >
                <View style={[styles.txnIcon, { backgroundColor: isOrder ? theme.colors.primaryContainer : '#E8F5E9' }]}>
                    {isOrder ? (
                        <ArrowUpCircle size={22} color={theme.colors.primary} />
                    ) : (
                        <ArrowDownCircle size={22} color="#2E7D32" />
                    )}
                </View>

                <View style={styles.txnInfo}>
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                    >
                        {isOrder
                            ? (item.productSummary ?? `${item.quantity} Adet`)
                            : `${item.paymentMethod === 'Kredi Kartı' ? '💳' : item.paymentMethod === 'Havale/EFT' ? '🏦' : '💵'} ${item.paymentMethod ?? 'Nakit'}`
                        }
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {formatDate(item.date)}
                    </Text>
                    {item.note && (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
                            {item.note}
                        </Text>
                    )}
                </View>

                <Text
                    variant="titleSmall"
                    style={{
                        color: isOrder ? '#D32F2F' : '#2E7D32',
                        fontWeight: '700',
                    }}
                >
                    {isOrder ? '+' : '−'}{formatCurrency(item.amount)}
                </Text>

                {isOrder && (
                    <TouchableOpacity
                        onPress={() => openEditOrderModal(item.id)}
                        style={{ marginLeft: 8 }}
                        activeOpacity={0.6}
                    >
                        <Pencil size={16} color={theme.colors.onSurfaceVariant} />
                    </TouchableOpacity>
                )}
            </Surface>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!customer) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                    Müşteri bulunamadı
                </Text>
            </View>
        );
    }

    const hasDebt = customer.current_balance > 0;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Dynamic header with Edit/Delete icons */}
            <Stack.Screen
                options={{
                    title: customer.name,
                    headerRight: renderHeaderRight,
                }}
            />

            {/* Customer Header Card */}
            <Card style={[styles.headerCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
                <Card.Content>
                    <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                        {customer.name}
                    </Text>

                    {customer.phone && (
                        <View style={styles.phoneRow}>
                            <Phone size={14} color={theme.colors.onSurfaceVariant} />
                            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 6 }}>
                                {customer.phone}
                            </Text>
                        </View>
                    )}

                    {customer.discount_type && customer.discount_type !== 'none' && customer.discount_value > 0 && (
                        <View style={styles.discountBadge}>
                            <Tag size={14} color="#F57F17" />
                            <Text variant="bodySmall" style={{ color: '#F57F17', fontWeight: '600', marginLeft: 4 }}>
                                {customer.discount_type === 'percentage'
                                    ? `%${customer.discount_value} İndirim`
                                    : `₺${Number(customer.discount_value).toFixed(2)} İndirim`}
                            </Text>
                        </View>
                    )}

                    <Divider style={{ marginVertical: 12 }} />

                    <View style={styles.balanceRow}>
                        <View style={[styles.balanceIcon, { backgroundColor: hasDebt ? '#FFEBEE' : '#E8F5E9' }]}>
                            <Wallet size={24} color={hasDebt ? '#D32F2F' : '#2E7D32'} />
                        </View>
                        <View>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                Güncel Bakiye
                            </Text>
                            <Text
                                variant="headlineMedium"
                                style={{
                                    color: hasDebt ? '#D32F2F' : '#2E7D32',
                                    fontWeight: '800',
                                }}
                            >
                                {formatCurrency(customer.current_balance)}
                            </Text>
                        </View>
                    </View>

                    {/* Payment Button */}
                    <TouchableOpacity
                        onPress={() => setPaymentModalVisible(true)}
                        style={{
                            height: 50,
                            backgroundColor: '#2E7D32',
                            borderRadius: 8,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 0,
                            marginTop: 16,
                        }}
                        activeOpacity={0.7}
                    >
                        <RNText style={{
                            color: 'white',
                            fontSize: 16,
                            fontWeight: 'bold',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                            lineHeight: 20,
                        }}>
                            💰  Tahsilat Ekle
                        </RNText>
                    </TouchableOpacity>
                </Card.Content>
            </Card>

            {/* Transactions Title */}
            <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                    İşlem Geçmişi
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {transactions.length} işlem
                </Text>
            </View>

            {/* Transaction List */}
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderTransaction}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyTxn}>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            Henüz işlem yok
                        </Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.colors.primary]}
                        tintColor={theme.colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            />

            {/* Payment Modal */}
            <Portal>
                <Modal
                    visible={paymentModalVisible}
                    onDismiss={() => setPaymentModalVisible(false)}
                    contentContainerStyle={[
                        styles.modalContent,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '700', marginBottom: 4 }}>
                        Tahsilat Ekle
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
                        {customer.name} için ödeme kaydı
                    </Text>

                    <TextInput
                        label="Tutar (₺) *"
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        mode="outlined"
                        keyboardType="decimal-pad"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor="#2E7D32"
                        left={<TextInput.Icon icon="cash" />}
                        placeholder="0.00"
                    />

                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600', marginBottom: 8 }}
                    >
                        Ödeme Yöntemi
                    </Text>
                    <SegmentedButtons
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                        buttons={[
                            { value: 'Nakit', label: '💵 Nakit' },
                            { value: 'Kredi Kartı', label: '💳 Kart' },
                            { value: 'Havale/EFT', label: '🏦 Havale' },
                        ]}
                        style={{ marginBottom: 16 }}
                    />

                    <TextInput
                        label="Açıklama (Opsiyonel)"
                        value={paymentNote}
                        onChangeText={setPaymentNote}
                        mode="outlined"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor="#2E7D32"
                        left={<TextInput.Icon icon="note-text" />}
                        placeholder="Örn: Haftalık tahsilat"
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            onPress={() => setPaymentModalVisible(false)}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                borderColor: theme.colors.outline,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: theme.colors.onSurface,
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                İptal
                            </RNText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handlePaymentSubmit}
                            disabled={submittingPayment}
                            style={{
                                flex: 1,
                                height: 50,
                                backgroundColor: submittingPayment ? '#81C784' : '#2E7D32',
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                {submittingPayment ? 'Kaydediliyor...' : 'Kaydet'}
                            </RNText>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </Portal>

            {/* Edit Customer Modal */}
            <Portal>
                <Modal
                    visible={editModalVisible}
                    onDismiss={() => setEditModalVisible(false)}
                    contentContainerStyle={[
                        styles.modalContent,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '700', marginBottom: 4 }}>
                        Müşteri Düzenle
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
                        Bilgileri güncelleyin
                    </Text>

                    <TextInput
                        label="Müşteri Adı *"
                        value={editName}
                        onChangeText={setEditName}
                        mode="outlined"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        left={<TextInput.Icon icon="account" />}
                        placeholder="Örn: Ahmet Yılmaz"
                    />

                    <TextInput
                        label="Telefon Numarası"
                        value={editPhone}
                        onChangeText={setEditPhone}
                        mode="outlined"
                        style={styles.modalInput}
                        keyboardType="phone-pad"
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        left={<TextInput.Icon icon="phone" />}
                        placeholder="Örn: 0532 123 45 67"
                    />

                    {/* Discount Section */}
                    <Divider style={{ marginVertical: 12 }} />
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600', marginBottom: 12 }}
                    >
                        İndirim Bilgisi
                    </Text>

                    <SegmentedButtons
                        value={editDiscountType}
                        onValueChange={(val) => setEditDiscountType(val as DiscountType)}
                        buttons={[
                            { value: 'none', label: 'Yok' },
                            { value: 'percentage', label: '% Yüzde' },
                            { value: 'fixed', label: '₺ Sabit' },
                        ]}
                        style={{ marginBottom: 16 }}
                    />

                    {editDiscountType !== 'none' && (
                        <TextInput
                            label={editDiscountType === 'percentage' ? 'İndirim Oranı (%)' : 'İndirim Tutarı (₺)'}
                            value={editDiscountValue}
                            onChangeText={setEditDiscountValue}
                            mode="outlined"
                            style={styles.modalInput}
                            keyboardType="decimal-pad"
                            outlineColor={theme.colors.outline}
                            activeOutlineColor={theme.colors.primary}
                            left={<TextInput.Icon icon={editDiscountType === 'percentage' ? 'percent' : 'cash-minus'} />}
                            placeholder={editDiscountType === 'percentage' ? 'Örn: 10' : 'Örn: 1.50'}
                        />
                    )}

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            onPress={() => setEditModalVisible(false)}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                borderColor: theme.colors.outline,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: theme.colors.onSurface,
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                İptal
                            </RNText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleEditSubmit}
                            disabled={submittingEdit}
                            style={{
                                flex: 1,
                                height: 50,
                                backgroundColor: submittingEdit ? theme.colors.primaryContainer : theme.colors.primary,
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                {submittingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                            </RNText>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </Portal>

            {/* Edit Order Modal */}
            <Portal>
                <Modal
                    visible={editOrderModalVisible}
                    onDismiss={() => setEditOrderModalVisible(false)}
                    contentContainerStyle={[styles.editOrderModal, { backgroundColor: theme.colors.surface }]}
                >
                    <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                        Siparişi Düzenle
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                        Miktarları değiştirin ve kaydedin
                    </Text>

                    <Divider style={{ marginBottom: 8 }} />

                    <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                        {editOrderItems.map((item) => {
                            const lineTotal = item.quantity * item.unitPrice;
                            const isActive = item.quantity > 0;
                            return (
                                <View
                                    key={item.productId}
                                    style={[
                                        styles.editOrderRow,
                                        {
                                            backgroundColor: isActive
                                                ? (theme.dark ? '#2A2018' : '#FFF8F0')
                                                : theme.colors.surface,
                                        },
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                            {item.productName}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {formatCurrency(item.unitPrice)} / adet
                                        </Text>
                                    </View>

                                    <View style={styles.editOrderStepper}>
                                        <TouchableOpacity
                                            onPress={() => updateEditOrderQty(item.productId, -1)}
                                            style={[styles.editOrderStepBtn, { borderColor: theme.colors.outline }]}
                                            disabled={item.quantity === 0}
                                            activeOpacity={0.6}
                                        >
                                            <Minus size={16} color={item.quantity > 0 ? theme.colors.primary : theme.colors.outline} />
                                        </TouchableOpacity>

                                        <Text
                                            variant="titleSmall"
                                            style={{ width: 40, textAlign: 'center', color: theme.colors.onSurface, fontWeight: '700' }}
                                        >
                                            {item.quantity}
                                        </Text>

                                        <TouchableOpacity
                                            onPress={() => updateEditOrderQty(item.productId, 1)}
                                            style={[styles.editOrderStepBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer }]}
                                            activeOpacity={0.6}
                                        >
                                            <Plus size={16} color={theme.colors.primary} />
                                        </TouchableOpacity>
                                    </View>

                                    <Text
                                        variant="bodySmall"
                                        style={{
                                            width: 70,
                                            textAlign: 'right',
                                            color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant,
                                            fontWeight: isActive ? '700' : '400',
                                        }}
                                    >
                                        {isActive ? formatCurrency(lineTotal) : '—'}
                                    </Text>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <Divider style={{ marginTop: 8, marginBottom: 12 }} />

                    <View style={styles.editOrderTotalRow}>
                        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                            Toplam
                        </Text>
                        <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                            {formatCurrency(editOrderTotal)}
                        </Text>
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            onPress={() => setEditOrderModalVisible(false)}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 8,
                                borderWidth: 1.5,
                                borderColor: theme.colors.outline,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: theme.colors.onSurface,
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                İptal
                            </RNText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleEditOrderSubmit}
                            disabled={submittingOrderEdit}
                            style={{
                                flex: 1,
                                height: 50,
                                backgroundColor: submittingOrderEdit ? theme.colors.primaryContainer : theme.colors.primary,
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText style={{
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 18,
                            }}>
                                {submittingOrderEdit ? 'Kaydediliyor...' : 'Kaydet'}
                            </RNText>
                        </TouchableOpacity>
                    </View>
                </Modal>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCard: {
        margin: 16,
        marginBottom: 8,
        borderRadius: 16,
        elevation: 3,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    discountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#FFF8E1',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    balanceIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        flexGrow: 1,
    },
    txnRow: {
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
    },
    txnIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    txnInfo: {
        flex: 1,
    },
    emptyTxn: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    modalContent: {
        margin: 20,
        borderRadius: 20,
        padding: 24,
    },
    modalInput: {
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 8,
    },
    editOrderModal: {
        margin: 16,
        borderRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    editOrderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginBottom: 4,
    },
    editOrderStepper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    editOrderStepBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editOrderTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
});
