declare module 'next/navigation' {
  export function useParams(): Record<string, string | string[] | undefined>;
  export function useRouter(): {
    push(url: string): void;
    replace(url: string): void;
    back(): void;
    prefetch(url: string): void;
  };
  export function useSearchParams(): {
    get(key: string): string | null;
    getAll(key: string): string[];
    has(key: string): boolean;
    forEach(callback: (value: string, key: string) => void): void;
  };
  export function usePathname(): string;
}
