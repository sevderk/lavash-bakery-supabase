import { useFocusEffect, useRouter } from 'expo-router';
import { ClipboardList, Minus, Plus, ShoppingBag, ShoppingCart, Tag } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    Text as RNText,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Divider,
    Modal,
    Portal,
    Surface,
    Text,
    useTheme,
} from 'react-native-paper';

import { CartItem, useOrderStore } from '@/lib/order-store';
import { supabase } from '@/lib/supabase';
import type { Customer, Product } from '@/lib/types';

// Generate a UUID v4 without external dependency
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Calculate discount amount for a customer */
function calcDiscount(subtotal: number, customer: Customer): number {
    if (!customer.discount_type || customer.discount_type === 'none' || !customer.discount_value) {
        return 0;
    }
    if (customer.discount_type === 'percentage') {
        return subtotal * (Number(customer.discount_value) / 100);
    }
    // fixed
    return Math.min(Number(customer.discount_value), subtotal);
}

export default function OrdersScreen() {
    const theme = useTheme();
    const router = useRouter();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Cart modal
    const [cartModalVisible, setCartModalVisible] = useState(false);
    const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    const { draftOrders, setCart, clearDrafts } = useOrderStore();

    // ── Fetch data ────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const [custRes, prodRes] = await Promise.all([
            supabase.from('customers').select('*').order('name', { ascending: true }),
            supabase.from('products').select('*').order('name', { ascending: true }),
        ]);

        if (custRes.error) console.error('Müşteri hatası:', custRes.error.message);
        else setCustomers(custRes.data ?? []);

        if (prodRes.error) console.error('Ürün hatası:', prodRes.error.message);
        else setProducts(prodRes.data ?? []);

        setLoading(false);
        setRefreshing(false);
    }, []);

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

    // ── Cart modal helpers ─────────────────────────────────
    const openCart = (customer: Customer) => {
        setActiveCustomer(customer);
        const existing = draftOrders[customer.id];
        if (existing && existing.items.length > 0) {
            setCartItems(existing.items.map((i) => ({ ...i })));
        } else {
            // Initialize with all products at qty 0
            setCartItems(
                products.map((p) => ({
                    productId: p.id,
                    productName: p.name,
                    quantity: 0,
                    unitPrice: Number(p.price),
                }))
            );
        }
        setCartModalVisible(true);
    };

    const closeCart = () => {
        setCartModalVisible(false);
        setActiveCustomer(null);
    };

    const updateCartQty = (productId: string, delta: number) => {
        setCartItems((prev) =>
            prev.map((item) =>
                item.productId === productId
                    ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                    : item
            )
        );
    };

    const setCartQty = (productId: string, qty: number) => {
        setCartItems((prev) =>
            prev.map((item) =>
                item.productId === productId
                    ? { ...item, quantity: Math.max(0, qty) }
                    : item
            )
        );
    };

    const cartSubtotal = useMemo(
        () => cartItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
        [cartItems]
    );

    const cartDiscount = useMemo(
        () => (activeCustomer ? calcDiscount(cartSubtotal, activeCustomer) : 0),
        [cartSubtotal, activeCustomer]
    );

    const cartTotal = cartSubtotal - cartDiscount;
    const cartHasItems = cartItems.some((i) => i.quantity > 0);

    const saveCart = () => {
        if (!activeCustomer) return;
        const active = cartItems.filter((i) => i.quantity > 0);
        if (active.length === 0) {
            // Remove draft
            const next = { ...draftOrders };
            delete next[activeCustomer.id];
            useOrderStore.setState({ draftOrders: next });
        } else {
            setCart(activeCustomer.id, active, cartDiscount);
        }
        closeCart();
    };

    // ── Summary calculations ──────────────────────────────
    const summary = useMemo(() => {
        let totalItems = 0;
        let totalAmount = 0;
        let customerCount = 0;

        for (const customer of customers) {
            const draft = draftOrders[customer.id];
            const items = draft?.items ?? [];
            if (items.length === 0) continue;

            const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
            if (sub <= 0) continue;

            customerCount++;
            totalItems += items.reduce((s, i) => s + i.quantity, 0);
            totalAmount += sub - (draft?.discountAmount ?? 0);
        }

        return { totalItems, totalAmount, customerCount };
    }, [customers, draftOrders]);

    // ── Submit batch ──────────────────────────────────────
    const handleSubmit = () => {
        if (summary.customerCount === 0) {
            Alert.alert('Uyarı', 'Sipariş girilmemiş. En az bir müşteri için ürün ekleyin.');
            return;
        }

        Alert.alert(
            'Günlüğü Onayla',
            `Toplam ${summary.totalItems} ürün, ${summary.customerCount} müşteri.\n` +
            `Genel toplam: ${formatCurrency(summary.totalAmount)}\n\n` +
            `Onaylıyor musunuz?`,
            [
                { text: 'İptal', style: 'cancel' },
                { text: 'Onayla', onPress: submitOrders },
            ]
        );
    };

    const submitOrders = async () => {
        setSubmitting(true);
        const orderGroupId = generateUUID();

        try {
            for (const customer of customers) {
                const draft = draftOrders[customer.id];
                const items = draft?.items ?? [];
                if (items.length === 0) continue;

                const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                if (subtotal <= 0) continue;

                const totalQty = items.reduce((s, i) => s + i.quantity, 0);
                const finalTotal = subtotal - (draft?.discountAmount ?? 0);

                // 1. Insert parent order
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        customer_id: customer.id,
                        quantity: totalQty,
                        unit_price: totalQty > 0 ? finalTotal / totalQty : 0,
                        total_price: finalTotal,
                        order_group_id: orderGroupId,
                    })
                    .select('id')
                    .single();

                if (orderError) {
                    console.error(`Sipariş hatası (${customer.name}):`, orderError.message);
                    Alert.alert('Hata', `${customer.name} için sipariş kaydedilemedi: ${orderError.message}`);
                    setSubmitting(false);
                    return;
                }

                // 2. Insert order_items
                const itemRows = items.map((item) => ({
                    order_id: orderData.id,
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: item.quantity * item.unitPrice,
                }));

                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(itemRows);

                if (itemsError) {
                    console.error(`Kalem hatası (${customer.name}):`, itemsError.message);
                    Alert.alert('Hata', `${customer.name} için sipariş kalemleri kaydedilemedi.`);
                    setSubmitting(false);
                    return;
                }
            }

            clearDrafts();
            setSubmitting(false);
            Alert.alert(
                'Başarılı! ✅',
                `${summary.customerCount} müşteri için ${summary.totalItems} ürün kaydedildi.`,
                [{ text: 'Tamam', onPress: () => router.replace('/(tabs)') }]
            );
        } catch (err: any) {
            setSubmitting(false);
            Alert.alert('Beklenmeyen Hata', err.message);
        }
    };

    // ── Customer row helpers ──────────────────────────────
    const getDraftSummary = (customerId: string) => {
        const draft = draftOrders[customerId];
        const items = draft?.items ?? [];
        if (items.length === 0) return null;
        const totalQty = items.reduce((s, i) => s + i.quantity, 0);
        const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        if (totalQty === 0) return null;
        return {
            totalQty,
            subtotal,
            discount: draft?.discountAmount ?? 0,
            total: subtotal - (draft?.discountAmount ?? 0),
            itemCount: items.length,
        };
    };

    // ── Render customer row ───────────────────────────────
    const renderRow = ({ item }: { item: Customer }) => {
        const draftInfo = getDraftSummary(item.id);
        const hasDebt = item.current_balance > 0;
        const rowActive = !!draftInfo;

        return (
            <TouchableOpacity onPress={() => openCart(item)} activeOpacity={0.7}>
                <Surface
                    style={[
                        styles.row,
                        {
                            backgroundColor: rowActive
                                ? (theme.dark ? '#2A2018' : '#FFF8F0')
                                : theme.colors.surface,
                            borderLeftColor: rowActive ? theme.colors.primary : 'transparent',
                        },
                    ]}
                    elevation={rowActive ? 2 : 1}
                >
                    {/* Left: customer info */}
                    <View style={styles.customerCol}>
                        <Text
                            variant="titleSmall"
                            style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                            numberOfLines={1}
                        >
                            {item.name}
                        </Text>
                        <Text
                            variant="labelSmall"
                            style={{ color: hasDebt ? '#D32F2F' : '#2E7D32' }}
                        >
                            Bakiye: {formatCurrency(item.current_balance)}
                        </Text>
                        {item.discount_type && item.discount_type !== 'none' && Number(item.discount_value) > 0 && (
                            <View style={styles.discountChip}>
                                <Tag size={10} color="#F57F17" />
                                <RNText style={styles.discountChipText}>
                                    {item.discount_type === 'percentage'
                                        ? `%${item.discount_value}`
                                        : `₺${Number(item.discount_value).toFixed(2)}`}
                                </RNText>
                            </View>
                        )}
                    </View>

                    {/* Right: cart summary or tap hint */}
                    <View style={styles.cartSummaryCol}>
                        {draftInfo ? (
                            <>
                                <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                                    {draftInfo.totalQty} ürün
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                    {formatCurrency(draftInfo.total)}
                                </Text>
                            </>
                        ) : (
                            <View style={[styles.tapHint, { backgroundColor: theme.colors.primaryContainer }]}>
                                <ShoppingCart size={16} color={theme.colors.primary} />
                            </View>
                        )}
                    </View>
                </Surface>
            </TouchableOpacity>
        );
    };

    // ── Empty state ───────────────────────────────────────
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <ShoppingBag size={64} color={theme.colors.onSurfaceVariant} strokeWidth={1} />
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
                    Henüz müşteri yok
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    Önce müşteri ekleyin
                </Text>
            </View>
        );
    };

    // ── Render cart item row in modal ─────────────────────
    const renderCartRow = (item: CartItem) => {
        const lineTotal = item.quantity * item.unitPrice;
        const isActive = item.quantity > 0;

        return (
            <View
                key={item.productId}
                style={[
                    styles.cartRow,
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

                <View style={styles.cartStepper}>
                    <TouchableOpacity
                        onPress={() => updateCartQty(item.productId, -1)}
                        style={[styles.cartStepBtn, { borderColor: theme.colors.outline }]}
                        disabled={item.quantity === 0}
                        activeOpacity={0.6}
                    >
                        <Minus size={16} color={item.quantity > 0 ? theme.colors.primary : theme.colors.outline} />
                    </TouchableOpacity>

                    <Text
                        variant="titleSmall"
                        style={{
                            width: 40,
                            textAlign: 'center',
                            color: theme.colors.onSurface,
                            fontWeight: '700',
                        }}
                    >
                        {item.quantity}
                    </Text>

                    <TouchableOpacity
                        onPress={() => updateCartQty(item.productId, 1)}
                        style={[styles.cartStepBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer }]}
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
    };

    // ── Main render ───────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header info */}
            <View style={[styles.headerBar, { backgroundColor: theme.dark ? '#251C14' : '#FFF3E6' }]}>
                <ClipboardList size={20} color={theme.colors.primary} />
                <Text variant="bodyMedium" style={{ color: theme.colors.primary, marginLeft: 8, fontWeight: '500' }}>
                    Günlük Sipariş Girişi
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 'auto' }}>
                    Müşteriye dokunun →
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                        Yükleniyor...
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={customers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRow}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[theme.colors.primary]}
                            tintColor={theme.colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />
            )}

            {/* Bottom summary bar */}
            {summary.customerCount > 0 && (
                <Surface
                    style={[styles.summaryBar, { backgroundColor: theme.dark ? '#2A2018' : '#FFF3E6' }]}
                    elevation={4}
                >
                    <View style={styles.summaryInfo}>
                        <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                            {summary.totalItems} ürün
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {summary.customerCount} müşteri · {formatCurrency(summary.totalAmount)}
                        </Text>
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={submitting}
                        style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
                        contentStyle={{ paddingVertical: 4 }}
                        labelStyle={{ fontWeight: '700' }}
                    >
                        Günlüğü Tamamla
                    </Button>
                </Surface>
            )}

            {/* Cart Modal */}
            <Portal>
                <Modal
                    visible={cartModalVisible}
                    onDismiss={closeCart}
                    contentContainerStyle={[
                        styles.cartModal,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    {activeCustomer && (
                        <>
                            <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                                {activeCustomer.name}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                                Ürün seçin ve miktarları belirleyin
                            </Text>

                            <Divider style={{ marginBottom: 8 }} />

                            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                                {cartItems.map(renderCartRow)}
                            </ScrollView>

                            <Divider style={{ marginTop: 8, marginBottom: 12 }} />

                            {/* Totals */}
                            <View style={styles.cartTotals}>
                                <View style={styles.cartTotalRow}>
                                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                        Ara Toplam
                                    </Text>
                                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                                        {formatCurrency(cartSubtotal)}
                                    </Text>
                                </View>

                                {cartDiscount > 0 && (
                                    <View style={styles.cartTotalRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Tag size={12} color="#F57F17" />
                                            <Text variant="bodyMedium" style={{ color: '#F57F17' }}>
                                                İndirim
                                                {activeCustomer.discount_type === 'percentage'
                                                    ? ` (%${activeCustomer.discount_value})`
                                                    : ` (₺${Number(activeCustomer.discount_value).toFixed(2)})`}
                                            </Text>
                                        </View>
                                        <Text variant="bodyMedium" style={{ color: '#F57F17', fontWeight: '600' }}>
                                            −{formatCurrency(cartDiscount)}
                                        </Text>
                                    </View>
                                )}

                                <View style={[styles.cartTotalRow, { marginTop: 4 }]}>
                                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                                        Toplam
                                    </Text>
                                    <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                                        {formatCurrency(cartTotal)}
                                    </Text>
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={styles.cartActions}>
                                <TouchableOpacity
                                    onPress={closeCart}
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
                                    onPress={saveCart}
                                    style={{
                                        flex: 1,
                                        height: 50,
                                        backgroundColor: theme.colors.primary,
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
                                        {cartHasItems ? 'Sepeti Kaydet' : 'Temizle'}
                                    </RNText>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </Modal>
            </Portal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 12,
        paddingBottom: 120,
        flexGrow: 1,
    },
    row: {
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
    },
    customerCol: {
        flex: 1,
        marginRight: 8,
    },
    discountChip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        backgroundColor: '#FFF8E1',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 3,
    },
    discountChipText: {
        fontSize: 10,
        color: '#F57F17',
        fontWeight: '600',
        includeFontPadding: false,
    },
    cartSummaryCol: {
        alignItems: 'flex-end',
        minWidth: 80,
    },
    tapHint: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    summaryBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    summaryInfo: {
        flex: 1,
        marginRight: 12,
    },
    submitBtn: {
        borderRadius: 12,
    },
    // Cart modal
    cartModal: {
        margin: 16,
        borderRadius: 20,
        padding: 20,
        maxHeight: '85%',
    },
    cartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginBottom: 4,
    },
    cartStepper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    cartStepBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartTotals: {
        marginBottom: 12,
    },
    cartTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cartActions: {
        flexDirection: 'row',
        marginTop: 4,
    },
});
