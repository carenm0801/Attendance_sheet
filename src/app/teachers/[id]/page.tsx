"use client";

import { useEffect, useState, use, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Student, Teacher, Attendance } from "@/types";
import {
    ChevronLeft, User, Sparkles, Calendar,
    CheckCircle2, Clock, XCircle, LogOut,
    ChevronLeft as Prev, ChevronRight as Next,
    BarChart3
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRole, permissions } from "@/lib/roleContext";
import { Lock } from "lucide-react";

// ─── 출석 확인 모달 타입 ──────────────────────────────────────────
type ConfirmTarget = {
    student: Student;
    currentTime: Date;
};

// ─── 출석 상태 정의 ───────────────────────────────────────────────
const STATUS_CONFIG = {
    출석: {
        label: "출석",
        cardBg: "bg-indigo-600",
        cardText: "text-white",
        shadow: "shadow-indigo-200",
        badgeBg: "bg-indigo-500",
        pillBg: "bg-indigo-500 text-white",
        icon: <CheckCircle2 className="h-5 w-5" />,
    },
    지각: {
        label: "지각",
        cardBg: "bg-amber-400",
        cardText: "text-amber-900",
        shadow: "shadow-amber-200",
        badgeBg: "bg-amber-500",
        pillBg: "bg-amber-400 text-amber-900",
        icon: <Clock className="h-5 w-5" />,
    },
    결석: {
        label: "결석",
        cardBg: "bg-rose-500",
        cardText: "text-white",
        shadow: "shadow-rose-200",
        badgeBg: "bg-rose-500",
        pillBg: "bg-rose-500 text-white",
        icon: <XCircle className="h-5 w-5" />,
    },
    조퇴: {
        label: "조퇴",
        cardBg: "bg-slate-400",
        cardText: "text-white",
        shadow: "shadow-slate-200",
        badgeBg: "bg-slate-400",
        pillBg: "bg-slate-400 text-white",
        icon: <LogOut className="h-5 w-5" />,
    },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// ─── 날짜 유틸 ───────────────────────────────────────────────────
function toDateKey(date: Date) {
    return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
}
function formatDisplay(dateKey: string) {
    return new Date(dateKey + "T12:00:00").toLocaleDateString("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "long"
    });
}
function isToday(dateKey: string) {
    return dateKey === toDateKey(new Date());
}
function formatTime(date: Date) {
    return date.toLocaleTimeString("ko-KR", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
}

export default function TeacherDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: teacherId } = use(params);
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance>>({});
    const [loading, setLoading] = useState(true);
    // 선택된 날짜 (기본: 오늘)
    const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
    // 출석 확인 모달
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();
    const { roleInfo } = useRole();
    // 부장선생님만 출석 체크 가능
    const canCheck = permissions.canCheckAttendance(roleInfo.role);

    // ─── 선생님 & 학생 정보 로드 (최초 1회) ─────────────────────────
    useEffect(() => {
        async function fetchBase() {
            const { data: teacherData } = await supabase
                .from("teachers")
                .select("id, name, class_id, classes(name)")
                .eq("id", teacherId)
                .single();

            if (teacherData) {
                setTeacher(teacherData);
                const { data: studentData } = await supabase
                    .from("students")
                    .select("*")
                    .eq("class_id", teacherData.class_id)
                    .order("name");
                setStudents(studentData || []);
            }
            setLoading(false);
        }
        fetchBase();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teacherId]);

    // ─── 선택된 날짜의 출석 기록 로드 ────────────────────────────────
    const fetchAttendance = useCallback(async (dateKey: string) => {
        const { data } = await supabase
            .from("attendance")
            .select("*")
            .gte("check_in_at", `${dateKey}T00:00:00+09:00`)
            .lte("check_in_at", `${dateKey}T23:59:59+09:00`);

        const map: Record<string, Attendance> = {};
        data?.forEach((r) => { map[r.student_id] = r; });
        setAttendanceMap(map);
    }, [supabase]);

    useEffect(() => {
        fetchAttendance(selectedDate);
    }, [selectedDate, fetchAttendance]);

    // ─── 날짜 이동 ─────────────────────────────────────────────────
    function moveDate(delta: number) {
        const d = new Date(selectedDate + "T12:00:00");
        d.setDate(d.getDate() + delta);
        setSelectedDate(toDateKey(d));
        setConfirmTarget(null);
    }

    // ─── 학생 카드 클릭: 확인 모달 열기 ──────────────────────────────
    function handleCardClick(student: Student) {
        setConfirmTarget({ student, currentTime: new Date() });
    }

    // ─── 출석 확인 / 취소 처리 ────────────────────────────────────────
    async function confirmAttendance() {
        if (!confirmTarget || saving) return;
        setSaving(true);
        const { student, currentTime } = confirmTarget;
        const existing = attendanceMap[student.id];

        if (existing) {
            // 이미 출석 → 출석 취소
            await supabase.from("attendance").delete().eq("id", existing.id);
            const next = { ...attendanceMap };
            delete next[student.id];
            setAttendanceMap(next);
        } else {
            // 신규 출석 등록
            const checkIn = isToday(selectedDate)
                ? currentTime.toISOString()
                : `${selectedDate}T12:00:00+09:00`;
            const { data } = await supabase
                .from("attendance")
                .insert({ student_id: student.id, status: "출석", check_in_at: checkIn })
                .select()
                .single();
            if (data) setAttendanceMap({ ...attendanceMap, [student.id]: data });
        }
        setSaving(false);
        setConfirmTarget(null);
    }

    // ─── 통계 계산 ─────────────────────────────────────────────────
    const stats = Object.values(attendanceMap).reduce(
        (acc, r) => {
            const s = r.status as StatusKey;
            if (acc[s] !== undefined) acc[s]++;
            return acc;
        },
        { 출석: 0, 지각: 0, 결석: 0, 조퇴: 0 } as Record<StatusKey, number>
    );
    const checkedCount = Object.keys(attendanceMap).length;

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }
    if (!teacher) return null;

    return (
        <>
            {/* ── 출석 확인 모달 ──────────────────────────────────── */}
            {confirmTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={() => setConfirmTarget(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-[2rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden animate-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={cn(
                            "px-8 pt-8 pb-6 text-center",
                            attendanceMap[confirmTarget.student.id] ? "bg-rose-50" : "bg-indigo-50"
                        )}>
                            <div className="mx-auto mb-4 h-20 w-20 rounded-2xl overflow-hidden bg-white shadow-lg ring-2 ring-white">
                                {confirmTarget.student.photo_url ? (
                                    <img src={confirmTarget.student.photo_url} alt={confirmTarget.student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-indigo-100 text-3xl font-black text-indigo-400">
                                        {confirmTarget.student.name[0]}
                                    </div>
                                )}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900">{confirmTarget.student.name}</h2>
                            <p className={cn("mt-1 text-sm font-bold", attendanceMap[confirmTarget.student.id] ? "text-rose-500" : "text-indigo-500")}>
                                {attendanceMap[confirmTarget.student.id] ? "출석 체크를 취소하시겠습니까?" : "출석 체크 하시겠습니까?"}
                            </p>
                        </div>
                        {!attendanceMap[confirmTarget.student.id] && (
                            <div className="px-8 py-5 border-b border-slate-100">
                                <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 px-5 py-4">
                                    <Clock className="h-5 w-5 text-indigo-400" />
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">현재 시간</p>
                                        <p className="text-xl font-black text-slate-900">{formatTime(confirmTarget.currentTime)}</p>
                                    </div>
                                </div>
                                <p className="mt-2 text-center text-xs text-slate-400">이 시간으로 출석이 기록됩니다</p>
                            </div>
                        )}
                        <div className="flex gap-3 p-5">
                            <button onClick={() => setConfirmTarget(null)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3.5 text-sm font-black text-slate-600 hover:bg-slate-200 transition-all active:scale-95">취소</button>
                            <button onClick={confirmAttendance} disabled={saving}
                                className={cn("flex-1 rounded-2xl px-4 py-3.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60",
                                    attendanceMap[confirmTarget.student.id] ? "bg-rose-500 hover:bg-rose-600" : "bg-indigo-600 hover:bg-indigo-700"
                                )}>
                                {saving ? "처리 중..." : attendanceMap[confirmTarget.student.id] ? "취소하기" : "✓ 출석 확인"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 메인 ──────────────────────────────────────────────── */}
            <main
                className="min-h-screen p-4 md:p-10"
            >
                <div className="mx-auto max-w-5xl space-y-8">

                    {/* ── 헤더 ──────────────────────────────────────────── */}
                    <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in">
                        <div className="flex items-center gap-5">
                            <Link
                                href="/"
                                className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-400 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 hover:text-indigo-600 transition-all active:scale-90"
                            >
                                <ChevronLeft className="h-7 w-7 group-hover:-translate-x-1 transition-transform" />
                            </Link>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                                    {teacher.classes?.name}<span className="text-indigo-600">({teacher.name} 선생님)</span>
                                </h1>
                            </div>
                        </div>

                        {/* 날짜 선택기 */}
                        <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700">
                            <button
                                onClick={(e) => { e.stopPropagation(); moveDate(-1); }}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"
                            >
                                <Prev className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-2 px-2">
                                <Calendar className="h-4 w-4 text-indigo-500" />
                                <div className="text-center">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => { setSelectedDate(e.target.value); setConfirmTarget(null); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="border-0 bg-transparent text-sm font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                                    />
                                    {isToday(selectedDate) && (
                                        <span className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                            Today
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); moveDate(1); }}
                                disabled={isToday(selectedDate)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Next className="h-5 w-5" />
                            </button>
                        </div>
                    </header>

                    {/* ── 출석 현황 카드 ────────────────────────────────────── */}
                    <div className="rounded-2xl bg-white dark:bg-slate-800 px-6 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700 animate-in" style={{ animationDelay: "0.1s" }}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-slate-500">오늘 출석 현황</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                                <span className="text-indigo-600 text-xl">{checkedCount}</span>
                                <span className="text-slate-400 font-semibold"> / {students.length}명</span>
                            </span>
                        </div>
                        {/* 진행률 바 */}
                        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                                className="h-3 rounded-full bg-indigo-500 transition-all duration-500"
                                style={{ width: students.length > 0 ? `${Math.round((checkedCount / students.length) * 100)}%` : "0%" }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-slate-400 text-right font-semibold">
                            {students.length > 0 ? Math.round((checkedCount / students.length) * 100) : 0}% 출석
                        </p>
                    </div>

                    {/* ── 학생 카드 그리드 ──────────────────────────────────── */}
                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {students.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-400">
                                <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p className="font-semibold">이 반에 등록된 학생이 없습니다.</p>
                            </div>
                        )}
                        {students.map((student, index) => {
                            const record = attendanceMap[student.id];
                            const status = (record?.status ?? null) as StatusKey | null;
                            const cfg = status ? STATUS_CONFIG[status] : null;

                            return (
                                <div
                                    key={student.id}
                                    className="relative animate-in flex flex-col gap-1"
                                    style={{ animationDelay: `${0.05 + index * 0.03}s` }}
                                >
                                    {/* 학생 카드 */}
                                    <button
                                        onClick={() => {
                                            if (!canCheck) return; // 권한 없으면 무시
                                            handleCardClick(student);
                                        }}
                                        className={cn(
                                            "w-full rounded-[1.75rem] p-5 transition-all duration-300 active:scale-95 text-left",
                                            !canCheck && "cursor-default",
                                            cfg
                                                ? `${cfg.cardBg} ${cfg.cardText} shadow-2xl ${cfg.shadow} ring-1 ring-white/10`
                                                : "bg-white/80 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-xl shadow-slate-200/40 dark:shadow-none ring-1 ring-white/20 hover:bg-white dark:hover:bg-slate-900"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* 사진 / 이니셜 */}
                                            <div className={cn(
                                                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden",
                                                cfg ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                                            )}>
                                                {student.photo_url ? (
                                                    <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className={cn("text-2xl font-black", cfg ? cfg.cardText : "text-slate-400")}>
                                                        {student.name[0]}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-extrabold truncate">{student.name}</h3>
                                                {status ? (
                                                    <span className={cn("inline-flex items-center gap-1 mt-1 text-xs font-black rounded-full px-2 py-0.5 opacity-90", cfg?.pillBg)}>
                                                        {cfg?.icon} {status}
                                                    </span>
                                                ) : (
                                                    <span className="mt-1 text-xs font-bold text-slate-400">
                                                        {canCheck ? "탭하여 상태 선택" : "출석 정보 없음"}
                                                    </span>
                                                )}
                                            </div>

                                            {status && (
                                                <div className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-white/20", cfg?.cardText)}>
                                                    {cfg?.icon}
                                                </div>
                                            )}
                                        </div>
                                    </button>

                                    {/* 연간 출석현황 링크 버튼 */}
                                    <Link
                                        href={`/students/${student.id}`}
                                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 transition-all ring-1 ring-slate-200/60 dark:ring-slate-700"
                                    >
                                        <BarChart3 className="h-3.5 w-3.5" />
                                        연간 출석현황
                                    </Link>
                                </div>
                            );
                        })}
                    </section>

                    {/* ── 안내 문구 ────────────────────────────────────────── */}
                    {!canCheck && (
                        <div className="flex items-center justify-center gap-2 rounded-2xl bg-amber-50 py-3 px-5 text-sm font-semibold text-amber-600">
                            <Lock className="h-4 w-4" />
                            출석 체크는 부장선생님만 가능합니다. 현재 조회 전용 모드입니다.
                        </div>
                    )}
                    {!isToday(selectedDate) && (
                        <p className="text-center text-sm font-semibold text-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-2xl py-3">
                            ⚠️ 과거 날짜를 조회 중입니다 — {formatDisplay(selectedDate)}
                        </p>
                    )}
                </div>
            </main>
        </>
    );
}
