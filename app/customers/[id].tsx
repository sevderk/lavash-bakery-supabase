import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Pencil,
    Phone,
    Trash2,
    Wallet
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    Text as RNText,
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
    Surface,
    Text,
    TextInput,
    useTheme
} from 'react-native-paper';

import { supabase } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

/** Unified transaction item for the timeline */
interface TransactionItem {
    id: string;
    type: 'order' | 'payment';
    date: string;
    amount: number;
    /** Only for orders */
    quantity?: number;
    /** Only for payments */
    note?: string | null;
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
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Edit modal state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [submittingEdit, setSubmittingEdit] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) return;

        // Fetch customer
        const { data: customerData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (customerData) setCustomer(customerData);

        // Fetch orders
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
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
                txns.push({
                    id: o.id,
                    type: 'order',
                    date: o.order_date,
                    amount: Number(o.total_price),
                    quantity: o.quantity,
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
        });

        setSubmittingPayment(false);

        if (error) {
            Alert.alert('Hata', `Tahsilat kaydedilemedi: ${error.message}`);
        } else {
            setPaymentModalVisible(false);
            setPaymentAmount('');
            setPaymentNote('');
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
        setEditModalVisible(true);
    };

    const handleEditSubmit = async () => {
        if (!editName.trim()) {
            Alert.alert('Uyarı', 'Müşteri adı boş olamaz.');
            return;
        }

        setSubmittingEdit(true);

        const { error } = await supabase
            .from('customers')
            .update({
                name: editName.trim(),
                phone: editPhone.trim() || null,
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
                        {isOrder ? `${item.quantity} Lavaş` : 'Tahsilat'}
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

                    <TextInput
                        label="Not (Opsiyonel)"
                        value={paymentNote}
                        onChangeText={setPaymentNote}
                        mode="outlined"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor="#2E7D32"
                        left={<TextInput.Icon icon="note-text" />}
                        placeholder="Örn: Nakit ödeme"
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
});
