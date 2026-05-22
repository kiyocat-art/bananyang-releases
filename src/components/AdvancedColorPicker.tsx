import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AdvancedColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    onClose?: () => void;
    /** Compact mode: SV 152px, total ~190px wide (fits 192px side panel) */
    compact?: boolean;
}

// Convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

// Convert RGB to HSV
const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, v];
};

// Hex to RGB
const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
};

// RGB to Hex
const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

export const AdvancedColorPicker: React.FC<AdvancedColorPickerProps> = ({ color, onChange, onClose, compact = false }) => {
    const svSize = compact ? 152 : 180;
    const hueW = compact ? 14 : 20;
    const gap = compact ? 'gap-2' : 'gap-3';
    const pad = compact ? 'p-2' : 'p-3';
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(1);
    const [value, setValue] = useState(1);
    const [hexInput, setHexInput] = useState(color);

    const gradientRef = useRef<HTMLCanvasElement>(null);
    const hueRef = useRef<HTMLCanvasElement>(null);
    const isDraggingGradient = useRef(false);
    const isDraggingHue = useRef(false);

    // Sync color from prop when it changes (e.g., switching between color slots)
    useEffect(() => {
        const rgb = hexToRgb(color);
        if (rgb) {
            const [h, s, v] = rgbToHsv(...rgb);
            setHue(h);
            setSaturation(s);
            setValue(v);
            setHexInput(color);
        }
    }, [color]);

    // ESC key to close
    useEffect(() => {
        if (!onClose) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Draw SV gradient
    useEffect(() => {
        const canvas = gradientRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Create horizontal saturation gradient (white to hue color)
        const [r, g, b] = hsvToRgb(hue, 1, 1);
        const hueColor = `rgb(${r}, ${g}, ${b})`;

        // White to hue color (horizontal)
        const satGradient = ctx.createLinearGradient(0, 0, width, 0);
        satGradient.addColorStop(0, 'white');
        satGradient.addColorStop(1, hueColor);
        ctx.fillStyle = satGradient;
        ctx.fillRect(0, 0, width, height);

        // Black overlay (vertical)
        const valGradient = ctx.createLinearGradient(0, 0, 0, height);
        valGradient.addColorStop(0, 'rgba(0,0,0,0)');
        valGradient.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = valGradient;
        ctx.fillRect(0, 0, width, height);
    }, [hue]);

    // Draw Hue bar
    useEffect(() => {
        const canvas = hueRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const height = canvas.height;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        for (let i = 0; i <= 1; i += 0.166666) {
            const [r, g, b] = hsvToRgb(i, 1, 1);
            gradient.addColorStop(i, `rgb(${r}, ${g}, ${b})`);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, height);
    }, []);

    const updateColorFromHSV = useCallback((h: number, s: number, v: number) => {
        const [r, g, b] = hsvToRgb(h, s, v);
        const hex = rgbToHex(r, g, b);
        setHexInput(hex);
        onChange(hex);
    }, [onChange]);

    const handleGradientInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
        const canvas = gradientRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setSaturation(x);
        setValue(1 - y);
        updateColorFromHSV(hue, x, 1 - y);
    }, [hue, updateColorFromHSV]);

    const handleHueInteraction = useCallback((e: React.MouseEvent | MouseEvent) => {
        const canvas = hueRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        setHue(y);
        updateColorFromHSV(y, saturation, value);
    }, [saturation, value, updateColorFromHSV]);

    const handleGradientMouseDown = (e: React.MouseEvent) => {
        isDraggingGradient.current = true;
        handleGradientInteraction(e);
    };

    const handleHueMouseDown = (e: React.MouseEvent) => {
        isDraggingHue.current = true;
        handleHueInteraction(e);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingGradient.current) handleGradientInteraction(e);
            if (isDraggingHue.current) handleHueInteraction(e);
        };
        const handleMouseUp = () => {
            isDraggingGradient.current = false;
            isDraggingHue.current = false;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleGradientInteraction, handleHueInteraction]);

    const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setHexInput(val);
        const rgb = hexToRgb(val);
        if (rgb) {
            const [h, s, v] = rgbToHsv(...rgb);
            setHue(h);
            setSaturation(s);
            setValue(v);
            onChange(val.startsWith('#') ? val : `#${val}`);
        }
    };

    // Current RGB for display
    const [r, g, b] = hsvToRgb(hue, saturation, value);

    return (
        <div
            className={`bg-neutral-900 rounded-xl border border-white/20 shadow-2xl ${pad}`}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
        >
            {/* Main content */}
            <div className={`flex ${gap}`}>
                {/* SV Gradient */}
                <div className="relative" style={{ width: svSize, height: svSize }}>
                    <canvas
                        ref={gradientRef}
                        width={svSize}
                        height={svSize}
                        style={{ width: svSize, height: svSize }}
                        className="rounded cursor-crosshair"
                        onMouseDown={handleGradientMouseDown}
                    />
                    {/* Picker circle */}
                    <div
                        className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md pointer-events-none"
                        style={{
                            left: `${saturation * 100}%`,
                            top: `${(1 - value) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)'
                        }}
                    />
                </div>

                {/* Hue Bar */}
                <div className="relative" style={{ width: hueW, height: svSize }}>
                    <canvas
                        ref={hueRef}
                        width={hueW}
                        height={svSize}
                        style={{ width: hueW, height: svSize }}
                        className="rounded cursor-pointer"
                        onMouseDown={handleHueMouseDown}
                    />
                    {/* Hue indicator */}
                    <div
                        className="absolute left-0 w-full h-1.5 border border-white rounded pointer-events-none"
                        style={{
                            top: `${hue * 100}%`,
                            transform: 'translateY(-50%)',
                            boxShadow: '0 0 2px rgba(0,0,0,0.5)'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdvancedColorPicker;



