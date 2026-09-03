// Globals injected by the course-selection page (backend API frontend); provided by the host page

type ApiResponse = {
    code?: number;
    msg?: string;
    data?: unknown;
    rows?: unknown;
};

type AxiosLike = {
    post(url: string, data?: unknown, config?: unknown): Promise<{ data: ApiResponse }>;
};

declare const axios: AxiosLike;

interface Window {
    axios?: AxiosLike;
    grablessonsVue?: Record<string, unknown>;
    webkitAudioContext?: typeof AudioContext;
}
