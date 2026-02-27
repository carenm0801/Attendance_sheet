export type Teacher = {
    id: string;
    name: string;
    class_id: string;
    photo_url?: string | null;
    phone?: string | null;       // 전화번호
    address?: string | null;     // 주소
    memo?: string | null;        // 메모
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    classes?: any;
};

export type Class = {
    id: string;
    name: string;
};

export type Student = {
    id: string;
    name: string;
    photo_url: string | null;
    class_id: string;
    parent_name?: string | null;  // 부모님 이름
    parent_phone?: string | null; // 부모님 전화번호
    address?: string | null;      // 주소
    memo?: string | null;         // 메모/특이사항
};

export type Attendance = {
    id: string;
    student_id: string;
    check_in_at: string;
    status: string;
};
