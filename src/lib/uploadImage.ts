// 공유 이미지 업로드 유틸 함수
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 파일을 Supabase Storage에 업로드하고 공개 URL을 반환합니다.
 * @param supabase Supabase 클라이언트
 * @param file 업로드할 파일
 * @param bucket 버킷 이름 (예: "avatars")
 * @param folder 폴더 경로 (예: "teachers" | "students")
 */
export async function uploadImage(
    supabase: SupabaseClient,
    file: File,
    bucket: string,
    folder: string
): Promise<string | null> {
    // 파일 확장자 추출
    const ext = file.name.split(".").pop();
    // 충돌 방지를 위해 타임스탬프 기반 파일명 생성
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true, contentType: file.type });

    if (error) {
        console.error("이미지 업로드 실패:", error);
        return null;
    }

    // 공개 URL 생성
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
}
