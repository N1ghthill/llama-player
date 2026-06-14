declare module "jsmediatags" {
  export interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    track?: string;
    genre?: string;
    picture?: {
      data: ArrayBuffer;
      format: string;
    };
    duration?: number;
  }

  export interface CallbackType {
    onSuccess: (data: { tags: Tags }) => void;
    onError: (error: { message: string; type: string }) => void;
  }

  export function read(file: File, callbacks: CallbackType): void;
  export function read(
    url: string,
    callbacks: CallbackType
  ): void;

  const jsmediatags: {
    read: typeof read;
  };

  export default jsmediatags;
}
