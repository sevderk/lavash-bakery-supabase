import * as Clipboard from 'expo-clipboard';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/src/legacy';
import * as Print from 'expo-print';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    FileText,
    MessageCircle
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
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
    Divider,
    IconButton,
    Surface,
    Text,
    useTheme,
} from 'react-native-paper';
import * as XLSX from 'xlsx';

import { supabase } from '@/lib/supabase';

/** An order row joined with customer name */
interface ReportRow {
    id: string;
    customerName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    status: string;
    productSummary: string;
}

export default function ReportsScreen() {
    const theme = useTheme();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── Date helpers ───────────────────────────────────
    const formatDateTR = (d: Date) =>
        d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    const formatDateShort = (d: Date) =>
        d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const isToday = (d: Date) => {
        const now = new Date();
        return d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
    };

    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        // Don't allow future dates
        if (d > new Date()) return;
        setSelectedDate(d);
    };

    // ── Fetch orders for selected date ─────────────────
    const fetchOrders = useCallback(async () => {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
            .from('orders')
            .select('id, quantity, unit_price, total_price, status, customer_id, customers(name), order_items(quantity, products(name))')
            .gte('order_date', dayStart.toISOString())
            .lte('order_date', dayEnd.toISOString())
            .order('customers(name)', { ascending: true });

        if (error) {
            console.error('Rapor yükleme hatası:', error.message);
            setRows([]);
        } else {
            const mapped: ReportRow[] = (data ?? []).map((o: any) => {
                // Build product summary from order_items
                const items: { name: string; qty: number }[] = (o.order_items ?? []).map((oi: any) => ({
                    name: oi.products?.name ?? '?',
                    qty: oi.quantity ?? 0,
                }));
                const productSummary = items.length > 0
                    ? items.map((i) => `${i.qty}x ${i.name}`).join(', ')
                    : `${o.quantity} Adet`;

                return {
                    id: o.id,
                    customerName: o.customers?.name ?? 'Bilinmeyen',
                    quantity: o.quantity,
                    unitPrice: Number(o.unit_price),
                    totalPrice: Number(o.total_price),
                    status: o.status,
                    productSummary,
                };
            });
            setRows(mapped);
        }

        setLoading(false);
        setRefreshing(false);
    }, [selectedDate]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchOrders();
        }, [fetchOrders])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchOrders();
    }, [fetchOrders]);

    // ── Summary ────────────────────────────────────────
    const summary = useMemo(() => {
        let totalQty = 0;
        let totalAmount = 0;
        for (const r of rows) {
            totalQty += r.quantity;
            totalAmount += r.totalPrice;
        }
        return { totalQty, totalAmount, count: rows.length };
    }, [rows]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

    const statusLabel = (s: string) => (s === 'delivered' ? 'Ödendi' : 'Ödenmedi');

    // ── Excel Export ───────────────────────────────────
    const handleExcelExport = async () => {
        if (rows.length === 0) {
            Alert.alert('Uyarı', 'Dışa aktarılacak sipariş bulunamadı.');
            return;
        }

        try {
            const wsData = [
                ['Müşteri', 'Ürünler', 'Toplam', 'Durum'],
                ...rows.map((r) => [
                    r.customerName,
                    r.productSummary,
                    r.totalPrice,
                    statusLabel(r.status),
                ]),
                [],
                ['TOPLAM', `${summary.totalQty} Adet`, summary.totalAmount, ''],
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Column widths
            ws['!cols'] = [
                { wch: 25 }, // Müşteri
                { wch: 30 }, // Ürünler
                { wch: 12 }, // Toplam
                { wch: 15 }, // Durum
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Dağıtım');

            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const fileName = `dagitim_${formatDateShort(selectedDate).replace(/\./g, '-')}.xlsx`;
            const filePath = `${cacheDirectory}${fileName}`;

            await writeAsStringAsync(filePath, wbout, {
                encoding: EncodingType.Base64,
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Dağıtım Listesini Paylaş',
                });
            } else {
                Alert.alert('Bilgi', 'Paylaşım bu cihazda desteklenmiyor.');
            }
        } catch (err: any) {
            console.error('Excel hatası:', err);
            Alert.alert('Hata', `Excel oluşturulamadı: ${err.message}`);
        }
    };

    // ── WhatsApp List ──────────────────────────────────
    const handleWhatsAppList = async () => {
        if (rows.length === 0) {
            Alert.alert('Uyarı', 'Paylaşılacak sipariş bulunamadı.');
            return;
        }

        const dateStr = formatDateShort(selectedDate);
        let text = `📅 ${dateStr} Dağıtım Listesi\n\n`;

        for (const r of rows) {
            text += `${r.customerName}: ${r.productSummary}\n`;
        }

        text += `=============\n`;
        text += `Toplam: ${summary.totalQty} Adet\n`;
        text += `Ciro: ${formatCurrency(summary.totalAmount)}`;

        try {
            await Clipboard.setStringAsync(text);
            Alert.alert(
                'Kopyalandı! 📋',
                'Dağıtım listesi panoya kopyalandı. WhatsApp\'a yapıştırabilirsiniz.',
                [{ text: 'Tamam' }]
            );
        } catch (err: any) {
            console.error('Pano hatası:', err);
            Alert.alert('Hata', 'Panoya kopyalanamadı.');
        }
    };

    // ── PDF Export ─────────────────────────────────────
    const handleExportPDF = async () => {
        if (rows.length === 0) {
            Alert.alert('Uyarı', 'Dışa aktarılacak sipariş bulunamadı.');
            return;
        }

        const dateStr = formatDateShort(selectedDate);

        const html = `
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2E7D32; padding-bottom: 10px; }
      .header h1 { margin: 0; color: #2E7D32; font-size: 24px; }
      .header p { margin: 5px 0 0; color: #666; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-size: 14px; }
      td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-size: 14px; }
      tr:nth-child(even) { background-color: #fafafa; }
      .footer { margin-top: 20px; padding-top: 10px; border-top: 2px solid #eee; }
      .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 16px; }
      .total-amount { color: #2E7D32; font-size: 18px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Lavaş Fırını Dağıtım Listesi</h1>
      <p>${dateStr}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 30%">Müşteri</th>
          <th style="width: 50%">Ürünler</th>
          <th style="width: 20%; text-align: right;">Toplam</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.customerName}</td>
            <td>${r.productSummary}</td>
            <td style="text-align: right;">${formatCurrency(r.totalPrice)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer">
      <div class="summary-row">
        <span>Toplam Sipariş:</span>
        <span>${summary.count} Müşteri</span>
      </div>
      <div class="summary-row">
        <span>Toplam Üretim:</span>
        <span>${summary.totalQty} Adet</span>
      </div>
      <div class="summary-row total-amount">
        <span>Genel Toplam:</span>
        <span>${formatCurrency(summary.totalAmount)}</span>
      </div>
    </div>
  </body>
</html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err: any) {
            console.error('PDF hatası:', err);
            Alert.alert('Hata', `PDF oluşturulamadı: ${err.message}`);
        }
    };

    // ── Render row ─────────────────────────────────────
    const renderRow = ({ item }: { item: ReportRow }) => {
        const isDelivered = item.status === 'delivered';

        return (
            <Surface
                style={[styles.row, { backgroundColor: theme.colors.surface }]}
                elevation={1}
            >
                <View style={styles.rowLeft}>
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.onSurface, fontWeight: '600' }}
                        numberOfLines={1}
                    >
                        {item.customerName}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {item.productSummary}
                    </Text>
                </View>

                <View style={styles.rowRight}>
                    <Text
                        variant="titleSmall"
                        style={{ color: theme.colors.primary, fontWeight: '700' }}
                    >
                        {formatCurrency(item.totalPrice)}
                    </Text>
                    <View style={{
                        height: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 8,
                        borderRadius: 12,
                        backgroundColor: isDelivered ? '#E8F5E9' : '#FFF3E0',
                    }}>
                        <RNText style={{
                            fontSize: 10,
                            color: isDelivered ? '#2E7D32' : '#E65100',
                            fontWeight: 'bold',
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                            lineHeight: 12,
                        }}>
                            {statusLabel(item.status)}
                        </RNText>
                    </View>
                </View>
            </Surface>
        );
    };

    // ── Empty state ────────────────────────────────────
    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Calendar size={56} color={theme.colors.onSurfaceVariant} strokeWidth={1} />
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
                    Bu tarihte sipariş yok
                </Text>
            </View>
        );
    };

    // ── Main render ────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Date Navigation */}
            <Surface style={[styles.dateBar, { backgroundColor: theme.dark ? '#251C14' : '#FFF3E6' }]} elevation={2}>
                <IconButton
                    icon={() => <ChevronLeft size={22} color={theme.colors.primary} />}
                    onPress={() => shiftDate(-1)}
                    size={22}
                />
                <View style={styles.dateCenter}>
                    <Calendar size={16} color={theme.colors.primary} />
                    <Text
                        variant="titleSmall"
                        style={{
                            color: theme.colors.primary,
                            fontWeight: '600',
                            marginLeft: 6,
                            textAlignVertical: 'center',
                            includeFontPadding: false,
                            paddingTop: 0,
                            marginTop: 0,
                        }}
                    >
                        {formatDateTR(selectedDate)}
                    </Text>
                    {isToday(selectedDate) && (
                        <View style={{
                            marginLeft: 8,
                            height: 24,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingHorizontal: 8,
                            borderRadius: 12,
                            backgroundColor: '#D2691E',
                        }}>
                            <RNText style={{
                                fontSize: 12,
                                color: '#FFFFFF',
                                fontWeight: 'bold',
                                includeFontPadding: false,
                                textAlignVertical: 'center',
                                lineHeight: 14,
                            }}>
                                Bugün
                            </RNText>
                        </View>
                    )}
                </View>
                <IconButton
                    icon={() => <ChevronRight size={22} color={isToday(selectedDate) ? theme.colors.outline : theme.colors.primary} />}
                    onPress={() => shiftDate(1)}
                    disabled={isToday(selectedDate)}
                    size={22}
                />
            </Surface>

            {/* Summary Strip */}
            {rows.length > 0 && (
                <View style={[styles.summaryStrip, { backgroundColor: theme.dark ? '#1A1210' : '#FFFAF5' }]}>
                    <View style={styles.summaryItem}>
                        <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '800' }}>
                            {summary.totalQty}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Toplam Adet</Text>
                    </View>
                    <Divider style={{ width: 1, height: 32 }} />
                    <View style={styles.summaryItem}>
                        <Text variant="headlineSmall" style={{ color: '#2E7D32', fontWeight: '800' }}>
                            {formatCurrency(summary.totalAmount)}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Toplam Ciro</Text>
                    </View>
                    <Divider style={{ width: 1, height: 32 }} />
                    <View style={styles.summaryItem}>
                        <Text variant="headlineSmall" style={{ color: '#1565C0', fontWeight: '800' }}>
                            {summary.count}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Sipariş</Text>
                    </View>
                </View>
            )}

            {/* Order List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={rows}
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
                />
            )}

            {/* Export Buttons */}
            {rows.length > 0 && (
                <Surface
                    style={[styles.exportBar, { backgroundColor: theme.dark ? '#2A2018' : '#FFF3E6' }]}
                    elevation={4}
                >
                    <TouchableOpacity
                        onPress={handleExcelExport}
                        style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: '#1B5E20',
                            borderRadius: 8,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                        activeOpacity={0.7}
                    >
                        <FileSpreadsheet size={18} color="white" style={{ marginRight: 6 }} />
                        <RNText style={{
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 'bold',
                            lineHeight: 18,
                        }}>
                            Excel
                        </RNText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleExportPDF}
                        style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: '#D32F2F',
                            borderRadius: 8,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 0,
                        }}
                        activeOpacity={0.7}
                    >
                        <FileText size={18} color="white" style={{ marginRight: 6 }} />
                        <RNText style={{
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 'bold',
                            lineHeight: 18,
                        }}>
                            PDF
                        </RNText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleWhatsAppList}
                        style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: '#25D366',
                            borderRadius: 8,
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 0,
                        }}
                        activeOpacity={0.7}
                    >
                        <MessageCircle size={18} color="white" style={{ marginRight: 6 }} />
                        <RNText style={{
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 'bold',
                            lineHeight: 18,
                        }}>
                            WhatsApp
                        </RNText>
                    </TouchableOpacity>
                </Surface>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    dateBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 0,
        height: 50,
    },
    dateCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryStrip: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    summaryItem: {
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: 12,
        paddingBottom: 100,
        flexGrow: 1,
    },
    row: {
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowLeft: {
        flex: 1,
        marginRight: 8,
    },
    rowRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    exportBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
});
