'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useHasHydrated } from '@/store/useAuthStore';
import TopGainersLosersTable from '@/components/TopGainersLosersTable';
import { onlySellersNSE, TopGainerLoserStock } from '@/lib/mockData';

export default function OnlySellersPage() {
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

        setStocks(onlySellersNSE);
        setLoading(false);
    }, [hydrated, isAuthenticated, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading only sellers stocks...</p>
                </div>
            </div>
        );
    }

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
            type="onlySellers"
            exchange="NSE"
            index="NIFTY 500"
            date={dateStr}
        />
    );
}
