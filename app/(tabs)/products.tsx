import { useFocusEffect } from 'expo-router';
import { Box, PackagePlus, Pencil, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    Text as RNText,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Divider,
    FAB,
    Modal,
    Portal,
    Surface,
    Text,
    TextInput,
    useTheme,
} from 'react-native-paper';

import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export default function ProductsScreen() {
    const theme = useTheme();

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formName, setFormName] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formStock, setFormStock] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchProducts = useCallback(async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Ürünler yüklenemedi:', error.message);
        } else {
            setProducts(data ?? []);
        }

        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchProducts();
        }, [fetchProducts])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchProducts();
    }, [fetchProducts]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

    // ── Open modal for Add / Edit ──────────────────────
    const openAddModal = () => {
        setEditingProduct(null);
        setFormName('');
        setFormPrice('');
        setFormStock('0');
        setModalVisible(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormName(product.name);
        setFormPrice(String(product.price));
        setFormStock(String(product.stock));
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setEditingProduct(null);
    };

    // ── Submit (Add or Edit) ───────────────────────────
    const handleSubmit = async () => {
        if (!formName.trim()) {
            Alert.alert('Uyarı', 'Ürün adı zorunludur.');
            return;
        }

        const price = parseFloat(formPrice.replace(',', '.'));
        if (isNaN(price) || price < 0) {
            Alert.alert('Uyarı', 'Geçerli bir fiyat girin.');
            return;
        }

        const stock = parseInt(formStock, 10);
        if (isNaN(stock) || stock < 0) {
            Alert.alert('Uyarı', 'Geçerli bir stok miktarı girin.');
            return;
        }

        setSubmitting(true);

        if (editingProduct) {
            // UPDATE
            const { error } = await supabase
                .from('products')
                .update({
                    name: formName.trim(),
                    price,
                    stock,
                })
                .eq('id', editingProduct.id);

            setSubmitting(false);

            if (error) {
                Alert.alert('Hata', `Güncelleme başarısız: ${error.message}`);
            } else {
                closeModal();
                setRefreshing(true);
                fetchProducts();
            }
        } else {
            // INSERT
            const { error } = await supabase.from('products').insert({
                name: formName.trim(),
                price,
                stock,
            });

            setSubmitting(false);

            if (error) {
                if (error.code === '23505') {
                    Alert.alert('Uyarı', 'Bu isimde bir ürün zaten var.');
                } else {
                    Alert.alert('Hata', `Ürün eklenemedi: ${error.message}`);
                }
            } else {
                closeModal();
                setRefreshing(true);
                fetchProducts();
            }
        }
    };

    // ── Delete ─────────────────────────────────────────
    const handleDelete = (product: Product) => {
        Alert.alert(
            'Silme Onayı',
            `"${product.name}" ürününü silmek istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('products')
                            .delete()
                            .eq('id', product.id);

                        if (error) {
                            if (error.code === '23503') {
                                Alert.alert(
                                    'Silinemez',
                                    'Bu ürün mevcut siparişlerde kullanılıyor. Silemezsiniz.'
                                );
                            } else {
                                Alert.alert('Hata', `Silme başarısız: ${error.message}`);
                            }
                        } else {
                            setRefreshing(true);
                            fetchProducts();
                        }
                    },
                },
            ]
        );
    };

    // ── Render product row ─────────────────────────────
    const renderProduct = ({ item }: { item: Product }) => (
        <Surface
            style={[styles.productRow, { backgroundColor: theme.colors.surface }]}
            elevation={1}
        >
            <View style={[styles.productIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Box size={22} color={theme.colors.primary} />
            </View>

            <View style={styles.productInfo}>
                <Text
                    variant="titleSmall"
                    style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                >
                    {item.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatCurrency(Number(item.price))}  •  Stok: {item.stock}
                </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 2 }}>
                <TouchableOpacity
                    onPress={() => openEditModal(item)}
                    style={styles.iconBtn}
                    activeOpacity={0.6}
                >
                    <Pencil size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.iconBtn}
                    activeOpacity={0.6}
                >
                    <Trash2 size={18} color="#D32F2F" />
                </TouchableOpacity>
            </View>
        </Surface>
    );

    // ── Loading state ──────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.headerIconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                        <PackagePlus size={20} color={theme.colors.primary} />
                    </View>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                        Ürün Yönetimi
                    </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {products.length} ürün
                </Text>
            </View>

            <Divider style={{ marginHorizontal: 16 }} />

            {/* Product List */}
            <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={renderProduct}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Box size={48} color={theme.colors.onSurfaceVariant} />
                        <Text
                            variant="bodyLarge"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}
                        >
                            Henüz ürün yok
                        </Text>
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                        >
                            Sağ alttaki + butonuna tıklayarak ekleyin
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

            {/* FAB */}
            <FAB
                icon={({ size, color }) => <PackagePlus size={size} color={color} />}
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={openAddModal}
                label="Ürün Ekle"
            />

            {/* Add / Edit Modal */}
            <Portal>
                <Modal
                    visible={modalVisible}
                    onDismiss={closeModal}
                    contentContainerStyle={[
                        styles.modalContent,
                        { backgroundColor: theme.colors.surface },
                    ]}
                >
                    <Text
                        variant="titleLarge"
                        style={{ color: theme.colors.onSurface, fontWeight: '700', marginBottom: 4 }}
                    >
                        {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}
                    >
                        {editingProduct
                            ? 'Ürün bilgilerini güncelleyin'
                            : 'Ürün bilgilerini girin'}
                    </Text>

                    <TextInput
                        label="Ürün Adı *"
                        value={formName}
                        onChangeText={setFormName}
                        mode="outlined"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        left={<TextInput.Icon icon="package-variant" />}
                        placeholder="Örn: Lavaş"
                    />

                    <TextInput
                        label="Fiyat (₺) *"
                        value={formPrice}
                        onChangeText={setFormPrice}
                        mode="outlined"
                        keyboardType="decimal-pad"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        left={<TextInput.Icon icon="cash" />}
                        placeholder="0.00"
                    />

                    <TextInput
                        label="Stok Miktarı"
                        value={formStock}
                        onChangeText={setFormStock}
                        mode="outlined"
                        keyboardType="number-pad"
                        style={styles.modalInput}
                        outlineColor={theme.colors.outline}
                        activeOutlineColor={theme.colors.primary}
                        left={<TextInput.Icon icon="archive" />}
                        placeholder="0"
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            onPress={closeModal}
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
                            <RNText
                                style={{
                                    color: theme.colors.onSurface,
                                    fontSize: 14,
                                    fontWeight: 'bold',
                                    includeFontPadding: false,
                                    textAlignVertical: 'center',
                                    lineHeight: 18,
                                }}
                            >
                                İptal
                            </RNText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={submitting}
                            style={{
                                flex: 1,
                                height: 50,
                                backgroundColor: submitting
                                    ? theme.colors.primaryContainer
                                    : theme.colors.primary,
                                borderRadius: 8,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <RNText
                                style={{
                                    color: 'white',
                                    fontSize: 14,
                                    fontWeight: 'bold',
                                    includeFontPadding: false,
                                    textAlignVertical: 'center',
                                    lineHeight: 18,
                                }}
                            >
                                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 100,
        flexGrow: 1,
    },
    productRow: {
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    productIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    productInfo: {
        flex: 1,
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        borderRadius: 16,
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
