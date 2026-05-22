/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./index.html",
        "./features/**/*.{js,jsx,ts,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                bananang: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f',
                },
                banana: {
                    DEFAULT: '#F5C518',
                    light: '#FFD84D',
                    dark: '#C9980A',
                },
                surface: {
                    0: '#0D0D0D',
                    1: '#151515',
                    2: '#1F1F1F',
                    3: '#2A2A2A',
                },
                // Key color — 앱 전체 active/selected/highlight 상태의 단일 제어점
                // 변경 시 src/index.css의 --key-rgb, --key-color, --key-glow 만 수정하면 됨
                key: 'rgb(var(--key-rgb) / <alpha-value>)',
            },
            fontFamily: {
                // Photoshop 스타일: Windows 시스템 폰트 우선 (Inter 제거)
                sans: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            fontSize: {
                // UI 폰트 크기 — rem 기반으로 html font-size 변경 시 비례 조정
                // html font-size 기본 16px 기준 px 환산 주석
                // 폰트 스케일러(--ui-font-scale): S=0.875 / M=1.0 / L=1.125 (index.css)
                // Windows DPI 동기화는 OS 레벨에서 처리 (rem 자체가 픽셀로 환산되는 시점)
                'xs':   ['0.6875rem', { lineHeight: '1.3' }],  //  11px M
                'sm':   ['0.75rem',   { lineHeight: '1.3' }],  //  12px M
                'base': ['0.8125rem', { lineHeight: '1.4' }],  //  13px M
                'lg':   ['0.875rem',  { lineHeight: '1.4' }],  //  14px M
                'xl':   ['0.9375rem', { lineHeight: '1.4' }],  //  15px M
                '2xl':  ['1.0625rem', { lineHeight: '1.5' }],  //  17px M
                '3xl':  ['1.25rem',   { lineHeight: '1.4' }],  //  20px M
                '4xl':  ['1.5rem',    { lineHeight: '1.4' }],  //  24px M
            },
            animation: {
                'float': 'float 3s ease-in-out infinite',
                'fade-in-up': 'fade-in-up 0.6s ease-out both',
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'category-fade-in': 'category-fade-in 0.18s ease-out both',
                'fade-in-out-center': 'fade-in-out-center 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
            },
            keyframes: {
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
                'fade-in-up': {
                    from: { opacity: '0', transform: 'translateY(20px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(245,197,24,0.2)' },
                    '50%': { boxShadow: '0 0 40px rgba(245,197,24,0.4)' },
                },
                'category-fade-in': {
                    from: { opacity: '0', transform: 'translateY(6px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-out-center': {
                    from: { opacity: '0', transform: 'scale(0.92)' },
                    to:   { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
