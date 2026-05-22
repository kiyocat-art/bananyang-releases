import { useState, useEffect, useCallback, useRef } from 'react';
import { getFluxCredits } from '../services/providers/flux/api';
import { useCreditStore } from '../store/creditStore';

const POLLING_INTERVAL_MS = 60_000;

export function useFluxCredits(enabled: boolean) {
    const setFluxCredits = useCreditStore(s => s.setFluxCredits);
    const credits = useCreditStore(s => s.fluxCredits);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isMountedRef = useRef(true);

    const fetchCredits = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getFluxCredits();
            if (isMountedRef.current) {
                setFluxCredits(result);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err?.message ?? '크레딧 조회 실패');
                console.warn('[useFluxCredits] Failed to fetch credits:', err?.message);
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [setFluxCredits]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        fetchCredits();

        intervalRef.current = setInterval(fetchCredits, POLLING_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, fetchCredits]);

    return { credits, isLoading, error, refresh: fetchCredits };
}
