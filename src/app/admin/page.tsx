"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Class } from "@/types";
import { PlusCircle, Trash2, Users, UserCheck, ChevronRight, LayoutDashboard, Database, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [newClassName, setNewClassName] = useState("");
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    async function fetchClasses() {
        console.log("반 목록 불러오기 시도...");
        const { data, error } = await supabase.from("classes").select("*").order("name");

        if (error) {
            console.error("반 목록 로딩 에러:", error);
            // alert("데이터를 불러오는데 실패했습니다: " + error.message);
        } else {
            console.log("반 목록 로드 성공:", data);
            setClasses(data || []);
        }
        setLoading(false);
    }

    useEffect(() => {
        console.log("관리자 페이지 마운트됨");
        fetchClasses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function addClass() {
        if (!newClassName.trim()) return;
        const { error } = await supabase.from("classes").insert({ name: newClassName.trim() });
        if (!error) {
            setNewClassName("");
            fetchClasses();
        } else {
            console.error("반 추가 에러:", error);
            alert("반 추가에 실패했습니다: " + (error.message || "알 수 없는 오류"));
        }
    }

    async function deleteClass(id: string) {
        if (!confirm("반을 삭제하시겠습니까? 학생 데이터가 삭제될 수 있습니다.")) return;
        const { error } = await supabase.from("classes").delete().eq("id", id);
        if (!error) {
            fetchClasses();
        } else {
            console.error("반 삭제 에러:", error);
            alert("삭제에 실패했습니다: " + (error.message || "알 수 없는 오류"));
        }
    }

    return (
        <main className="min-h-screen p-6 md:p-12 lg:p-24">
            <div className="mx-auto max-w-5xl space-y-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-slate-100 px-3 py-1 text-[10px] font-black text-white dark:text-slate-900 uppercase tracking-widest">
                            System Admin
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white">설정 및 관리</h1>
                        <p className="text-slate-500 font-medium">서비스 운영을 위한 모든 설정을 이곳에서 관리합니다.</p>
                    </div>
                    <Link href="/" className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors">
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        메인으로 돌아가기
                    </Link>
                </header>

                <div className="grid gap-8 lg:grid-cols-3 animate-in" style={{ animationDelay: "0.1s" }}>
                    {/* 반 관리 섹션 */}
                    <section className="lg:col-span-2 rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none p-10 ring-1 ring-slate-100 dark:ring-slate-800">
                        <div className="mb-8 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
                                <Database className="h-6 w-6" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">반 데이터베이스</h2>
                        </div>

                        <div className="flex gap-3 mb-8">
                            <input
                                type="text"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="예: 유년1반"
                                className="flex-1 rounded-2xl bg-slate-50 dark:bg-slate-800 px-6 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                            <button
                                onClick={addClass}
                                className="rounded-2xl bg-slate-900 dark:bg-indigo-600 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                추가
                            </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {classes.map((cls) => (
                                <div key={cls.id} className="group flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 ring-1 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-500/30 transition-all">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{cls.name}</span>
                                    <button
                                        onClick={() => deleteClass(cls.id)}
                                        className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 링크 카드 */}
                    <div className="space-y-6">
                        <Link
                            href="/admin/teachers"
                            className="group block rounded-[2.5rem] bg-white dark:bg-slate-900 p-10 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800 hover:ring-indigo-500 transition-all hover-scale"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-12 transition-all">
                                <UserCheck className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">선생님 관리</h3>
                            <p className="mt-2 text-sm font-medium text-slate-400">교사 개별 및 일괄 등록</p>
                            <div className="mt-8 flex items-center gap-2 text-xs font-black text-indigo-500 uppercase tracking-widest">
                                관리하기 <ChevronRight className="h-3 w-3" />
                            </div>
                        </Link>

                        <Link
                            href="/admin/students"
                            className="group block rounded-[2.5rem] bg-white dark:bg-slate-900 p-10 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800 hover:ring-emerald-500 transition-all hover-scale"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:-rotate-12 transition-all">
                                <Users className="h-7 w-7" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">학생 관리</h3>
                            <p className="mt-2 text-sm font-medium text-slate-400">명단 관리 및 일괄 등록</p>
                            <div className="mt-8 flex items-center gap-2 text-xs font-black text-emerald-500 uppercase tracking-widest">
                                관리하기 <ChevronRight className="h-3 w-3" />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
