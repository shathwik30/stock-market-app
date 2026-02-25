'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import TopGainersLosersTable from '@/components/TopGainersLosersTable';
import { fiftyTwoWeekLowNSE, TopGainerLoserStock } from '@/lib/mockData';

export default function FiftyTwoWeekLowPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();
    const hydrated = useHasHydrated();
    const [stocks, setStocks] = useState<TopGainerLoserStock[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!hydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        // Using the new mock data directly
        setStocks(fiftyTwoWeekLowNSE);
        setLoading(false);
    }, [hydrated, isAuthenticated, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading 52 week low stocks...</p>
                </div>
            </div>
        );
    }

    // Get current date in the format: Dec 30, 16:09
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return (
        <TopGainersLosersTable
            data={stocks}
            type="52wkLow"
            exchange="NSE"
            index="NIFTY 500"
            date={dateStr}
        />
    );
}
