"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Student, Attendance } from "@/types";
import {
    ChevronLeft, ChevronLeft as Prev, ChevronRight as Next,
    CheckCircle2, Sparkles, BarChart3
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/roleContext";
import { useRouter } from "next/navigation";

// ─── 출석 상태별 색상 정의 ───────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
    출석: "bg-indigo-500 text-white",
    지각: "bg-amber-400 text-amber-900",
    결석: "bg-rose-500 text-white",
    조퇴: "bg-slate-400 text-white",
};

const STATUS_DOT: Record<string, string> = {
    출석: "bg-indigo-500",
    지각: "bg-amber-400",
    결석: "bg-rose-500",
    조퇴: "bg-slate-400",
};

// ─── 날짜 유틸 ───────────────────────────────────────────────────
// 어떤 년도의 모든 일요일 날짜 배열을 반환
function getAllSundaysOfYear(year: number): Date[] {
    const sundays: Date[] = [];
    const d = new Date(year, 0, 1); // 1월 1일
    // 첫 번째 일요일로 이동
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getFullYear() === year) {
        sundays.push(new Date(d));
        d.setDate(d.getDate() + 7);
    }
    return sundays;
}

// 날짜를 "YYYY-MM-DD" 키로 변환
function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월"];

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function StudentAttendancePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: studentId } = use(params);
    const router = useRouter();
    const { roleInfo } = useRole();
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [student, setStudent] = useState<any | null>(null);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance>>({});
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // ─── 학생 정보 로드 + 권한 체크 ──────────────────────────────
    useEffect(() => {
        async function fetchStudent() {
            const { data } = await supabase
                .from("students")
                .select("id, name, photo_url, class_id, classes(name)")
                .eq("id", studentId)
                .single();

            if (!data) { router.replace("/"); return; }

            // 반 선생님 권한 체크: 본인 반 학생만 조회 가능
            if (roleInfo.role === "teacher" && roleInfo.teacherId) {
                const { data: teacher } = await supabase
                    .from("teachers")
                    .select("class_id")
                    .eq("id", roleInfo.teacherId)
                    .single();

                if (teacher && teacher.class_id !== data.class_id) {
                    router.replace("/");
                    return;
                }
            }

            // 역할이 없으면 메인으로
            if (!roleInfo.role) { router.replace("/"); return; }

            setStudent(data);
        }

        if (roleInfo.role !== undefined) {
            fetchStudent();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId, roleInfo.role]);

    // ─── 선택된 년도의 출석 기록 전체 로드 ───────────────────────
    useEffect(() => {
        async function fetchYearAttendance() {
            setLoading(true);
            const { data } = await supabase
                .from("attendance")
                .select("*")
                .eq("student_id", studentId)
                .gte("check_in_at", `${selectedYear}-01-01T00:00:00+09:00`)
                .lte("check_in_at", `${selectedYear}-12-31T23:59:59+09:00`);

            const map: Record<string, Attendance> = {};
            data?.forEach((r) => {
                // 한국 시간 기준으로 날짜 키 생성
                const d = new Date(r.check_in_at);
                const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                const key = kst.toISOString().split("T")[0];
                map[key] = r;
            });
            setAttendanceMap(map);
            setLoading(false);
        }

        if (student) fetchYearAttendance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student, selectedYear]);

    // ─── 이 년도의 모든 일요일 ────────────────────────────────────
    const allSundays = getAllSundaysOfYear(selectedYear);

    // ─── 통계 계산 ─────────────────────────────────────────────────
    // 오늘 이전의 일요일만 집계 대상
    const today = new Date();
    const pastSundays = allSundays.filter(d => d <= today);
    const totalSundays = pastSundays.length;
    const attendedCount = pastSundays.filter(d => {
        const status = attendanceMap[toDateKey(d)]?.status;
        return status === "출석" || status === "지각";
    }).length;
    const absentCount = pastSundays.filter(d => attendanceMap[toDateKey(d)]?.status === "결석").length;
    const uncheckedCount = pastSundays.filter(d => !attendanceMap[toDateKey(d)]).length;
    const attendanceRate = totalSundays > 0
        ? Math.round((attendedCount / totalSundays) * 100)
        : 0;

    // ─── 년도 선택 가능 범위 (최근 5년) ─────────────────────────
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    if (!student) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-10">
            <div className="mx-auto max-w-5xl space-y-8">

                {/* ── 헤더 ──────────────────────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in">
                    <div className="flex items-center gap-5">
                        <button
                            onClick={() => router.back()}
                            className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-400 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 hover:text-indigo-600 transition-all active:scale-90"
                        >
                            <ChevronLeft className="h-7 w-7 group-hover:-translate-x-1 transition-transform" />
                        </button>

                        {/* 학생 사진 + 이름 */}
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-indigo-100 shadow-lg">
                                {student.photo_url ? (
                                    <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-2xl font-black text-indigo-400">
                                        {student.name[0]}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 mb-1">
                                    <Sparkles className="h-3 w-3" />
                                    {(student as any).classes?.name || "반 정보 없음"}
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                                    {student.name}
                                </h1>
                                <p className="text-sm text-slate-500">연간 출석 현황</p>
                            </div>
                        </div>
                    </div>

                    {/* 년도 선택기 */}
                    <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700">
                        <button
                            onClick={() => setSelectedYear(y => y - 1)}
                            disabled={selectedYear <= currentYear - 4}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Prev className="h-5 w-5" />
                        </button>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="border-0 bg-transparent text-base font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer px-2"
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}년</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setSelectedYear(y => y + 1)}
                            disabled={selectedYear >= currentYear}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Next className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                {/* ── 연간 통계 배지 ─────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in" style={{ animationDelay: "0.1s" }}>
                    {/* 출석률 */}
                    <div className="col-span-2 sm:col-span-1 rounded-2xl bg-indigo-600 px-5 py-4 shadow-md shadow-indigo-200">
                        <div className="flex items-center gap-1.5 mb-1">
                            <BarChart3 className="h-3.5 w-3.5 text-indigo-300" />
                            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wide">출석률</span>
                        </div>
                        <div className="text-3xl font-black text-white">{attendanceRate}%</div>
                        <div className="text-xs text-indigo-300 mt-0.5">{totalSundays}주 중 {attendedCount}주</div>
                    </div>
                    {/* 출석 */}
                    <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-indigo-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">출석</span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">{attendedCount}</div>
                        <div className="text-xs text-slate-400 mt-0.5">출석 + 지각</div>
                    </div>
                    {/* 결석 */}
                    <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-rose-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">결석</span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">{absentCount}</div>
                    </div>
                    {/* 미기록 */}
                    <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="h-2 w-2 rounded-full bg-slate-300" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">미기록</span>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">{uncheckedCount}</div>
                    </div>
                </div>

                {/* 로딩 */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    </div>
                ) : (
                    <>
                        {/* 범례 */}
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold animate-in" style={{ animationDelay: "0.15s" }}>
                            <span className="text-slate-400 uppercase tracking-widest">범례</span>
                            {Object.entries(STATUS_DOT).map(([label, color]) => (
                                <span key={label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                    <span className={cn("h-3 w-3 rounded-full inline-block", color)} />
                                    {label}
                                </span>
                            ))}
                            <span className="flex items-center gap-1.5 text-slate-400">
                                <span className="h-3 w-3 rounded-full inline-block bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-600" />
                                미기록
                            </span>
                        </div>

                        {/* ── 월별 캘린더 그리드 ───────────────────────────── */}
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-in" style={{ animationDelay: "0.2s" }}>
                            {MONTH_NAMES.map((monthName, monthIdx) => {
                                // 이 달의 일요일들만 추출
                                const sundaysInMonth = allSundays.filter(d => d.getMonth() === monthIdx);

                                return (
                                    <div
                                        key={monthIdx}
                                        className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-md ring-1 ring-slate-100 dark:ring-slate-700"
                                    >
                                        {/* 월 헤더 */}
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-base font-black text-slate-900 dark:text-white">{monthName}</h3>
                                            {/* 이 달의 출석 수 */}
                                            <span className="text-xs font-bold text-slate-400">
                                                {sundaysInMonth.filter(d => {
                                                    const s = attendanceMap[toDateKey(d)]?.status;
                                                    return s === "출석" || s === "지각";
                                                }).length} / {
                                                    sundaysInMonth.filter(d => d <= today).length
                                                }
                                            </span>
                                        </div>

                                        {sundaysInMonth.length === 0 ? (
                                            <p className="text-xs text-slate-300 text-center py-4">일요일 없음</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {sundaysInMonth.map((sunday) => {
                                                    const dateKey = toDateKey(sunday);
                                                    const record = attendanceMap[dateKey];
                                                    const status = record?.status ?? null;
                                                    const isFuture = sunday > today;
                                                    const dayNum = sunday.getDate();

                                                    // 색상 결정
                                                    const colorClass = isFuture
                                                        ? "bg-slate-50 dark:bg-slate-700 text-slate-300 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-600"
                                                        : status
                                                            ? STATUS_COLOR[status] || "bg-slate-400 text-white"
                                                            : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 ring-1 ring-slate-200 dark:ring-slate-600";

                                                    return (
                                                        <div
                                                            key={dateKey}
                                                            title={`${dateKey} — ${status ?? (isFuture ? "예정" : "미기록")}`}
                                                            className={cn(
                                                                "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-all",
                                                                colorClass
                                                            )}
                                                        >
                                                            {dayNum}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 하단 안내 */}
                        <p className="text-center text-xs text-slate-400 pb-8">
                            매 일요일 기준으로 집계됩니다. 미래 날짜는 연한 색으로 표시됩니다.
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
