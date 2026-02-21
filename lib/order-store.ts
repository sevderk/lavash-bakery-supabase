import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** A single product line in the cart */
export interface CartItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}

/** Draft for a single customer */
export interface DraftOrderRow {
    items: CartItem[];
    discountAmount: number;
}

interface OrderStoreState {
    /** Map of customerId → draft cart */
    draftOrders: Record<string, DraftOrderRow>;

    /** Set the full cart for a customer */
    setCart: (customerId: string, items: CartItem[], discountAmount: number) => void;

    /** Clear a single customer's cart */
    clearCart: (customerId: string) => void;

    /** Clear all drafts (after successful submission) */
    clearDrafts: () => void;
}

export const useOrderStore = create<OrderStoreState>()(
    persist(
        (set) => ({
            draftOrders: {},

            setCart: (customerId, items, discountAmount) =>
                set((state) => ({
                    draftOrders: {
                        ...state.draftOrders,
                        [customerId]: { items, discountAmount },
                    },
                })),

            clearCart: (customerId) =>
                set((state) => {
                    const next = { ...state.draftOrders };
                    delete next[customerId];
                    return { draftOrders: next };
                }),

            clearDrafts: () => set({ draftOrders: {} }),
        }),
        {
            name: 'lavash-draft-orders',
            version: 2,
            storage: createJSONStorage(() => AsyncStorage),
            migrate: (persisted: any, version: number) => {
                if (version < 2 && persisted?.draftOrders) {
                    // Clear old-format drafts that don't have items array
                    const cleaned: Record<string, DraftOrderRow> = {};
                    for (const [key, val] of Object.entries(persisted.draftOrders)) {
                        const draft = val as any;
                        if (draft?.items && Array.isArray(draft.items)) {
                            cleaned[key] = draft;
                        }
                        // else: discard old-format draft
                    }
                    return { ...persisted, draftOrders: cleaned };
                }
                return persisted as OrderStoreState;
            },
        }
    )
);
