import { create } from 'zustand';
import { TOTAL_MONTHLY_CREDIT } from '../constants';

const LOCAL_CREDIT_KEY = 'bananyang-monthly-credit-usd-v1';

export interface MonthlyCredit {
    current: number;
    total: number;
    month: string;
}

const FLUX_CREDITS_CACHE_KEY = 'bananyang-flux-credits-v1';

interface CreditState {
    monthlyCredit: MonthlyCredit;
    userAcknowledgedPaidUsage: boolean;
    manualUsedCredit: number | '';
    fluxCredits: number | null;
}

interface CreditActions {
    setMonthlyCredit: (credit: MonthlyCredit | ((prev: MonthlyCredit) => MonthlyCredit)) => void;
    setUserAcknowledgedPaidUsage: (acknowledged: boolean) => void;
    setManualUsedCredit: (value: number | '') => void;
    setFluxCredits: (credits: number | null) => void;

    // Credit management
    initializeCredit: () => void;
    updateTotalCredit: (newTotal: number) => void;
    updateCredit: () => void;
    handleCreditInputBlur: () => void;
    handleManualUsedCreditChange: (value: string) => void;

    // Computed
    getUsedCredit: () => number;
}

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const getInitialCredit = (): MonthlyCredit => ({
    current: TOTAL_MONTHLY_CREDIT,
    total: TOTAL_MONTHLY_CREDIT,
    month: getCurrentMonth()
});

const getInitialFluxCredits = (): number | null => {
    try {
        const cached = localStorage.getItem(FLUX_CREDITS_CACHE_KEY);
        if (cached !== null) return Number(cached);
    } catch { /* ignore */ }
    return null;
};

export const useCreditStore = create<CreditState & CreditActions>((set, get) => ({
    // State
    monthlyCredit: getInitialCredit(),
    userAcknowledgedPaidUsage: false,
    manualUsedCredit: '',
    fluxCredits: getInitialFluxCredits(),

    // Basic setters
    setMonthlyCredit: (creditOrUpdater) => set((state) => {
        const newCredit = typeof creditOrUpdater === 'function'
            ? creditOrUpdater(state.monthlyCredit)
            : creditOrUpdater;
        localStorage.setItem(LOCAL_CREDIT_KEY, JSON.stringify(newCredit));
        return { monthlyCredit: newCredit };
    }),

    setUserAcknowledgedPaidUsage: (userAcknowledgedPaidUsage) => set({ userAcknowledgedPaidUsage }),
    setManualUsedCredit: (manualUsedCredit) => set({ manualUsedCredit }),
    setFluxCredits: (credits) => {
        try {
            if (credits === null) {
                localStorage.removeItem(FLUX_CREDITS_CACHE_KEY);
            } else {
                localStorage.setItem(FLUX_CREDITS_CACHE_KEY, String(credits));
            }
        } catch { /* ignore */ }
        set({ fluxCredits: credits });
    },

    // Credit management
    initializeCredit: () => {
        const currentMonth = getCurrentMonth();
        try {
            const stored = localStorage.getItem(LOCAL_CREDIT_KEY);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (
                    parsed &&
                    typeof parsed === 'object' &&
                    parsed !== null &&
                    'current' in parsed &&
                    'total' in parsed &&
                    'month' in parsed &&
                    typeof (parsed as MonthlyCredit).current === 'number' &&
                    typeof (parsed as MonthlyCredit).total === 'number' &&
                    typeof (parsed as MonthlyCredit).month === 'string' &&
                    (parsed as MonthlyCredit).month === currentMonth
                ) {
                    set({ monthlyCredit: parsed as MonthlyCredit });
                    return;
                }
            }
        } catch (e) {
            console.error("Failed to parse saved credit", e);
        }

        const newCreditState = {
            current: TOTAL_MONTHLY_CREDIT,
            total: TOTAL_MONTHLY_CREDIT,
            month: currentMonth
        };
        set({ monthlyCredit: newCreditState });
        localStorage.setItem(LOCAL_CREDIT_KEY, JSON.stringify(newCreditState));
    },

    updateTotalCredit: (newTotal) => {
        const { monthlyCredit } = get();
        const usagePercentage = monthlyCredit.total > 0
            ? (monthlyCredit.total - monthlyCredit.current) / monthlyCredit.total
            : 0;
        const newUsed = parseFloat((newTotal * usagePercentage).toFixed(4));
        const newCurrent = parseFloat((newTotal - newUsed).toFixed(4));

        const newCreditState = { ...monthlyCredit, total: newTotal, current: newCurrent };
        set({ monthlyCredit: newCreditState });
        localStorage.setItem(LOCAL_CREDIT_KEY, JSON.stringify(newCreditState));
    },

    updateCredit: () => {
        const { monthlyCredit, manualUsedCredit } = get();
        const newUsedAmount = Math.max(0, Math.min(monthlyCredit.total, Number(manualUsedCredit)));
        const newCurrentAmount = monthlyCredit.total - newUsedAmount;
        const newCreditState = { ...monthlyCredit, current: newCurrentAmount };
        set({ monthlyCredit: newCreditState });
        localStorage.setItem(LOCAL_CREDIT_KEY, JSON.stringify(newCreditState));
    },

    handleCreditInputBlur: () => {
        const { monthlyCredit, manualUsedCredit } = get();
        const usedAmount = Number(manualUsedCredit);
        if (isNaN(usedAmount) || manualUsedCredit === '') {
            set({ manualUsedCredit: monthlyCredit.total - monthlyCredit.current });
        } else {
            const clamped = Math.max(0, Math.min(monthlyCredit.total, usedAmount));
            if (clamped !== usedAmount) {
                set({ manualUsedCredit: clamped });
            }
        }
    },

    handleManualUsedCreditChange: (value) => {
        if (value === '') {
            set({ manualUsedCredit: '' });
        } else {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                set({ manualUsedCredit: numValue });
            }
        }
    },

    // Computed
    getUsedCredit: () => {
        const { monthlyCredit } = get();
        return monthlyCredit.total - monthlyCredit.current;
    },
}));
