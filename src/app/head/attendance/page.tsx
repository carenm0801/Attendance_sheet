"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Student, Attendance } from "@/types";
import {
    ChevronLeft, Sparkles, Calendar,
    CheckCircle2, XCircle,
    ChevronLeft as Prev, ChevronRight as Next,
    Users, Star, Clock, BarChart3,
    ClipboardList, TrendingUp
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/roleContext";
import { useRouter } from "next/navigation";

// ─── 반별 학생 그룹 타입 ──────────────────────────────────────────
type ClassGroup = {
    classId: string;
    className: string;
    teacherName?: string; // 담당 선생님 이름
    students: Student[];
};

// ─── 출석 확인 모달 타입 ──────────────────────────────────────────
type ConfirmTarget = {
    student: Student;
    currentTime: Date;
};

// ─── 주간 출석 통계 타입 ──────────────────────────────────────────
type WeekStat = {
    dateKey: string;   // "YYYY-MM-DD" (일요일 날짜)
    total: number;     // 전체 학생 수
    attended: number;  // 출석 인원 (출석+지각)
    absent: number;    // 결석
    unchecked: number; // 미기록
};

// ─── 학생별 연간 출석 집계 타입 ───────────────────────────────────
type StudentStat = {
    student: Student & { className?: string };
    attended: number;
    absent: number;
    total: number; // 지난 일요일 수
};

// ─── 날짜 유틸 ───────────────────────────────────────────────────
function toDateKey(date: Date) {
    return date.toISOString().split("T")[0];
}
function formatShort(dateKey: string) {
    return new Date(dateKey + "T12:00:00").toLocaleDateString("ko-KR", {
        month: "short", day: "numeric",
    });
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
// 올해의 지난 일요일 + 오늘(일요일이면 포함) 목록
function getPastSundaysOfYear(year: number): string[] {
    const sundays: string[] = [];
    const d = new Date(year, 0, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    const today = new Date();
    while (d.getFullYear() === year && d <= today) {
        sundays.push(toDateKey(new Date(d)));
        d.setDate(d.getDate() + 7);
    }
    return sundays;
}

export default function HeadAttendancePage() {
    const router = useRouter();
    const { roleInfo } = useRole();

    // 부장선생님 또는 관리자가 아니면 메인으로 이동
    useEffect(() => {
        if (roleInfo.role !== null && roleInfo.role !== "head_teacher" && roleInfo.role !== "admin") {
            router.replace("/");
        }
    }, [roleInfo.role, router]);

    // ─── 현재 탭 ─────────────────────────────────────────────────
    const [tab, setTab] = useState<"check" | "stats">("check");

    // ─── 공통 상태 ───────────────────────────────────────────────
    const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
    const [allStudents, setAllStudents] = useState<(Student & { className?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // ─── 출석체크 탭 상태 ─────────────────────────────────────────
    const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance>>({});
    const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
    const [saving, setSaving] = useState(false);

    // ─── 출석현황 탭 상태 ─────────────────────────────────────────
    const [weekStats, setWeekStats] = useState<WeekStat[]>([]);
    const [studentStats, setStudentStats] = useState<StudentStat[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsYear] = useState(new Date().getFullYear());

    // ─── 학생 & 반 데이터 로드 ────────────────────────────────────
    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            const { data: classes } = await supabase.from("classes").select("id, name").order("name");
            const { data: students } = await supabase.from("students").select("id, name, photo_url, class_id").order("name");
            // 선생님 정보 로드 (반별 담당 선생님 이름 표시용)
            const { data: teachers } = await supabase.from("teachers").select("name, class_id");

            if (classes && students) {
                // 반 ID → 선생님 이름 매핑
                const teacherMap: Record<string, string> = {};
                teachers?.forEach(t => { teacherMap[t.class_id] = t.name; });

                // 반별 그룹화 (출석체크 탭용)
                const groups: ClassGroup[] = classes.map((cls) => ({
                    classId: cls.id,
                    className: cls.name,
                    teacherName: teacherMap[cls.id], // 담당 선생님 이름
                    students: students.filter((s) => s.class_id === cls.id),
                })).filter((g) => g.students.length > 0);
                setClassGroups(groups);

                // 학생에 반 이름 붙이기 (출석현황 탭용)
                const classMap: Record<string, string> = {};
                classes.forEach(c => { classMap[c.id] = c.name; });
                const studentsWithClass = students.map(s => ({
                    ...s,
                    className: classMap[s.class_id] || "",
                }));
                setAllStudents(studentsWithClass);
            }
            setLoading(false);
        }
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── 출석체크 탭: 날짜별 출석 로드 ──────────────────────────
    const fetchAttendance = useCallback(async (dateKey: string) => {
        const { data } = await supabase
            .from("attendance").select("*")
            .gte("check_in_at", `${dateKey}T00:00:00+09:00`)
            .lte("check_in_at", `${dateKey}T23:59:59+09:00`);
        const map: Record<string, Attendance> = {};
        data?.forEach((r) => { map[r.student_id] = r; });
        setAttendanceMap(map);
    }, [supabase]);

    useEffect(() => { fetchAttendance(selectedDate); }, [selectedDate, fetchAttendance]);

    // ─── 출석현황 탭: 연간 통계 계산 ─────────────────────────────
    useEffect(() => {
        if (tab !== "stats" || allStudents.length === 0) return;
        async function fetchStats() {
            setStatsLoading(true);
            const sundays = getPastSundaysOfYear(statsYear);
            const totalStudents = allStudents.length;

            // 올해 전체 출석 기록 한 번에 가져오기
            const { data: records } = await supabase
                .from("attendance").select("*")
                .gte("check_in_at", `${statsYear}-01-01T00:00:00+09:00`)
                .lte("check_in_at", `${statsYear}-12-31T23:59:59+09:00`);

            // 날짜별 Map: dateKey → attendance[]
            const byDate: Record<string, Attendance[]> = {};
            records?.forEach(r => {
                const d = new Date(r.check_in_at);
                const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                const key = kst.toISOString().split("T")[0];
                if (!byDate[key]) byDate[key] = [];
                byDate[key].push(r);
            });

            // 학생별 Map: studentId → attendance[]
            const byStudent: Record<string, Attendance[]> = {};
            records?.forEach(r => {
                if (!byStudent[r.student_id]) byStudent[r.student_id] = [];
                byStudent[r.student_id].push(r);
            });

            // 주간 통계 계산 (최신순으로 정렬)
            const wStats: WeekStat[] = sundays.map(dateKey => {
                const dayRecords = byDate[dateKey] || [];
                const attended = dayRecords.filter(r => r.status === "출석" || r.status === "지각").length;
                const absent = dayRecords.filter(r => r.status === "결석").length;
                return {
                    dateKey,
                    total: totalStudents,
                    attended,
                    absent,
                    unchecked: totalStudents - dayRecords.length,
                };
            }).reverse(); // 최신 날짜가 위에 오도록
            setWeekStats(wStats);

            // 학생별 통계 계산
            const totalSundays = sundays.length;
            const sStats: StudentStat[] = allStudents.map(student => {
                const sRecords = byStudent[student.id] || [];
                const attended = sRecords.filter(r => r.status === "출석" || r.status === "지각").length;
                const absent = sRecords.filter(r => r.status === "결석").length;
                return { student, attended, absent, total: totalSundays };
            }).sort((a, b) => b.attended - a.attended); // 출석 많은 순 정렬
            setStudentStats(sStats);

            setStatsLoading(false);
        }
        fetchStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, allStudents, statsYear]);

    // ─── 출석체크: 날짜 이동 ──────────────────────────────────────
    function moveDate(delta: number) {
        const d = new Date(selectedDate + "T12:00:00");
        d.setDate(d.getDate() + delta);
        setSelectedDate(toDateKey(d));
        setConfirmTarget(null);
    }

    // ─── 출석체크: 학생 카드 클릭 ─────────────────────────────────
    function handleCardClick(student: Student) {
        setConfirmTarget({ student, currentTime: new Date() });
    }

    // ─── 출석체크: 출석 저장 ──────────────────────────────────────
    async function confirmAttendance() {
        if (!confirmTarget || saving) return;
        setSaving(true);
        const { student, currentTime } = confirmTarget;
        const existing = attendanceMap[student.id];

        if (existing) {
            await supabase.from("attendance").delete().eq("id", existing.id);
            const next = { ...attendanceMap };
            delete next[student.id];
            setAttendanceMap(next);
        } else {
            const checkIn = isToday(selectedDate)
                ? currentTime.toISOString()
                : `${selectedDate}T12:00:00+09:00`;
            const { data } = await supabase
                .from("attendance")
                .insert({ student_id: student.id, status: "출석", check_in_at: checkIn })
                .select().single();
            if (data) setAttendanceMap({ ...attendanceMap, [student.id]: data });
        }
        setSaving(false);
        setConfirmTarget(null);
    }

    // ─── 통계 (출석체크 탭) ───────────────────────────────────────
    const totalStudents = classGroups.reduce((sum, g) => sum + g.students.length, 0);
    const checkedCount = Object.keys(attendanceMap).length;

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <p className="text-lg font-medium text-slate-500 animate-pulse">불러오는 중...</p>
                </div>
            </div>
        );
    }

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
            <main className="min-h-screen p-4 md:p-10">
                <div className="mx-auto max-w-6xl space-y-6">

                    {/* ── 헤더 ────────────────────────────────────────── */}
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in">
                        <div className="flex items-center gap-4">
                            <Link href="/"
                                className="group flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-400 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 hover:text-indigo-600 transition-all active:scale-90">
                                <ChevronLeft className="h-7 w-7 group-hover:-translate-x-1 transition-transform" />
                            </Link>
                            <div>
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-600 mb-1">
                                    <Star className="h-3 w-3" /> 부장선생님 전용
                                </div>
                                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                                    {tab === "check" ? <>전체 <span className="text-indigo-600">출석부</span></> : <>출석 <span className="text-indigo-600">현황</span></>}
                                </h1>
                            </div>
                        </div>

                        {/* 날짜 선택기 (출석체크 탭에서만 표시) */}
                        {tab === "check" && (
                            <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700">
                                <button onClick={() => moveDate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
                                    <Prev className="h-5 w-5" />
                                </button>
                                <div className="flex items-center gap-2 px-2">
                                    <Calendar className="h-4 w-4 text-indigo-500" />
                                    <div className="text-center">
                                        <input type="date" value={selectedDate}
                                            onChange={(e) => { setSelectedDate(e.target.value); setConfirmTarget(null); }}
                                            className="border-0 bg-transparent text-sm font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer" />
                                        {isToday(selectedDate) && <span className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest">Today</span>}
                                    </div>
                                </div>
                                <button onClick={() => moveDate(1)} disabled={isToday(selectedDate)}
                                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                                    <Next className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                    </header>

                    {/* ── 탭 전환 버튼 ────────────────────────────────── */}
                    <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1.5 gap-1.5">
                        <button
                            onClick={() => setTab("check")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all",
                                tab === "check"
                                    ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-md"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <ClipboardList className="h-4 w-4" /> 출석 체크
                        </button>
                        <button
                            onClick={() => setTab("stats")}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all",
                                tab === "stats"
                                    ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-md"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <TrendingUp className="h-4 w-4" /> 출석 현황
                        </button>
                    </div>

                    {/* ════════════════════════════════════════════════ */}
                    {/* 탭 1: 출석 체크 */}
                    {/* ════════════════════════════════════════════════ */}
                    {tab === "check" && (
                        <>
                            {/* 통계 배지 */}
                            <div className="flex flex-wrap gap-3 animate-in">
                                <div className="rounded-2xl bg-indigo-600 px-5 py-3 shadow-md shadow-indigo-200">
                                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">출석 완료</span>
                                    <div className="text-2xl font-black text-white">
                                        {checkedCount}<span className="text-sm font-semibold text-indigo-300"> / {totalStudents}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-slate-100 dark:bg-slate-700 px-5 py-3 shadow-md">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">미체크</span>
                                    <div className="text-2xl font-black text-slate-600 dark:text-slate-200">{totalStudents - checkedCount}</div>
                                </div>
                            </div>

                            {!isToday(selectedDate) && (
                                <p className="text-center text-sm font-semibold text-amber-500 bg-amber-50 rounded-2xl py-3">
                                    ⚠️ 과거 날짜를 조회 중입니다 — {formatDisplay(selectedDate)}
                                </p>
                            )}

                            {/* 반별 학생 그리드 */}
                            {classGroups.length === 0 ? (
                                <div className="rounded-[2.5rem] bg-white/50 border-2 border-dashed border-slate-200 p-20 text-center">
                                    <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p className="font-semibold text-slate-400">등록된 학생이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {classGroups.map((group, groupIndex) => {
                                        const groupChecked = group.students.filter(s => attendanceMap[s.id]).length;
                                        return (
                                            <section key={group.classId} className="animate-in" style={{ animationDelay: `${0.1 + groupIndex * 0.05}s` }}>
                                                <div className="mb-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100"><Sparkles className="h-4 w-4 text-indigo-500" /></div>
                                                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{group.className}</h2>
                                                        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-500">{group.students.length}명</span>
                                                        {/* 담당 선생님 이름 뱃지 */}
                                                        {group.teacherName && (
                                                            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-0.5 text-xs font-bold text-indigo-500">
                                                                👩‍🏫 {group.teacherName} 선생님
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-black text-indigo-600">{groupChecked}</span>
                                                        <span className="text-sm font-semibold text-slate-400">/{group.students.length} 체크</span>
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                    {group.students.map((student, index) => {
                                                        const isChecked = !!attendanceMap[student.id];
                                                        const record = attendanceMap[student.id];
                                                        const checkedTimeStr = record
                                                            ? new Date(record.check_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: true })
                                                            : null;
                                                        return (
                                                            <div key={student.id} className="animate-in flex flex-col gap-1" style={{ animationDelay: `${0.05 + index * 0.02}s` }}>
                                                                <button
                                                                    onClick={() => handleCardClick(student)}
                                                                    className={cn(
                                                                        "w-full rounded-[1.75rem] p-5 transition-all duration-300 active:scale-95 text-left",
                                                                        isChecked
                                                                            ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-1 ring-white/10"
                                                                            : "bg-white/80 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-xl shadow-slate-200/40 ring-1 ring-white/20 hover:bg-white"
                                                                    )}>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden", isChecked ? "bg-white/20" : "bg-slate-100")}>
                                                                            {student.photo_url
                                                                                ? <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                                                                                : <span className={cn("text-2xl font-black", isChecked ? "text-white" : "text-slate-400")}>{student.name[0]}</span>
                                                                            }
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h3 className="text-lg font-extrabold truncate">{student.name}</h3>
                                                                            {isChecked
                                                                                ? <span className="inline-flex items-center gap-1 mt-1 text-xs font-black text-indigo-200"><CheckCircle2 className="h-3.5 w-3.5" />{checkedTimeStr} 출석</span>
                                                                                : <span className="mt-1 text-xs font-bold text-slate-400">탭하여 출석 체크</span>
                                                                            }
                                                                        </div>
                                                                        {isChecked && <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"><CheckCircle2 className="h-5 w-5" /></div>}
                                                                    </div>
                                                                </button>
                                                                <Link href={`/students/${student.id}`}
                                                                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 py-2 text-xs font-bold text-slate-500 hover:bg-white hover:text-indigo-600 transition-all ring-1 ring-slate-200/60">
                                                                    <BarChart3 className="h-3.5 w-3.5" /> 연간 출석현황
                                                                </Link>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ════════════════════════════════════════════════ */}
                    {/* 탭 2: 출석 현황 */}
                    {/* ════════════════════════════════════════════════ */}
                    {tab === "stats" && (
                        <>
                            {statsLoading ? (
                                <div className="flex items-center justify-center py-24">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                                </div>
                            ) : (
                                <div className="space-y-10 animate-in">

                                    {/* ── 주간 출석 통계 테이블 ──────────────────── */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100"><Calendar className="h-4 w-4 text-indigo-500" /></div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white">주간 출석 통계</h2>
                                            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-500">{statsYear}년</span>
                                        </div>
                                        <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-md ring-1 ring-slate-100 dark:ring-slate-700 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                        <th className="px-5 py-3.5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">날짜</th>
                                                        <th className="px-5 py-3.5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">출석</th>
                                                        <th className="px-5 py-3.5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">결석</th>
                                                        <th className="px-5 py-3.5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">미기록</th>
                                                        <th className="px-5 py-3.5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">출석률</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {weekStats.length === 0 ? (
                                                        <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-semibold">출석 기록이 없습니다</td></tr>
                                                    ) : (
                                                        weekStats.map((ws, i) => {
                                                            const rate = ws.total > 0 ? Math.round((ws.attended / ws.total) * 100) : 0;
                                                            const isFirst = i === 0;
                                                            return (
                                                                <tr key={ws.dateKey} className={cn("border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors", isFirst && "bg-indigo-50/50")}>
                                                                    <td className="px-5 py-3.5">
                                                                        <span className={cn("font-bold", isFirst ? "text-indigo-600" : "text-slate-900 dark:text-white")}>
                                                                            {formatShort(ws.dateKey)}
                                                                        </span>
                                                                        {isFirst && <span className="ml-2 text-[10px] font-black bg-indigo-100 text-indigo-600 rounded-full px-2 py-0.5">최근</span>}
                                                                    </td>
                                                                    <td className="px-5 py-3.5 text-center font-black text-indigo-600">{ws.attended}<span className="text-slate-400 font-semibold text-xs">/{ws.total}</span></td>
                                                                    <td className="px-5 py-3.5 text-center font-bold text-rose-500">{ws.absent}</td>
                                                                    <td className="px-5 py-3.5 text-center font-bold text-slate-400">{ws.unchecked}</td>
                                                                    <td className="px-5 py-3.5 text-center">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <div className="w-16 rounded-full bg-slate-100 dark:bg-slate-700 h-2">
                                                                                <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${rate}%` }} />
                                                                            </div>
                                                                            <span className="font-black text-slate-700 dark:text-white text-xs w-8 text-right">{rate}%</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>

                                    {/* ── 전체 학생 출석 현황 ─────────────────────── */}
                                    <section>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100"><Users className="h-4 w-4 text-indigo-500" /></div>
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white">전체 학생 출석 현황</h2>
                                            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-500">{statsYear}년</span>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {studentStats.map((ss, index) => {
                                                const rate = ss.total > 0 ? Math.round((ss.attended / ss.total) * 100) : 0;
                                                return (
                                                    <Link
                                                        key={ss.student.id}
                                                        href={`/students/${ss.student.id}`}
                                                        className="group flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700 hover:ring-indigo-400 hover:shadow-indigo-100 transition-all animate-in"
                                                        style={{ animationDelay: `${index * 0.02}s` }}
                                                    >
                                                        {/* 사진 */}
                                                        <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-indigo-100">
                                                            {ss.student.photo_url
                                                                ? <img src={ss.student.photo_url} alt={ss.student.name} className="h-full w-full object-cover" />
                                                                : <div className="h-full w-full flex items-center justify-center text-lg font-black text-indigo-400">{ss.student.name[0]}</div>
                                                            }
                                                        </div>
                                                        {/* 이름 + 반 */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{ss.student.name}</p>
                                                            <p className="text-[11px] font-bold text-slate-400 truncate">{ss.student.className}</p>
                                                            {/* 출석률 바 */}
                                                            <div className="mt-1.5 flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                                                                    <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${rate}%` }} />
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-500 w-8 text-right">{rate}%</span>
                                                            </div>
                                                        </div>
                                                        {/* 출석/전체 */}
                                                        <div className="text-right shrink-0">
                                                            <p className="text-lg font-black text-indigo-600">{ss.attended}</p>
                                                            <p className="text-[11px] font-bold text-slate-400">/{ss.total}주</p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
