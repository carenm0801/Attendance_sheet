"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Class, Student } from "@/types";
import {
    Trash2, PlusCircle, ChevronLeft, Upload, Camera, User,
    Phone, MapPin, FileText, X, Save, MessageSquare, Copy, Check
} from "lucide-react";
import Link from "next/link";
import { uploadImage } from "@/lib/uploadImage";

// ─── 학생 편집 모달 ────────────────────────────────────────────────
function StudentEditModal({
    student,
    classes,
    onClose,
    onSave,
}: {
    student: Student;
    classes: Class[];
    onClose: () => void;
    onSave: () => void;
}) {
    const supabase = createClient();
    const [form, setForm] = useState({
        name: student.name || "",
        class_id: student.class_id || "",
        parent_name: student.parent_name || "",
        parent_phone: student.parent_phone || "",
        address: student.address || "",
        memo: student.memo || "",
    });
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // 입력값 변경 헬퍼
    const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

    // 저장
    async function handleSave() {
        if (!form.name.trim()) return alert("이름을 입력하세요.");
        setSaving(true);
        const { error } = await supabase.from("students").update({
            name: form.name.trim(),
            class_id: form.class_id,
            parent_name: form.parent_name.trim() || null,
            parent_phone: form.parent_phone.trim() || null,
            address: form.address.trim() || null,
            memo: form.memo.trim() || null,
        }).eq("id", student.id);
        setSaving(false);
        if (error) return alert("저장 실패: " + error.message);
        onSave();
        onClose();
    }

    // 전화번호 복사
    async function copyPhone() {
        if (!form.parent_phone) return;
        await navigator.clipboard.writeText(form.parent_phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // 문자 템플릿 복사
    async function copyMessageTemplate() {
        const className = classes.find((c) => c.id === form.class_id)?.name || "";
        const template = `안녕하세요, ${form.parent_name || ""}님! 주일학교 ${className} ${form.name} 학생의 출석 안내드립니다.`;
        await navigator.clipboard.writeText(template);
        alert("메시지 템플릿이 복사되었습니다!");
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl overflow-hidden bg-emerald-100 flex items-center justify-center">
                            {student.photo_url
                                ? <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                                : <User className="h-5 w-5 text-emerald-500" />
                            }
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 text-lg">{student.name}</h2>
                            <p className="text-xs text-slate-400">{classes.find(c => c.id === student.class_id)?.name || "반 없음"}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* 기본 정보 */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">기본 정보</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">학생 이름</label>
                                <input
                                    type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">반</label>
                                <select value={form.class_id} onChange={(e) => set("class_id", e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 부모님 정보 */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">부모님 / 연락처</p>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">부모님 이름</label>
                            <input
                                type="text" value={form.parent_name} onChange={(e) => set("parent_name", e.target.value)}
                                placeholder="예) 홍길동"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">부모님 전화번호</label>
                            <div className="flex gap-2">
                                <input
                                    type="tel" value={form.parent_phone} onChange={(e) => set("parent_phone", e.target.value)}
                                    placeholder="예) 010-1234-5678"
                                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                                {form.parent_phone && (
                                    <div className="flex gap-1">
                                        {/* 전화 걸기 */}
                                        <a href={`tel:${form.parent_phone}`}
                                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                                            title="전화 걸기">
                                            <Phone className="h-4 w-4" />
                                        </a>
                                        {/* 문자 보내기 */}
                                        <a href={`sms:${form.parent_phone}`}
                                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                                            title="문자 보내기">
                                            <MessageSquare className="h-4 w-4" />
                                        </a>
                                        {/* 번호 복사 */}
                                        <button onClick={copyPhone}
                                            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                                            title="번호 복사">
                                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 주소 */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> 주소
                        </label>
                        <input
                            type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
                            placeholder="예) 서울시 강남구 테헤란로 123"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>

                    {/* 메모 */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                            <FileText className="h-3 w-3" /> 메모 / 특이사항
                        </label>
                        <textarea
                            value={form.memo} onChange={(e) => set("memo", e.target.value)}
                            placeholder="알레르기, 특이사항, 기타 메모..."
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                        />
                    </div>

                    {/* 메시지 템플릿 */}
                    {form.parent_phone && (
                        <div className="bg-blue-50 rounded-2xl p-4">
                            <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> 메시지 발송
                            </p>
                            <div className="flex gap-2">
                                <a href={`sms:${form.parent_phone}?body=${encodeURIComponent(`안녕하세요! 주일학교 ${classes.find(c => c.id === form.class_id)?.name || ""} ${form.name} 학생 관련 안내드립니다.`)}`}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all">
                                    <MessageSquare className="h-4 w-4" /> 문자 보내기
                                </a>
                                <button onClick={copyMessageTemplate}
                                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-all">
                                    <Copy className="h-4 w-4" /> 템플릿 복사
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 하단 버튼 */}
                <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
                        취소
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all">
                        {saving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── 단체 문자 모달 ────────────────────────────────────────────────
function BulkMessageModal({
    students,
    classes,
    onClose,
}: {
    students: Student[];
    classes: Class[];
    onClose: () => void;
}) {
    const [filterClassId, setFilterClassId] = useState("all");
    const [message, setMessage] = useState("안녕하세요! 주일학교 출석 관련 안내드립니다.");
    const [copied, setCopied] = useState(false);

    // 전화번호 있는 학생만 필터
    const filtered = students.filter((s) =>
        s.parent_phone && (filterClassId === "all" || s.class_id === filterClassId)
    );

    // 전화번호 목록 복사 (쉼표 구분)
    async function copyPhoneList() {
        const phones = filtered.map((s) => s.parent_phone).join(", ");
        await navigator.clipboard.writeText(phones);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-900">단체 메시지 발송</h2>
                        <p className="text-xs text-slate-400 mt-0.5">전화번호가 등록된 학부모님께 발송</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* 반 필터 */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">대상 반 선택</label>
                        <select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                            <option value="all">전체 반 ({students.filter(s => s.parent_phone).length}명)</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({students.filter(s => s.class_id === c.id && s.parent_phone).length}명)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 대상 학생 목록 */}
                    <div className="bg-slate-50 rounded-2xl p-4 max-h-40 overflow-y-auto">
                        <p className="text-xs font-bold text-slate-500 mb-2">발송 대상 ({filtered.length}명)</p>
                        {filtered.length === 0
                            ? <p className="text-xs text-slate-400">전화번호가 등록된 학생이 없습니다.</p>
                            : <div className="flex flex-wrap gap-1.5">
                                {filtered.map((s) => (
                                    <span key={s.id} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700">
                                        {s.name} ({s.parent_name || "부모님"})
                                    </span>
                                ))}
                            </div>
                        }
                    </div>

                    {/* 메시지 내용 */}
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">메시지 내용</label>
                        <textarea
                            value={message} onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                    </div>

                    {/* 발송 방법 안내 */}
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 space-y-1">
                        <p className="font-bold">📱 발송 방법</p>
                        <p>① 아래 버튼으로 전화번호 목록을 복사하세요.</p>
                        <p>② 휴대폰 문자 앱에서 수신자에 붙여넣기 하세요.</p>
                        <p>③ 메시지 내용을 복사해서 문자를 작성하세요.</p>
                    </div>

                    {/* 버튼들 */}
                    <div className="flex gap-2">
                        <button onClick={copyPhoneList}
                            disabled={filtered.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-emerald-300 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 disabled:opacity-40 transition-all">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? "복사됨!" : "전화번호 복사"}
                        </button>
                        <button onClick={async () => { await navigator.clipboard.writeText(message); alert("메시지가 복사되었습니다!"); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all">
                            <MessageSquare className="h-4 w-4" /> 메시지 복사
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── 메인 페이지 ────────────────────────────────────────────────────
export default function AdminStudentsPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [filterClassId, setFilterClassId] = useState("all");
    const [name, setName] = useState("");
    const [classId, setClassId] = useState("");
    const [parentName, setParentName] = useState("");
    const [parentPhone, setParentPhone] = useState("");
    const [address, setAddress] = useState("");
    const [memo, setMemo] = useState("");
    const [bulkText, setBulkText] = useState("");
    const [bulkClassId, setBulkClassId] = useState("");
    const [tab, setTab] = useState<"individual" | "bulk" | "message">("individual");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [editStudent, setEditStudent] = useState<Student | null>(null); // 편집 모달 대상
    const [showBulkMsg, setShowBulkMsg] = useState(false); // 단체문자 모달
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    async function fetchAll() {
        const [{ data: cls }, { data: std }] = await Promise.all([
            supabase.from("classes").select("*").order("name"),
            supabase.from("students").select("*").order("name"),
        ]);
        setClasses(cls || []);
        setStudents(std || []);
        if (cls && cls.length > 0) {
            setClassId((prev) => prev || cls[0].id);
            setBulkClassId((prev) => prev || cls[0].id);
        }
    }

    useEffect(() => { fetchAll(); }, []);

    // 등록 폼 사진 미리보기
    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    }

    // 개별 등록
    async function addStudent() {
        if (!name.trim()) return alert("이름을 입력하세요.");
        if (!classId) return alert("반을 선택하세요.");

        let photoUrl: string | null = null;
        if (photoFile) {
            photoUrl = await uploadImage(supabase, photoFile, "avatars", "students");
            if (!photoUrl) return alert("사진 업로드에 실패했습니다.");
        }

        const { error } = await supabase.from("students").insert({
            name: name.trim(),
            class_id: classId,
            parent_name: parentName.trim() || null,
            parent_phone: parentPhone.trim() || null,
            address: address.trim() || null,
            memo: memo.trim() || null,
            ...(photoUrl && { photo_url: photoUrl }),
        });
        if (!error) {
            setName(""); setParentName(""); setParentPhone(""); setAddress(""); setMemo("");
            setPhotoFile(null); setPhotoPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            fetchAll();
        } else alert("등록 실패: " + error.message);
    }

    // 일괄 등록
    async function bulkAddStudents() {
        if (!bulkText.trim()) return alert("이름을 입력하세요.");
        if (!bulkClassId) return alert("반을 선택하세요.");
        const names = bulkText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
        if (names.length === 0) return alert("유효한 이름이 없습니다.");
        const rows = names.map((n) => ({ name: n, class_id: bulkClassId }));
        const { error } = await supabase.from("students").insert(rows);
        if (!error) { setBulkText(""); fetchAll(); alert(`${names.length}명 등록 완료!`); }
        else alert("일괄 등록 실패: " + error.message);
    }

    // 사진 업로드
    async function uploadStudentPhoto(student: Student, file: File) {
        setUploading(student.id);
        const url = await uploadImage(supabase, file, "avatars", "students");
        if (!url) { setUploading(null); return alert("사진 업로드 실패."); }
        await supabase.from("students").update({ photo_url: url }).eq("id", student.id);
        setUploading(null);
        fetchAll();
    }

    // 삭제
    async function deleteStudent(id: string, name: string) {
        if (!confirm(`'${name}' 학생을 삭제하시겠습니까?`)) return;
        const { error } = await supabase.from("students").delete().eq("id", id);
        if (!error) fetchAll();
        else alert("삭제 실패: " + error.message);
    }

    // 반별 필터
    const filteredStudents = filterClassId === "all"
        ? students
        : students.filter((s) => s.class_id === filterClassId);

    const getClassName = (cid: string) => classes.find((c) => c.id === cid)?.name || "반 없음";

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12">
            {/* 편집 모달 */}
            {editStudent && (
                <StudentEditModal
                    student={editStudent}
                    classes={classes}
                    onClose={() => setEditStudent(null)}
                    onSave={fetchAll}
                />
            )}

            {/* 단체 문자 모달 */}
            {showBulkMsg && (
                <BulkMessageModal
                    students={students}
                    classes={classes}
                    onClose={() => setShowBulkMsg(false)}
                />
            )}

            <div className="mx-auto max-w-3xl space-y-6">

                {/* 헤더 */}
                <header className="flex items-center gap-4">
                    <Link href="/admin" className="rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-slate-100 hover:text-slate-900">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">학생 관리</h1>
                        <p className="text-xs text-slate-500 mt-0.5">학생 등록·편집 및 연락처 관리</p>
                    </div>
                    {/* 단체 문자 버튼 */}
                    <button
                        onClick={() => setShowBulkMsg(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
                    >
                        <MessageSquare className="h-4 w-4" /> 단체 문자
                    </button>
                </header>

                {/* 탭 */}
                <div className="flex rounded-xl bg-slate-200 p-1 gap-1">
                    {(["individual", "bulk"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                            {t === "individual" ? "개별 등록" : "일괄 등록"}
                        </button>
                    ))}
                </div>

                {/* 개별 등록 폼 */}
                {tab === "individual" && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                        <h2 className="font-bold text-slate-900">학생 개별 등록</h2>

                        {/* 사진 업로드 */}
                        <div className="flex items-center gap-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative h-20 w-20 shrink-0 cursor-pointer rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center group ring-2 ring-transparent hover:ring-emerald-400 transition-all"
                            >
                                {photoPreview
                                    ? <img src={photoPreview} alt="미리보기" className="h-full w-full object-cover" />
                                    : <User className="h-8 w-8 text-slate-300" />
                                }
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="h-5 w-5 text-white" />
                                </div>
                            </div>
                            <div className="text-sm text-slate-500">
                                <p className="font-semibold text-slate-700">프로필 사진 (선택)</p>
                                <p className="text-xs">사진 영역을 클릭하면 파일을 선택할 수 있습니다.</p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </div>

                        {/* 반 + 이름 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">반 선택</label>
                                <select value={classId} onChange={(e) => setClassId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                                    <option value="">반을 선택하세요</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">학생 이름</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addStudent()}
                                    placeholder="홍길동"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                        </div>

                        {/* 부모님 정보 */}
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">부모님 정보 (선택)</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">부모님 이름</label>
                                    <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                                        placeholder="예) 홍부모"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">전화번호</label>
                                    <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                                        placeholder="010-0000-0000"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">주소</label>
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                                    placeholder="예) 서울시 강남구"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">메모</label>
                                <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)}
                                    placeholder="특이사항, 알레르기 등"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                        </div>

                        <button onClick={addStudent} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all">
                            <PlusCircle className="h-4 w-4" /> 등록
                        </button>
                    </div>
                )}

                {/* 일괄 등록 폼 */}
                {tab === "bulk" && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-3">
                        <h2 className="font-bold text-slate-900">학생 일괄 등록</h2>
                        <p className="text-xs text-slate-500">한 줄에 이름 한 명씩 입력하세요. (상세 정보는 등록 후 편집 버튼으로 입력)</p>
                        <select value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                            <option value="">반을 선택하세요</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                            placeholder={"이영희\n박민수\n최지원"} rows={8}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none font-mono" />
                        <button onClick={bulkAddStudents} className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700">
                            <Upload className="h-4 w-4" /> 일괄 등록
                        </button>
                    </div>
                )}

                {/* 학생 목록 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-900">등록된 학생 ({filteredStudents.length}명)</h2>
                        <select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400">
                            <option value="all">전체 반</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <ul className="space-y-2">
                        {filteredStudents.length === 0 && <p className="text-slate-400 text-sm text-center py-8">등록된 학생이 없습니다.</p>}
                        {filteredStudents.map((s) => (
                            <li key={s.id}
                                className="flex items-center gap-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-200 px-4 py-3 transition-all group cursor-pointer"
                                onClick={() => setEditStudent(s)}
                            >
                                {/* 사진 */}
                                <label
                                    className="relative h-12 w-12 shrink-0 cursor-pointer rounded-xl overflow-hidden bg-slate-200 flex items-center justify-center ring-2 ring-transparent hover:ring-emerald-400 transition-all"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {uploading === s.id
                                        ? <div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                        : s.photo_url
                                            ? <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                                            : <User className="h-6 w-6 text-slate-400" />
                                    }
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Camera className="h-3 w-3 text-white" />
                                    </div>
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStudentPhoto(s, f); }} />
                                </label>

                                {/* 이름/반 */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                                    <p className="text-xs text-slate-400">{getClassName(s.class_id)}</p>
                                </div>

                                {/* 부모님 정보 */}
                                <div className="hidden sm:block text-right min-w-0">
                                    {s.parent_name && <p className="text-xs font-medium text-slate-600">{s.parent_name}</p>}
                                    {s.parent_phone
                                        ? <p className="text-xs text-emerald-600 font-mono">{s.parent_phone}</p>
                                        : <p className="text-xs text-slate-300">전화번호 없음</p>
                                    }
                                </div>

                                {/* 액션 버튼 */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
                                    {s.parent_phone && (
                                        <a href={`sms:${s.parent_phone}`}
                                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="문자 보내기">
                                            <MessageSquare className="h-4 w-4" />
                                        </a>
                                    )}
                                    <button onClick={() => deleteStudent(s.id, s.name)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </main>
    );
}
