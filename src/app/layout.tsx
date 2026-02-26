import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/roleContext";

export const metadata: Metadata = {
    title: "Eden | 주일학교 출석 관리",
    description: "선생님들을 위한 프리미엄 주일학교 출석 관리 시스템",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className="antialiased selection:bg-indigo-100 selection:text-indigo-900">
                <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-black" />
                {/* 역할 Context로 전체 앱을 감쌉니다 */}
                <RoleProvider>
                    {children}
                </RoleProvider>
            </body>
        </html>
    );
}
