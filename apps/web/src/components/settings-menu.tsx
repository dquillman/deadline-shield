"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";


import { APP_VERSION, BUILD_TIMESTAMP } from "@/lib/version";

export function SettingsMenu() {
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme);

        if (user) {
            try {
                await updateDoc(doc(db, "users", user.uid), {
                    themePreference: newTheme
                });
            } catch (error) {
                console.error("Error saving theme preference:", error);
            }
        }
    };

    // Always render the gear icon
    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.5em",
                    padding: "8px",
                    display: "block",
                }}
                aria-label="Settings"
                title="Settings"
            >
                ⚙️
            </button>

            {mounted && isOpen && (
                <>
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 40,
                        }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        style={{
                            position: "absolute",
                            right: 0,
                            marginTop: "8px",
                            background: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                            padding: "16px",
                            minWidth: "200px",
                            zIndex: 50,
                        }}
                        className="dark:bg-slate-900 dark:border-slate-700"
                    >
                        <h3
                            style={{
                                fontSize: "0.875rem",
                                fontWeight: "600",
                                marginBottom: "12px",
                                color: "#374151",
                            }}
                            className="dark:text-slate-100"
                        >
                            Appearance
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {["system", "light", "dark"].map((themeOption) => (
                                <label
                                    key={themeOption}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        cursor: "pointer",
                                        padding: "6px",
                                        borderRadius: "4px",
                                        background: theme === themeOption ? "#f3f4f6" : "transparent",
                                    }}
                                    className={theme === themeOption ? "dark:bg-slate-800" : ""}
                                >
                                    <input
                                        type="radio"
                                        name="theme"
                                        value={themeOption}
                                        checked={theme === themeOption}
                                        onChange={(e) => handleThemeChange(e.target.value)}
                                        style={{ cursor: "pointer" }}
                                    />
                                    <span
                                        style={{
                                            fontSize: "0.875rem",
                                            textTransform: "capitalize",
                                            color: "#374151",
                                        }}
                                        className="dark:text-slate-300"
                                    >
                                        {themeOption}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 text-[10px] text-gray-400 dark:text-slate-500 text-center">
                            v{APP_VERSION} ({new Date(BUILD_TIMESTAMP).toLocaleDateString()})
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

