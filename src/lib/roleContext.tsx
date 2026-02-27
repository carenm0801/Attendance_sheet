"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── 역할 타입 정의 ────────────────────────────────────────────────
export type Role = "admin" | "head_teacher" | "teacher" | null;

export type RoleInfo = {
    role: Role;
    teacherId?: string;    // 반 선생님일 때 선생님 ID
    teacherName?: string;  // 표시용 이름
};

// ─── 역할별 권한 체크 함수 ────────────────────────────────────────
export const permissions = {
    // 선생님/학생 추가·수정·삭제
    canManageTeachers: (role: Role) => role === "admin" || role === "head_teacher",
    // 학생 추가·수정·삭제 (반 선생님은 본인 반만)
    canManageStudents: (role: Role) => role !== null,
    // 출석 체크 (상태 변경)
    canCheckAttendance: (role: Role) => role === "head_teacher",
    // 출석 현황 조회
    canViewAttendance: (role: Role) => role !== null,
    // 학생 사진 수정
    canEditPhoto: (role: Role) => role !== null,
    // 반(Class) 추가·삭제
    canManageClasses: (role: Role) => role === "admin",
    // 관리자 전체 메뉴 접근
    isAdmin: (role: Role) => role === "admin",
    // 학생 정보 수정 (일반 선생님은 본인 반만, 부장/관리자는 전체)
    canEditStudentInfo: (role: Role, teacherClassId?: string, studentClassId?: string) => {
        if (role === "admin" || role === "head_teacher") return true;
        if (role === "teacher") return teacherClassId === studentClassId;
        return false;
    },
    // 선생님 정보 수정 (부장/관리자만)
    canEditTeacherInfo: (role: Role) => role === "admin" || role === "head_teacher",
};

// ─── Context ──────────────────────────────────────────────────────
type RoleContextType = {
    roleInfo: RoleInfo;
    setRole: (info: RoleInfo) => void;
    clearRole: () => void;
};

const RoleContext = createContext<RoleContextType | null>(null);

const STORAGE_KEY = "attendance_role";

// ─── Provider ─────────────────────────────────────────────────────
export function RoleProvider({ children }: { children: ReactNode }) {
    const [roleInfo, setRoleInfo] = useState<RoleInfo>({ role: null });

    // 페이지 새로고침 시 localStorage에서 복원
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { setRoleInfo(JSON.parse(saved)); } catch { /* 무시 */ }
        }
    }, []);

    function setRole(info: RoleInfo) {
        setRoleInfo(info);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    }

    function clearRole() {
        setRoleInfo({ role: null });
        localStorage.removeItem(STORAGE_KEY);
    }

    return (
        <RoleContext.Provider value={{ roleInfo, setRole, clearRole }}>
            {children}
        </RoleContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useRole() {
    const ctx = useContext(RoleContext);
    if (!ctx) throw new Error("useRole은 RoleProvider 안에서만 사용 가능합니다.");
    return ctx;
}
