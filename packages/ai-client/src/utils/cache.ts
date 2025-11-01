export class AIResultCache<T> {
    private prefix: string;
    private ttl: number; // Time to live in milliseconds

    constructor(prefix: string, ttl: number = 24 * 60 * 60 * 1000) { // Default 24 hours
        this.prefix = prefix;
        this.ttl = ttl;
    }

    private getStorageKey(key: string): string {
        return `${this.prefix}_${key}`;
    }

    private isExpired(timestamp: number): boolean {
        return Date.now() - timestamp > this.ttl;
    }

    async get(key: string): Promise<T | null> {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return null;
            }

            const storageKey = this.getStorageKey(key);
            const cached = localStorage.getItem(storageKey);

            if (!cached) {
                return null;
            }

            const { data, timestamp } = JSON.parse(cached);

            if (this.isExpired(timestamp)) {
                localStorage.removeItem(storageKey);
                return null;
            }

            return data as T;
        } catch (error) {
            console.warn('Cache get error:', error);
            return null;
        }
    }

    async set(key: string, value: T): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return;
            }

            const storageKey = this.getStorageKey(key);
            const cacheData = {
                data: value,
                timestamp: Date.now()
            };

            localStorage.setItem(storageKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Cache set error:', error);
        }
    }

    async remove(key: string): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return;
            }

            const storageKey = this.getStorageKey(key);
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn('Cache remove error:', error);
        }
    }

    async clear(): Promise<void> {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return;
            }

            const keys = Object.keys(localStorage);
            const prefixedKeys = keys.filter(key => key.startsWith(this.prefix));

            prefixedKeys.forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.warn('Cache clear error:', error);
        }
    }

    // Generate a cache key from file properties
    generateFileKey(file: File): string {
        return `${file.name}_${file.size}_${file.lastModified}`;
    }

    // Generate a cache key from multiple parameters
    generateKey(...params: (string | number | boolean)[]): string {
        return params.map(p => String(p)).join('_');
    }
}

// Pre-configured cache instances for common use cases
export const virtualTryOnCache = new AIResultCache<any>('virtual_tryon', 24 * 60 * 60 * 1000); // 24 hours
export const styleSuggestionsCache = new AIResultCache<any>('style_suggestions', 12 * 60 * 60 * 1000); // 12 hours
export const personalityCritiqueCache = new AIResultCache<string>('personality_critique', 6 * 60 * 60 * 1000); // 6 hours
export const critiqueModeCache = new AIResultCache<string>('critique_mode', 4 * 60 * 60 * 1000); // 4 hours
export const fashionAnalysisCache = new AIResultCache<any>('fashion_analysis', 24 * 60 * 60 * 1000); // 24 hours