import {
  ConvoKitClient as JavaScriptConvoKitClient,
  ConvoKitError,
  type ConvoKitClientOptions,
  type MessageMedia,
} from '@convokitapp/sdk'
import {
  assertReactNativeRuntime,
  fetchRuntimeAdapter,
  requiredText,
  type DownloadedMediaInput,
  type NativeFileInput,
  type ReactNativeRuntimeAdapter,
} from './runtime'

export interface ReactNativeClientOptions extends ConvoKitClientOptions {
  runtimeAdapter?: ReactNativeRuntimeAdapter
}

export interface NativeMessageMediaInput extends NativeFileInput {
  conversationId: string
  mediaType?: 'image' | 'file'
  metadata?: Record<string, string | number | boolean | null>
}

export class ConvoKitClient extends JavaScriptConvoKitClient {
  readonly runtimeAdapter: ReactNativeRuntimeAdapter

  constructor(options: ReactNativeClientOptions) {
    assertReactNativeRuntime()
    super(options)
    this.runtimeAdapter = options.runtimeAdapter ?? fetchRuntimeAdapter
  }

  async uploadUserAvatarFromUri(input: NativeFileInput & { userId: string }): Promise<string> {
    const bytes = await this.runtimeAdapter.readFile(input)
    return this.uploadUserAvatar({
      userId: requiredText(input.userId, 'userId'),
      bytes,
      fileName: requiredText(input.fileName, 'fileName'),
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
    })
  }

  async uploadConversationImageFromUri(
    input: NativeFileInput & { conversationId: string },
  ): Promise<string> {
    const bytes = await this.runtimeAdapter.readFile(input)
    return this.uploadConversationImage({
      conversationId: requiredText(input.conversationId, 'conversationId'),
      bytes,
      fileName: requiredText(input.fileName, 'fileName'),
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
    })
  }

  async uploadMessageMediaFromUri(
    input: NativeMessageMediaInput,
  ): Promise<{ url: string; media: MessageMedia }> {
    const bytes = await this.runtimeAdapter.readFile(input)
    const conversationId = requiredText(input.conversationId, 'conversationId')
    const fileName = requiredText(input.fileName, 'fileName')
    const url = await this.uploadMessageMedia({
      conversationId, bytes, fileName,
      ...(input.contentType === undefined ? {} : { contentType: input.contentType }),
    })
    const mediaType = input.mediaType ?? (input.contentType?.startsWith('image/') ? 'image' : 'file')
    return {
      url,
      media: {
        type: mediaType,
        url,
        name: fileName,
        ...(input.size === undefined ? {} : { size: input.size }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      },
    }
  }

  async saveDownloadedMedia(
    url: string,
    output: Omit<DownloadedMediaInput, 'blob'>,
  ): Promise<string> {
    if (!this.runtimeAdapter.saveDownload) {
      throw new ConvoKitError('This runtime does not provide downloaded-file storage', {
        code: 'NATIVE_FILE_SAVE_UNAVAILABLE',
      })
    }
    const blob = await this.downloadMedia(url)
    return this.runtimeAdapter.saveDownload({ ...output, blob })
  }
}
