export type Teacher = {
    id: string;
    name: string;
    class_id: string;
    photo_url?: string | null;
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
};

export type Attendance = {
    id: string;
    student_id: string;
    check_in_at: string;
    status: string;
};
