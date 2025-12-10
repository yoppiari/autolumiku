
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle({ themeId }: { themeId?: string }) {
    const { theme, setTheme } = useTheme();
    // Prevent hydration mismatch
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Strict isolation: only show for 'automotive-dark' or adaptive themes
    if (!themeId || (themeId !== 'automotive-dark' && themeId !== 'automotive-adaptive')) {
        return null;
    }

    if (!mounted) {
        return <div className="w-10 h-10" />; // Placeholder
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-2 bg-background/50 backdrop-blur-sm border border-border"
            aria-label="Toggle theme"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-yellow-500" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
