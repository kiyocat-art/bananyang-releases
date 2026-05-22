/**
 * Pressure Brush Utility Module
 * 
 * 와콤 타블렛 펜 필압을 포토샵 수준으로 표현하기 위한 유틸리티 모듈
 * - 연속 스트로크 렌더링 (점이 아닌 연결된 선)
 * - 필압에 따른 크기 변화
 * - 부드러운 보간
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface StrokePoint {
    x: number;
    y: number;
    pressure: number;      // 0.0 ~ 1.0
    timestamp: number;
}

export type PressureCurveType = 'linear' | 'soft' | 'firm';

export interface BrushSettings {
    size: number;
    color: string;
    minSizeRatio: number;  // 최소 크기 비율 (0.0 ~ 1.0)
}

// ============================================================================
// PRESSURE CURVE
// ============================================================================

export function applyPressureCurve(pressure: number, curveType: PressureCurveType): number {
    const p = Math.max(0, Math.min(1, pressure));

    switch (curveType) {
        case 'linear':
            return p;
        case 'soft':
            return Math.sqrt(p);  // 가벼운 터치에 더 민감
        case 'firm':
            return p * p;  // 강한 필압 필요
        default:
            return p;
    }
}

// ============================================================================
// STROKE PROCESSOR - 포토샵 스타일 연속 스트로크
// ============================================================================

export class StrokeProcessor {
    private lastPoint: StrokePoint | null = null;
    private settings: BrushSettings = {
        size: 5,
        color: '#FFFFFF',
        minSizeRatio: 0.05,
    };
    private isEraser: boolean = false;
    private pressureCurve: PressureCurveType = 'linear';

    updateSettings(settings: Partial<BrushSettings & { pressureCurve?: PressureCurveType }>): void {
        if (settings.size !== undefined) this.settings.size = settings.size;
        if (settings.color !== undefined) this.settings.color = settings.color;
        if (settings.minSizeRatio !== undefined) this.settings.minSizeRatio = settings.minSizeRatio;
        if (settings.pressureCurve !== undefined) this.pressureCurve = settings.pressureCurve;
    }

    setEraserMode(isEraser: boolean): void {
        this.isEraser = isEraser;
    }

    beginStroke(ctx: CanvasRenderingContext2D, point: StrokePoint): void {
        this.lastPoint = point;

        // 시작점에 작은 점 그리기 (펜처럼 자연스럽게)
        const size = this.calculateSize(point.pressure);
        this.drawCircle(ctx, point.x, point.y, size / 2, point.pressure);
    }

    continueStroke(ctx: CanvasRenderingContext2D, point: StrokePoint): void {
        if (!this.lastPoint) {
            this.lastPoint = point;
            return;
        }

        // 두 점 사이에 연속적인 원을 그려서 부드러운 선 생성
        this.drawSmoothLine(ctx, this.lastPoint, point);
        this.lastPoint = point;
    }

    endStroke(): void {
        // 마지막에 추가 점 없이 깔끔하게 종료
        this.lastPoint = null;
    }

    private calculateSize(pressure: number): number {
        const transformedPressure = applyPressureCurve(pressure, this.pressureCurve);
        const minSize = this.settings.size * this.settings.minSizeRatio;
        const maxSize = this.settings.size;
        return minSize + (maxSize - minSize) * transformedPressure;
    }

    private drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, pressure: number): void {
        ctx.save();

        if (this.isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = this.settings.color;
        }

        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private drawSmoothLine(ctx: CanvasRenderingContext2D, from: StrokePoint, to: StrokePoint): void {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.5) return;

        // 거리에 따른 스텝 수 계산 (더 조밀하게)
        const avgPressure = (from.pressure + to.pressure) / 2;
        const avgSize = this.calculateSize(avgPressure);
        const spacing = Math.max(0.5, avgSize * 0.15);  // 크기의 15% 간격
        const steps = Math.ceil(distance / spacing);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // 위치 보간
            const x = from.x + dx * t;
            const y = from.y + dy * t;

            // 필압 보간 (부드러운 전이)
            const pressure = from.pressure + (to.pressure - from.pressure) * t;
            const size = this.calculateSize(pressure);

            this.drawCircle(ctx, x, y, size / 2, pressure);
        }
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createStrokePointFromEvent(
    e: PointerEvent | React.PointerEvent,
    canvas: HTMLCanvasElement
): StrokePoint {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 필압 가져오기
    let pressure = e.pressure;

    // 펜 타입일 때만 실제 필압 사용
    if (e.pointerType === 'pen') {
        // 펜이지만 pressure가 0이면 (호버 상태), 가벼운 터치로 간주
        if (pressure === 0) {
            pressure = 0.1;
        }
    } else {
        // 마우스는 중간 필압 고정
        pressure = 0.5;
    }

    return {
        x,
        y,
        pressure,
        timestamp: e.timeStamp || Date.now(),
    };
}
