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
    // 상태 선택 팝업: 어떤 학생의 팝업이 열려있는가 (null = 닫힘)
    const [statusPopup, setStatusPopup] = useState<string | null>(null);
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
        setStatusPopup(null);
    }

    // ─── 출석 상태 저장 (신규 or 업데이트 or 삭제) ────────────────────
    async function setStatus(studentId: string, status: StatusKey | null) {
        setStatusPopup(null);
        const existing = attendanceMap[studentId];

        // 같은 상태를 다시 누르면 → 출석 취소
        if (existing && (status === null || existing.status === status)) {
            await supabase.from("attendance").delete().eq("id", existing.id);
            const next = { ...attendanceMap };
            delete next[studentId];
            setAttendanceMap(next);
            return;
        }

        if (existing) {
            // 상태 변경
            const { data } = await supabase
                .from("attendance")
                .update({ status })
                .eq("id", existing.id)
                .select()
                .single();
            if (data) setAttendanceMap({ ...attendanceMap, [studentId]: data });
        } else {
            // 신규 등록 (선택한 날짜 + 정오 기준)
            const checkIn = isToday(selectedDate)
                ? new Date().toISOString()
                : `${selectedDate}T12:00:00+09:00`;
            const { data } = await supabase
                .from("attendance")
                .insert({ student_id: studentId, status, check_in_at: checkIn })
                .select()
                .single();
            if (data) setAttendanceMap({ ...attendanceMap, [studentId]: data });
        }
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
        // 팝업 바깥 클릭 시 닫기
        <main
            className="min-h-screen p-4 md:p-10"
            onClick={() => setStatusPopup(null)}
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
                                {teacher.classes?.name}{" "}
                                <span className="text-indigo-600">출석부</span>
                                <span className="ml-2 text-2xl font-bold text-slate-400">
                                    {teacher.name} 선생님
                                </span>
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
                                    onChange={(e) => { setSelectedDate(e.target.value); setStatusPopup(null); }}
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

                {/* ── 통계 배지 ────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-3 animate-in" style={{ animationDelay: "0.1s" }}>
                    <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-3 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">전체</span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {checkedCount}<span className="text-sm font-semibold text-slate-400"> / {students.length}</span>
                        </div>
                    </div>
                    {(["출석", "지각", "결석", "조퇴"] as StatusKey[]).map((s) => (
                        <div key={s} className={cn("rounded-2xl px-5 py-3 shadow-md", STATUS_CONFIG[s].cardBg, STATUS_CONFIG[s].shadow)}>
                            <span className={cn("text-xs font-bold uppercase tracking-widest opacity-80", STATUS_CONFIG[s].cardText)}>{s}</span>
                            <div className={cn("text-2xl font-black", STATUS_CONFIG[s].cardText)}>{stats[s]}</div>
                        </div>
                    ))}
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
                        const isPopupOpen = statusPopup === student.id;

                        return (
                            <div
                                key={student.id}
                                className="relative animate-in flex flex-col gap-1"
                                style={{ animationDelay: `${0.05 + index * 0.03}s` }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* 학생 카드 */}
                                <button
                                    onClick={() => {
                                        if (!canCheck) return; // 권한 없으면 무시
                                        setStatusPopup(isPopupOpen ? null : student.id);
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

                                {/* 상태 선택 팝업 */}
                                {isPopupOpen && (
                                    <div className="absolute bottom-full left-0 right-0 mb-3 z-50 animate-in">
                                        <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-2xl shadow-slate-300/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-700 p-2 flex gap-2">
                                            {(["출석", "지각", "결석", "조퇴"] as StatusKey[]).map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => setStatus(student.id, s)}
                                                    className={cn(
                                                        "flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all text-xs font-black",
                                                        record?.status === s
                                                            ? `${STATUS_CONFIG[s].cardBg} ${STATUS_CONFIG[s].cardText}`
                                                            : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                    )}
                                                >
                                                    <span className="text-base">{STATUS_CONFIG[s].icon}</span>
                                                    {s}
                                                </button>
                                            ))}
                                            {/* 취소 버튼 */}
                                            {status && (
                                                <button
                                                    onClick={() => setStatus(student.id, null)}
                                                    className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-400 text-xs font-black transition-all"
                                                >
                                                    <XCircle className="text-base" />
                                                    취소
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 연간 출석현황 링크 버튼 */}
                                <Link
                                    href={`/students/${student.id}`}
                                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 transition-all ring-1 ring-slate-200/60 dark:ring-slate-700"
                                    onClick={(e) => e.stopPropagation()}
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
    );
}
