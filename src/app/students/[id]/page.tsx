"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { Student, Attendance } from "@/types";
import {
    ChevronLeft, ChevronLeft as Prev, ChevronRight as Next,
    CheckCircle2, Sparkles, BarChart3,
    Phone, MapPin, FileText, User, Save, Edit3
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRole, permissions } from "@/lib/roleContext";
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
function getAllSundaysOfYear(year: number): Date[] {
    const sundays: Date[] = [];
    const d = new Date(year, 0, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getFullYear() === year) {
        sundays.push(new Date(d));
        d.setDate(d.getDate() + 7);
    }
    return sundays;
}

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
    const [teacherClassId, setTeacherClassId] = useState<string | undefined>();
    const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance>>({});
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // 탭: 출석현황 | 학생정보
    const [tab, setTab] = useState<"attendance" | "info">("attendance");

    // 학생 정보 편집 상태
    const [editing, setEditing] = useState(false);
    const [infoForm, setInfoForm] = useState({
        parent_name: "",
        parent_phone: "",
        address: "",
        memo: "",
    });
    const [saving, setSaving] = useState(false);

    // ─── 학생 정보 로드 + 권한 체크 ──────────────────────────────
    useEffect(() => {
        async function fetchStudent() {
            const { data } = await supabase
                .from("students")
                .select("id, name, photo_url, class_id, parent_name, parent_phone, address, memo, classes(name)")
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
                setTeacherClassId(teacher?.class_id);
            }

            if (!roleInfo.role) { router.replace("/"); return; }

            setStudent(data);
            // 폼 초기값 설정
            setInfoForm({
                parent_name: data.parent_name || "",
                parent_phone: data.parent_phone || "",
                address: data.address || "",
                memo: data.memo || "",
            });
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

    // ─── 학생 정보 저장 ─────────────────────────────────────────
    async function saveInfo() {
        setSaving(true);
        const { error } = await supabase.from("students").update({
            parent_name: infoForm.parent_name.trim() || null,
            parent_phone: infoForm.parent_phone.trim() || null,
            address: infoForm.address.trim() || null,
            memo: infoForm.memo.trim() || null,
        }).eq("id", studentId);
        setSaving(false);
        if (error) { alert("저장 실패: " + error.message); return; }
        setStudent((prev: any) => ({ ...prev, ...infoForm }));
        setEditing(false);
    }

    // ─── 통계 계산 ─────────────────────────────────────────────────
    const allSundays = getAllSundaysOfYear(selectedYear);
    const today = new Date();
    const pastSundays = allSundays.filter(d => d <= today);
    const totalSundays = pastSundays.length;
    const attendedCount = pastSundays.filter(d => {
        const status = attendanceMap[toDateKey(d)]?.status;
        return status === "출석" || status === "지각";
    }).length;
    const absentCount = pastSundays.filter(d => attendanceMap[toDateKey(d)]?.status === "결석").length;
    const uncheckedCount = pastSundays.filter(d => !attendanceMap[toDateKey(d)]).length;
    const attendanceRate = totalSundays > 0 ? Math.round((attendedCount / totalSundays) * 100) : 0;
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // 수정 권한: 부장/관리자 = 전체, 일반 선생님 = 본인 반
    const canEdit = permissions.canEditStudentInfo(
        roleInfo.role,
        teacherClassId,
        student?.class_id
    );

    if (!student) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <main className="min-h-screen p-4 md:p-10">
            <div className="mx-auto max-w-5xl space-y-6">

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
                                    {student.classes?.name || "반 정보 없음"}
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white">{student.name}</h1>
                            </div>
                        </div>
                    </div>

                    {/* 년도 선택기 (출석현황 탭에서만) */}
                    {tab === "attendance" && (
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
                    )}
                </header>

                {/* ── 탭 전환 ───────────────────────────────────────── */}
                <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1.5 gap-1.5">
                    <button
                        onClick={() => { setTab("attendance"); setEditing(false); }}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all",
                            tab === "attendance"
                                ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-md"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <BarChart3 className="h-4 w-4" /> 출석 현황
                    </button>
                    <button
                        onClick={() => { setTab("info"); setEditing(false); }}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all",
                            tab === "info"
                                ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-md"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <User className="h-4 w-4" /> 학생 정보
                    </button>
                </div>

                {/* ════════════════════════════════════════════════════ */}
                {/* 탭 1: 출석 현황 */}
                {/* ════════════════════════════════════════════════════ */}
                {tab === "attendance" && (
                    <>
                        {/* 연간 통계 배지 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in" style={{ animationDelay: "0.1s" }}>
                            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-indigo-600 px-5 py-4 shadow-md shadow-indigo-200">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <BarChart3 className="h-3.5 w-3.5 text-indigo-300" />
                                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wide">출석률</span>
                                </div>
                                <div className="text-3xl font-black text-white">{attendanceRate}%</div>
                                <div className="text-xs text-indigo-300 mt-0.5">{totalSundays}주 중 {attendedCount}주</div>
                            </div>
                            <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="h-2 w-2 rounded-full bg-indigo-500" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">출석</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">{attendedCount}</div>
                                <div className="text-xs text-slate-400 mt-0.5">출석 + 지각</div>
                            </div>
                            <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">결석</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">{absentCount}</div>
                            </div>
                            <div className="rounded-2xl bg-white dark:bg-slate-800 px-5 py-4 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">미기록</span>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">{uncheckedCount}</div>
                            </div>
                        </div>

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

                                {/* 월별 캘린더 */}
                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-in" style={{ animationDelay: "0.2s" }}>
                                    {MONTH_NAMES.map((monthName, monthIdx) => {
                                        const sundaysInMonth = allSundays.filter(d => d.getMonth() === monthIdx);
                                        return (
                                            <div key={monthIdx} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-md ring-1 ring-slate-100 dark:ring-slate-700">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-base font-black text-slate-900 dark:text-white">{monthName}</h3>
                                                    <span className="text-xs font-bold text-slate-400">
                                                        {sundaysInMonth.filter(d => {
                                                            const s = attendanceMap[toDateKey(d)]?.status;
                                                            return s === "출석" || s === "지각";
                                                        }).length} / {sundaysInMonth.filter(d => d <= today).length}
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
                                                            const colorClass = isFuture
                                                                ? "bg-slate-50 dark:bg-slate-700 text-slate-300 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-600"
                                                                : status
                                                                    ? STATUS_COLOR[status] || "bg-slate-400 text-white"
                                                                    : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 ring-1 ring-slate-200 dark:ring-slate-600";
                                                            return (
                                                                <div
                                                                    key={dateKey}
                                                                    title={`${dateKey} — ${status ?? (isFuture ? "예정" : "미기록")}`}
                                                                    className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black transition-all", colorClass)}
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
                                <p className="text-center text-xs text-slate-400 pb-8">
                                    매 일요일 기준으로 집계됩니다. 미래 날짜는 연한 색으로 표시됩니다.
                                </p>
                            </>
                        )}
                    </>
                )}

                {/* ════════════════════════════════════════════════════ */}
                {/* 탭 2: 학생 정보 */}
                {/* ════════════════════════════════════════════════════ */}
                {tab === "info" && (
                    <div className="animate-in space-y-4">
                        {/* 헤더 + 수정 버튼 */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-slate-900 dark:text-white">학생 정보</h2>
                            {canEdit && !editing && (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 transition-all"
                                >
                                    <Edit3 className="h-4 w-4" /> 수정
                                </button>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md ring-1 ring-slate-100 dark:ring-slate-700 overflow-hidden">
                            {editing ? (
                                /* ── 편집 모드 ── */
                                <div className="p-6 space-y-4">
                                    {/* 부모님 이름 */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">부모님 이름</label>
                                        <input
                                            type="text" value={infoForm.parent_name}
                                            onChange={e => setInfoForm(f => ({ ...f, parent_name: e.target.value }))}
                                            placeholder="예) 홍길동"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                    {/* 부모님 전화번호 */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">부모님 전화번호</label>
                                        <input
                                            type="tel" value={infoForm.parent_phone}
                                            onChange={e => setInfoForm(f => ({ ...f, parent_phone: e.target.value }))}
                                            placeholder="예) 010-1234-5678"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                    {/* 주소 */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">주소</label>
                                        <input
                                            type="text" value={infoForm.address}
                                            onChange={e => setInfoForm(f => ({ ...f, address: e.target.value }))}
                                            placeholder="예) 서울시 강남구 테헤란로 123"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                    {/* 메모 */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">메모</label>
                                        <textarea
                                            value={infoForm.memo}
                                            onChange={e => setInfoForm(f => ({ ...f, memo: e.target.value }))}
                                            placeholder="기타 메모..."
                                            rows={3}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                        />
                                    </div>
                                    {/* 버튼 */}
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setEditing(false)}
                                            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
                                            취소
                                        </button>
                                        <button onClick={saveInfo} disabled={saving}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
                                            {saving
                                                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                : <Save className="h-4 w-4" />
                                            }
                                            저장
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── 조회 모드 ── */
                                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                                    {/* 부모님 정보 */}
                                    <div className="px-6 py-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">부모님 정보</p>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                                                    <User className="h-4 w-4 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-slate-400 font-semibold">부모님 이름</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                        {student.parent_name || <span className="text-slate-300 font-normal">미입력</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-50">
                                                    <Phone className="h-4 w-4 text-green-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[11px] text-slate-400 font-semibold">전화번호</p>
                                                    {student.parent_phone ? (
                                                        <a href={`tel:${student.parent_phone}`}
                                                            className="text-sm font-bold text-indigo-600 hover:underline">
                                                            {student.parent_phone}
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm text-slate-300 font-normal">미입력</p>
                                                    )}
                                                </div>
                                                {student.parent_phone && (
                                                    <a href={`sms:${student.parent_phone}`}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-50 text-green-600 text-xs font-bold hover:bg-green-100 transition-all">
                                                        💬 문자
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* 주소 */}
                                    <div className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                                                <MapPin className="h-4 w-4 text-orange-400" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-semibold">주소</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                    {student.address || <span className="text-slate-300 font-normal">미입력</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* 메모 */}
                                    <div className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                                                <FileText className="h-4 w-4 text-purple-400" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-slate-400 font-semibold">메모</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white whitespace-pre-wrap">
                                                    {student.memo || <span className="text-slate-300 font-normal">미입력</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* 수정 권한 없을 때 안내 */}
                                    {!canEdit && (
                                        <div className="px-6 py-3 bg-slate-50">
                                            <p className="text-xs text-slate-400 text-center">조회 전용 — 정보 수정은 담당 선생님 또는 관리자에게 문의하세요.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
