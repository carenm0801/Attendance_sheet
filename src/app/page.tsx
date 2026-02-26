"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Teacher } from "@/types";
import { Users, ChevronRight, Settings, Sparkles, ShieldCheck, Star, UserCircle2, LogOut, Lock, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRole, permissions, Role } from "@/lib/roleContext";
import { cn } from "@/lib/utils";

// ─── 역할 선택 모달 ───────────────────────────────────────────────
function RoleSelectModal({ onSelect }: { onSelect: () => void }) {
    const { setRole } = useRole();
    const router = useRouter();
    const [step, setStep] = useState<"role" | "pickTeacher">("role");
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const supabase = createClient();

    // 반 선생님 선택 시 선생님 목록 로드
    async function loadTeachers() {
        const { data } = await supabase
            .from("teachers")
            .select("id, name, class_id, photo_url, classes(name)")
            .order("name");
        setTeachers(data || []);
    }

    function selectAdmin() {
        setRole({ role: "admin", teacherName: "관리자" });
        onSelect();
    }

    function selectHeadTeacher() {
        setRole({ role: "head_teacher", teacherName: "부장선생님" });
        onSelect();
    }

    async function goPickTeacher() {
        await loadTeachers();
        setStep("pickTeacher");
    }

    function selectTeacher(t: Teacher) {
        setRole({ role: "teacher", teacherId: t.id, teacherName: t.name });
        onSelect();
        // 선생님 선택 즉시 해당 반 출석부 페이지로 이동
        router.push(`/teachers/${t.id}`);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden animate-in">

                {step === "role" ? (
                    <div className="p-8 space-y-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                                <Sparkles className="h-8 w-8 text-indigo-500" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900">역할을 선택하세요</h2>
                            <p className="mt-1 text-sm text-slate-500">선택한 역할에 따라 사용 가능한 기능이 달라집니다.</p>
                        </div>

                        <div className="space-y-3">
                            {/* 관리자 */}
                            <button onClick={selectAdmin}
                                className="group w-full flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-left transition-all hover:bg-slate-800 active:scale-[0.98]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                    <ShieldCheck className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-white">관리자</p>
                                    <p className="text-xs text-slate-400">선생님·학생·반 전체 관리 가능</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-500 group-hover:translate-x-1 transition-transform" />
                            </button>

                            {/* 부장선생님 */}
                            <button onClick={selectHeadTeacher}
                                className="group w-full flex items-center gap-4 rounded-2xl bg-indigo-600 p-5 text-left transition-all hover:bg-indigo-700 active:scale-[0.98]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                    <Star className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-white">부장선생님</p>
                                    <p className="text-xs text-indigo-200">출석 체크 + 선생님·학생 관리</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
                            </button>

                            {/* 반 선생님 */}
                            <button onClick={goPickTeacher}
                                className="group w-full flex items-center gap-4 rounded-2xl bg-emerald-500 p-5 text-left transition-all hover:bg-emerald-600 active:scale-[0.98]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                                    <UserCircle2 className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-white">반 선생님</p>
                                    <p className="text-xs text-emerald-100">담당 반 학생 관리 + 출석 조회</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 space-y-5">
                        <button onClick={() => setStep("role")} className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1">
                            ← 이전으로
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900">선생님을 선택하세요</h2>
                            <p className="text-xs text-slate-500 mt-1">본인의 이름을 선택해 주세요.</p>
                        </div>
                        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {teachers.map((t) => (
                                <li key={t.id}>
                                    <button onClick={() => selectTeacher(t)}
                                        className="group w-full flex items-center gap-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-300 px-4 py-3 transition-all">
                                        <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden bg-slate-200">
                                            {t.photo_url
                                                ? <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" />
                                                : <div className="h-full w-full flex items-center justify-center text-sm font-bold text-slate-400">{t.name[0]}</div>
                                            }
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-bold text-sm text-slate-900">{t.name} 선생님</p>
                                            <p className="text-xs text-slate-400">{(t as any).classes?.name}</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── 역할 배지 ────────────────────────────────────────────────────
const ROLE_BADGE: Record<NonNullable<Role>, { label: string; color: string; icon: React.ReactNode }> = {
    admin: { label: "관리자", color: "bg-slate-900 text-white", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
    head_teacher: { label: "부장선생님", color: "bg-indigo-600 text-white", icon: <Star className="h-3.5 w-3.5" /> },
    teacher: { label: "반 선생님", color: "bg-emerald-500 text-white", icon: <UserCircle2 className="h-3.5 w-3.5" /> },
};

// ─── 메인 페이지 ─────────────────────────────────────────────────
export default function Home() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const { roleInfo, clearRole } = useRole();
    const supabase = createClient();

    useEffect(() => {
        async function fetchTeachers() {
            const { data, error } = await supabase
                .from("teachers")
                .select(`
          id,
          name,
          class_id,
          photo_url,
          classes (
            name
          )
        `);

            if (error) {
                console.error("선생님 목록을 가져오는데 실패했습니다:", error);
            } else {
                setTeachers(data || []);
            }
            setLoading(false);
        }

        fetchTeachers();
    }, [supabase]);

    // 역할이 없으면 모달 자동 표시
    useEffect(() => {
        if (!loading && !roleInfo.role) {
            setShowModal(true);
        }
    }, [loading, roleInfo.role]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-transparent">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="text-lg font-medium text-slate-500 animate-pulse">데이터를 불러오고 있습니다...</p>
                </div>
            </div>
        );
    }

    const badge = roleInfo.role ? ROLE_BADGE[roleInfo.role] : null;
    const canAdmin = permissions.isAdmin(roleInfo.role);

    return (
        <>
            {/* 역할 선택 모달 */}
            {showModal && <RoleSelectModal onSelect={() => setShowModal(false)} />}

            <main className="min-h-screen p-6 md:p-12 lg:p-24">
                <div className="mx-auto max-w-6xl">
                    <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                <Sparkles className="h-3 w-3" />
                                <span>주일학교 통합 관리 시스템</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                Eden <span className="text-indigo-600">Attendance</span>
                            </h1>
                            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-md">
                                선생님들의 소중한 시간을 절약해 드리는 스마트한 출석 관리 서비스입니다.
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            {/* 역할 전환 버튼 (작은 아이콘만 표시) */}
                            <button
                                onClick={() => { clearRole(); setShowModal(true); }}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                title="역할 전환"
                            >
                                <LogOut className="h-3.5 w-3.5" /> 역할 전환
                            </button>

                            {/* 관리자만 관리자 대시보드 접근 */}
                            {canAdmin && (
                                <Link
                                    href="/admin"
                                    className="group flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-indigo-500 transition-all hover:translate-y-[-2px]"
                                >
                                    <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                                    관리자 대시보드
                                </Link>
                            )}
                        </div>
                    </header>

                    {/* 부장선생님 전용: 전체 출석체크 바로가기 */}
                    {roleInfo.role === "head_teacher" && (
                        <section className="animate-in mb-8" style={{ animationDelay: "0.08s" }}>
                            <Link
                                href="/head/attendance"
                                className="group relative flex items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 p-7 shadow-2xl shadow-indigo-300/40 transition-all hover:shadow-indigo-400/50 hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {/* 배경 장식 */}
                                <div className="absolute right-0 top-0 -mr-8 -mt-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                                <div className="absolute left-1/2 bottom-0 -mb-4 h-24 w-24 rounded-full bg-purple-400/20 blur-2xl" />

                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                                    <ClipboardList className="h-8 w-8 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-indigo-200 uppercase tracking-widest mb-1">부장선생님 전용</p>
                                    <h2 className="text-2xl font-black text-white">전체 학생 출석체크</h2>
                                    <p className="mt-1 text-sm text-indigo-200">모든 반의 학생을 한 화면에서 출석 관리</p>
                                </div>
                                <ChevronRight className="h-7 w-7 text-indigo-300 group-hover:translate-x-1.5 transition-transform" />
                            </Link>
                        </section>
                    )}

                    <section className="animate-in" style={{ animationDelay: "0.1s" }}>
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Users className="h-6 w-6 text-indigo-500" />
                                {permissions.canCheckAttendance(roleInfo.role)
                                    ? "반별 출석부 보기"
                                    : "출석 현황 조회"}
                            </h2>
                            <span className="text-sm font-medium text-slate-400">{teachers.length} 명의 교사가 활동 중</span>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {teachers.length > 0 ? (
                                teachers.map((teacher, index) => (
                                    <Link
                                        key={teacher.id}
                                        href={`/teachers/${teacher.id}`}
                                        className="group relative overflow-hidden rounded-3xl bg-white/80 dark:bg-slate-900/50 p-8 shadow-xl shadow-slate-200/40 dark:shadow-none ring-1 ring-white/20 backdrop-blur-xl transition-all hover:bg-white dark:hover:bg-slate-900 hover:ring-indigo-500/50 hover:shadow-indigo-500/10 hover-scale animate-in"
                                        style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                                    >
                                        <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />

                                        <div className="relative flex items-center gap-6">
                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 transition-transform group-hover:rotate-6 group-hover:scale-110">
                                                {teacher.photo_url ? (
                                                    <img src={teacher.photo_url} alt={teacher.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-2xl font-bold">{teacher.name[0]}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                                                    {teacher.name} 선생님
                                                </h3>
                                                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-indigo-500 uppercase tracking-wider">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                    {(teacher as any).classes?.name || "소속 없음"}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="col-span-full rounded-[2.5rem] bg-white/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 p-20 text-center backdrop-blur-sm animate-in">
                                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                                        <Users className="h-10 w-10" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">선생님 데이터가 없습니다</h3>
                                    <p className="mt-2 text-slate-500 dark:text-slate-400">관리자 페이지에서 선생님을 먼저 등록해 주세요.</p>
                                    {canAdmin && (
                                        <Link
                                            href="/admin"
                                            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-indigo-600 px-8 py-3 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all"
                                        >
                                            데이터 등록하기
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
