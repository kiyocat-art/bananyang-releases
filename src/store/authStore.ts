import { create } from 'zustand';
import { DRMStatus, clearLocalCredentials } from '../services/drmService';

export type AuthState =
    | 'checking'
    | 'login'
    | 'authenticated'
    | 'not_purchased'
    | 'grace_expired'
    | 'offline_grace';

interface AuthStoreState {
    authState: AuthState;
    email: string;
    daysLeft: number;
    loginLoading: boolean;
    loginError: string | null;
    showLoginModal: boolean;
}

interface AuthStoreActions {
    setAuthResult: (result: DRMStatus) => void;
    setLoginLoading: (v: boolean) => void;
    setLoginError: (e: string | null) => void;
    openLoginModal: () => void;
    closeLoginModal: () => void;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState & AuthStoreActions>((set) => ({
    authState: 'checking',
    email: '',
    daysLeft: 0,
    loginLoading: false,
    loginError: null,
    showLoginModal: false,

    setAuthResult: (result: DRMStatus) => {
        switch (result.status) {
            case 'ok':
                set({ authState: 'authenticated', email: result.email, showLoginModal: false, loginError: null });
                break;
            case 'needs_login':
                set({ authState: 'login', showLoginModal: true });
                break;
            case 'not_purchased':
                set({ authState: 'not_purchased', email: result.email, showLoginModal: false });
                break;
            case 'offline_grace':
                set({ authState: 'offline_grace', daysLeft: result.daysLeft, email: result.email, showLoginModal: false, loginError: null });
                break;
            case 'grace_expired':
                set({ authState: 'grace_expired', showLoginModal: false });
                break;
            case 'error':
                set({ loginError: result.message, authState: 'login' });
                break;
        }
    },

    setLoginLoading: (v) => set({ loginLoading: v }),
    setLoginError: (e) => set({ loginError: e }),

    openLoginModal: () => set({ showLoginModal: true }),
    closeLoginModal: () => set({ showLoginModal: false, loginLoading: false, loginError: null }),

    logout: async () => {
        await clearLocalCredentials();
        set({ authState: 'login', email: '', loginError: null, showLoginModal: false, daysLeft: 0 });
    },
}));
