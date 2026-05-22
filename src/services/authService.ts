import { IElectronAPI } from '../electron';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform', // For Vertex AI
    'email',
    'profile'
];

export interface GoogleTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // Timestamp in ms
}

export interface UserProfile {
    name: string;
    email: string;
    picture: string;
}

// PKCE Helpers
const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...Array.from(new Uint8Array(hash))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

export class AuthService {
    private static instance: AuthService;
    private tokens: GoogleTokens | null = null;
    private userProfile: UserProfile | null = null;
    private clientId: string = '';
    private clientSecret: string = '';
    private codeVerifier: string = '';

    private constructor() {
        this.loadTokens();
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public setCredentials(clientId: string, clientSecret: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public async login(): Promise<void> {
        if (!this.clientId || !this.clientSecret) {
            throw new Error('Client ID and Secret are required');
        }

        this.codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(this.codeVerifier);

        const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('scope', SCOPES.join(' '));
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('access_type', 'offline'); // To get refresh token
        authUrl.searchParams.append('prompt', 'select_account consent'); // Force account selection every time

        // Start loopback server via Electron main process
        if (window.electronAPI) {
            // Start the server and get the promise, but don't await it yet
            // This promise resolves when the auth code is received or on timeout
            const authPromise = window.electronAPI.startAuthServer();

            // Open browser for user consent immediately
            // We add a small delay to ensure the server has time to bind to the port
            setTimeout(() => {
                window.electronAPI.openExternal(authUrl.toString());
            }, 1000);

            const result = await authPromise;

            if (!result.success || !result.code) {
                throw new Error(result.error || 'Authentication cancelled or failed');
            }
            const code = result.code;

            await this.exchangeCodeForToken(code);
            await this.fetchUserProfile();
        } else {
            throw new Error('Google Login is only supported in the desktop app');
        }
    }

    private async exchangeCodeForToken(code: string): Promise<void> {
        const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code_verifier: this.codeVerifier
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
        }

        const data = await response.json();
        this.tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + (data.expires_in * 1000)
        };
        this.saveTokens();
    }

    public async refreshAccessToken(): Promise<string> {
        if (!this.tokens?.refreshToken) throw new Error('No refresh token available');

        const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.tokens.refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) throw new Error('Token refresh failed');

        const data = await response.json();
        this.tokens.accessToken = data.access_token;
        this.tokens.expiresAt = Date.now() + (data.expires_in * 1000);
        if (data.refresh_token) this.tokens.refreshToken = data.refresh_token; // Sometimes new refresh token is issued

        this.saveTokens();
        return this.tokens.accessToken;
    }

    public async getAccessToken(): Promise<string> {
        if (!this.tokens) throw new Error('Not logged in');

        // Refresh if expired or expiring soon (within 5 mins)
        if (Date.now() > this.tokens.expiresAt - 300000) {
            return this.refreshAccessToken();
        }

        return this.tokens.accessToken;
    }

    private async fetchUserProfile(): Promise<void> {
        if (!this.tokens) return;
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.tokens.accessToken}` }
            });
            if (res.ok) {
                this.userProfile = await res.json();
                localStorage.setItem('google_user_profile', JSON.stringify(this.userProfile));
            }
        } catch (e) {
            console.error('Failed to fetch user profile', e);
        }
    }

    public getUserProfile(): UserProfile | null {
        return this.userProfile;
    }

    public isLoggedIn(): boolean {
        return !!this.tokens;
    }

    public async logout(): Promise<void> {
        // Revoke the token on Google's side for better security
        if (this.tokens?.accessToken) {
            try {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${this.tokens.accessToken}`, {
                    method: 'POST'
                });
            } catch (e) {
                console.error('Failed to revoke token', e);
            }
        }

        this.tokens = null;
        this.userProfile = null;
        localStorage.removeItem('google_tokens');
        localStorage.removeItem('google_user_profile');
    }

    private saveTokens() {
        if (this.tokens) {
            // In a real app, use safeStorage via IPC. For now, using localStorage for MVP.
            // TODO: Move to secure storage
            localStorage.setItem('google_tokens', JSON.stringify(this.tokens));
        }
    }

    private loadTokens() {
        const storedTokens = localStorage.getItem('google_tokens');
        if (storedTokens) {
            this.tokens = JSON.parse(storedTokens);
        }
        const storedProfile = localStorage.getItem('google_user_profile');
        if (storedProfile) {
            this.userProfile = JSON.parse(storedProfile);
        }
    }
}

export const authService = AuthService.getInstance();
