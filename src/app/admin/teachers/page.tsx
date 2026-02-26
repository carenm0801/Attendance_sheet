"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Class, Teacher } from "@/types";
import { Trash2, PlusCircle, ChevronLeft, Upload, Camera, User } from "lucide-react";
import Link from "next/link";
import { uploadImage } from "@/lib/uploadImage";

export default function AdminTeachersPage() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [name, setName] = useState("");
    const [classId, setClassId] = useState("");
    const [bulkText, setBulkText] = useState("");
    const [bulkClassId, setBulkClassId] = useState("");
    const [tab, setTab] = useState<"individual" | "bulk">("individual");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null); // 업로드 중인 선생님 ID
    const [columns, setColumns] = useState<4 | 5 | 6>(4); // 그리드 열 수
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    async function fetchAll() {
        const [{ data: cls }, { data: tch }] = await Promise.all([
            supabase.from("classes").select("*").order("name"),
            supabase.from("teachers").select("id, name, class_id, photo_url, classes(name)").order("name"),
        ]);
        setClasses(cls || []);
        setTeachers(tch || []);
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
    async function addTeacher() {
        if (!name.trim()) return alert("이름을 입력하세요.");
        if (!classId) return alert("반을 선택하세요.");

        let photoUrl: string | null = null;
        if (photoFile) {
            photoUrl = await uploadImage(supabase, photoFile, "avatars", "teachers");
            if (!photoUrl) return alert("사진 업로드에 실패했습니다. Supabase Storage 버킷 'avatars'가 설정되었는지 확인하세요.");
        }

        const { error } = await supabase.from("teachers").insert({
            name: name.trim(),
            class_id: classId,
            ...(photoUrl && { photo_url: photoUrl }),
        });
        if (!error) {
            setName(""); setPhotoFile(null); setPhotoPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            fetchAll();
        } else alert("등록 실패: " + error.message);
    }

    // 일괄 등록
    async function bulkAddTeachers() {
        if (!bulkText.trim()) return alert("이름을 입력하세요.");
        if (!bulkClassId) return alert("반을 선택하세요.");
        const names = bulkText.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
        if (names.length === 0) return alert("유효한 이름이 없습니다.");
        const rows = names.map((n) => ({ name: n, class_id: bulkClassId }));
        const { error } = await supabase.from("teachers").insert(rows);
        if (!error) { setBulkText(""); fetchAll(); alert(`${names.length}명 등록 완료!`); }
        else alert("일괄 등록 실패: " + error.message);
    }

    // 목록에서 사진 직접 업로드
    async function uploadTeacherPhoto(teacher: Teacher, file: File) {
        setUploading(teacher.id);
        const url = await uploadImage(supabase, file, "avatars", "teachers");
        if (!url) { setUploading(null); return alert("사진 업로드 실패. Supabase Storage 'avatars' 버킷을 확인하세요."); }
        await supabase.from("teachers").update({ photo_url: url }).eq("id", teacher.id);
        setUploading(null);
        fetchAll();
    }

    // 삭제
    async function deleteTeacher(id: string, name: string) {
        if (!confirm(`'${name}' 선생님을 삭제하시겠습니까?`)) return;
        const { error } = await supabase.from("teachers").delete().eq("id", id);
        if (!error) fetchAll();
        else alert("삭제 실패: " + error.message);
    }

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="mx-auto max-w-3xl space-y-6">

                {/* 헤더 */}
                <header className="flex items-center gap-4">
                    <Link href="/admin" className="rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-slate-100 hover:text-slate-900">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">선생님 관리</h1>
                        <p className="text-xs text-slate-500 mt-0.5">개별 또는 일괄로 선생님을 등록하세요</p>
                    </div>
                </header>

                {/* 탭 */}
                <div className="flex rounded-xl bg-slate-200 p-1 gap-1">
                    {(["individual", "bulk"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                            {t === "individual" ? "개별 등록" : "일괄 등록"}
                        </button>
                    ))}
                </div>

                {/* 개별 등록 폼 */}
                {tab === "individual" && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                        <h2 className="font-bold text-slate-900">선생님 개별 등록</h2>

                        {/* 사진 업로드 영역 */}
                        <div className="flex items-center gap-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative h-20 w-20 shrink-0 cursor-pointer rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center group ring-2 ring-transparent hover:ring-indigo-400 transition-all"
                            >
                                {photoPreview ? (
                                    <img src={photoPreview} alt="미리보기" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-8 w-8 text-slate-300" />
                                )}
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

                        <select value={classId} onChange={(e) => setClassId(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <option value="">반을 선택하세요</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addTeacher()}
                                placeholder="선생님 이름"
                                className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                            <button onClick={addTeacher} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                                <PlusCircle className="h-4 w-4" /> 등록
                            </button>
                        </div>
                    </div>
                )}

                {/* 일괄 등록 폼 */}
                {tab === "bulk" && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100 space-y-3">
                        <h2 className="font-bold text-slate-900">선생님 일괄 등록</h2>
                        <p className="text-xs text-slate-500">한 줄에 이름 한 명씩 입력하세요. (사진은 등록 후 목록에서 개별 업로드)</p>
                        <select value={bulkClassId} onChange={(e) => setBulkClassId(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <option value="">반을 선택하세요</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                            placeholder={"홍길동\n김철수\n이영희"} rows={6}
                            className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono" />
                        <button onClick={bulkAddTeachers} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
                            <Upload className="h-4 w-4" /> 일괄 등록
                        </button>
                    </div>
                )}

                {/* 선생님 목록 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-900">등록된 선생님 ({teachers.length}명)</h2>
                        {/* 열 수 선택 버튼 */}
                        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                            {([4, 5, 6] as const).map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setColumns(n)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${columns === n
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-400 hover:text-slate-700"
                                        }`}
                                >
                                    {n}열
                                </button>
                            ))}
                        </div>
                    </div>
                    <ul className={`grid gap-3 ${columns === 4 ? "grid-cols-4" :
                            columns === 5 ? "grid-cols-5" : "grid-cols-6"
                        }`}>
                        {teachers.length === 0 && <p className="col-span-full text-slate-400 text-sm">등록된 선생님이 없습니다.</p>}
                        {teachers.map((t) => (
                            <li key={t.id} className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-3 text-center relative group">
                                {/* 사진 영역 (클릭 → 파일 선택 → 업로드) */}
                                <label className="relative h-16 w-16 shrink-0 cursor-pointer rounded-xl overflow-hidden bg-slate-200 flex items-center justify-center ring-2 ring-transparent hover:ring-indigo-400 transition-all">
                                    {uploading === t.id ? (
                                        <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    ) : t.photo_url ? (
                                        <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-7 w-7 text-slate-400" />
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Camera className="h-4 w-4 text-white" />
                                    </div>
                                    <input type="file" accept="image/*" className="hidden"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTeacherPhoto(t, f); }} />
                                </label>
                                <div className="min-w-0 w-full">
                                    <p className="font-bold text-slate-900 text-xs truncate">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{t.classes?.name || "반 없음"}</p>
                                </div>
                                <button onClick={() => deleteTeacher(t.id, t.name)}
                                    className="absolute top-1.5 right-1.5 p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </main>
    );
}
